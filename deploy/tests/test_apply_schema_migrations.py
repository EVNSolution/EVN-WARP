import hashlib
import importlib.util
import inspect
import json
import sqlite3
import tempfile
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "apply-schema-migrations.py"
SPEC = importlib.util.spec_from_file_location("apply_schema_migrations", MODULE_PATH)
assert SPEC and SPEC.loader
apply_schema_migrations = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(apply_schema_migrations)


class ApplySchemaMigrationsTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.database = self.root / "dev.db"
        self.backups = self.root / "backups"
        self.migrations = self.root / "migrations"
        self.migrations.mkdir()
        with sqlite3.connect(self.database) as connection:
            connection.execute("CREATE TABLE Existing(id TEXT PRIMARY KEY, value TEXT NOT NULL)")
            connection.execute("INSERT INTO Existing VALUES ('kept', 'yes')")

    def tearDown(self):
        self.temporary.cleanup()

    def write_contract(
        self,
        sql: str = "CREATE TABLE Added(id TEXT PRIMARY KEY);",
        preflight_query=None,
    ):
        (self.migrations / "001_add_table.sql").write_text(sql, encoding="utf-8")
        preflights = []
        if preflight_query is not None:
            query_dir = self.migrations / "privacy-preflights"
            query_dir.mkdir()
            query_path = query_dir / "001_no_legacy_values.sql"
            query_path.write_text(preflight_query, encoding="utf-8")
            preflights.append(
                {
                    "migration": "001_add_table.sql",
                    "auditId": "legacy-values-removed",
                    "query": "privacy-preflights/001_no_legacy_values.sql",
                    "sha256": hashlib.sha256(query_path.read_bytes()).hexdigest(),
                }
            )
        (self.migrations / "manifest.json").write_text(
            json.dumps(
                {
                    "prismaSchemaSha256": "a" * 64,
                    "requiredTables": ["Added"],
                    "requiredIndexes": [],
                    "requiredColumns": {"Added": ["id"]},
                    "privacyPreflights": preflights,
                }
            ),
            encoding="utf-8",
        )

    def apply(self):
        output = StringIO()
        with redirect_stdout(output):
            result = apply_schema_migrations.apply_migrations(
                self.database, self.migrations, self.backups, "b" * 40
            )
        return result, output.getvalue()

    def test_applies_once_with_consistent_backup_and_history(self):
        self.write_contract()
        applied, backup = apply_schema_migrations.apply_migrations(
            self.database, self.migrations, self.backups, "b" * 40
        )

        self.assertEqual(applied, ["001_add_table.sql"])
        self.assertIsNotNone(backup)
        self.assertEqual(backup.stat().st_mode & 0o777, 0o600)
        with sqlite3.connect(self.database) as connection:
            self.assertEqual(connection.execute("SELECT value FROM Existing").fetchone(), ("yes",))
            self.assertEqual(
                connection.execute('SELECT "name", "sourceRevision" FROM "_WarpSchemaMigration"').fetchone(),
                ("001_add_table.sql", "b" * 40),
            )
        with sqlite3.connect(backup) as connection:
            self.assertIsNone(
                connection.execute("SELECT 1 FROM sqlite_master WHERE name = 'Added'").fetchone()
            )

        applied_again, second_backup = apply_schema_migrations.apply_migrations(
            self.database, self.migrations, self.backups, "c" * 40
        )
        self.assertEqual(applied_again, [])
        self.assertIsNone(second_backup)
        self.assertEqual(len(list(self.backups.glob("*.db"))), 1)

    def test_rejects_an_applied_migration_after_checksum_changes(self):
        self.write_contract()
        apply_schema_migrations.apply_migrations(
            self.database, self.migrations, self.backups, "b" * 40
        )
        (self.migrations / "001_add_table.sql").write_text(
            "CREATE TABLE Changed(id TEXT PRIMARY KEY);", encoding="utf-8"
        )
        with self.assertRaisesRegex(RuntimeError, "checksum changed"):
            apply_schema_migrations.apply_migrations(
                self.database, self.migrations, self.backups, "c" * 40
            )

    def test_privacy_preflight_allows_zero_without_printing_fixture_values(self):
        self.write_contract(preflight_query="SELECT COUNT(*) FROM Existing WHERE value = 'not-present';")

        (applied, backup), output = self.apply()

        self.assertEqual(applied, ["001_add_table.sql"])
        self.assertIsNotNone(backup)
        self.assertIn("privacy_preflight_count=1", output)
        self.assertIn("privacy_preflight=legacy-values-removed:001_add_table.sql:0", output)
        self.assertNotIn("not-present", output)

    def test_privacy_preflight_blocks_before_backup_and_migration(self):
        self.write_contract(preflight_query="SELECT COUNT(*) FROM Existing WHERE value = 'yes';")

        with self.assertRaisesRegex(RuntimeError, "privacy preflight blocked") as raised:
            self.apply()

        self.assertNotIn("yes", str(raised.exception))
        self.assertEqual(len(list(self.backups.glob("*.db"))), 1)
        with sqlite3.connect(self.database) as connection:
            self.assertIsNone(connection.execute("SELECT 1 FROM sqlite_master WHERE name = 'Added'").fetchone())
            self.assertIsNone(
                connection.execute("SELECT 1 FROM sqlite_master WHERE name = '_WarpSchemaMigration'").fetchone()
            )

    def test_privacy_preflight_rejects_malformed_missing_and_invalid_queries(self):
        cases = (
            ("malformed", "SELECT 'private-fixture';", None, "one non-negative integer"),
            ("query-error", "SELECT COUNT(*) FROM MissingTable;", None, "no such table"),
            ("missing", "SELECT 0;", "delete", "query is missing"),
        )
        for name, query, mutation, message in cases:
            with self.subTest(name=name):
                self.tearDown()
                self.setUp()
                self.write_contract(preflight_query=query)
                if mutation == "delete":
                    (self.migrations / "privacy-preflights/001_no_legacy_values.sql").unlink()
                with self.assertRaisesRegex((RuntimeError, sqlite3.Error), message) as raised:
                    self.apply()
                self.assertNotIn("private-fixture", str(raised.exception))
                if name == "missing":
                    self.assertFalse(self.backups.exists())
                else:
                    self.assertEqual(len(list(self.backups.glob("*.db"))), 1)

    def test_privacy_preflight_rejects_non_query_sql(self):
        self.write_contract(preflight_query="DELETE FROM Existing;")

        with self.assertRaisesRegex(RuntimeError, "read-only query"):
            self.apply()

        with sqlite3.connect(self.database) as connection:
            self.assertEqual(connection.execute("SELECT COUNT(*) FROM Existing").fetchone(), (1,))

    def test_privacy_preflight_query_must_stay_in_the_reviewed_directory(self):
        self.write_contract(preflight_query="SELECT 0;")
        manifest_path = self.migrations / "manifest.json"
        manifest = json.loads(manifest_path.read_text())
        manifest["privacyPreflights"][0]["query"] = "001_add_table.sql"
        manifest["privacyPreflights"][0]["sha256"] = hashlib.sha256(
            (self.migrations / "001_add_table.sql").read_bytes()
        ).hexdigest()
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

        with self.assertRaisesRegex(RuntimeError, "query path is invalid"):
            self.apply()

    def test_backup_precedes_the_atomic_preflight_and_migration_transaction(self):
        source = inspect.getsource(apply_schema_migrations.apply_migrations)
        backup = source.index("connection.backup(target)")
        exclusive = source.index('connection.execute("BEGIN EXCLUSIVE")')
        preflight = source.index("run_privacy_preflights(connection", exclusive)
        migrate = source.index("for path in pending:", preflight)

        self.assertLess(backup, exclusive)
        self.assertLess(exclusive, preflight)
        self.assertLess(preflight, migrate)

    def test_applied_migration_does_not_repeat_privacy_preflight(self):
        self.write_contract(preflight_query="SELECT COUNT(*) FROM Existing WHERE value = 'blocked-later';")
        self.apply()
        with sqlite3.connect(self.database) as connection:
            connection.execute("UPDATE Existing SET value = 'blocked-later'")

        applied, backup = apply_schema_migrations.apply_migrations(
            self.database, self.migrations, self.backups, "c" * 40
        )

        self.assertEqual(applied, [])
        self.assertIsNone(backup)

    def test_failed_migration_rolls_back_schema_and_history(self):
        self.write_contract("CREATE TABLE Added(id TEXT PRIMARY KEY);\nINVALID SQL;")
        with self.assertRaises(sqlite3.Error):
            apply_schema_migrations.apply_migrations(
                self.database, self.migrations, self.backups, "b" * 40
            )
        with sqlite3.connect(self.database) as connection:
            self.assertIsNone(
                connection.execute("SELECT 1 FROM sqlite_master WHERE name = 'Added'").fetchone()
            )
            self.assertIsNone(
                connection.execute("SELECT 1 FROM sqlite_master WHERE name = '_WarpSchemaMigration'").fetchone()
            )

    def test_required_column_mismatch_fails_even_when_no_migration_is_pending(self):
        self.write_contract()
        apply_schema_migrations.apply_migrations(
            self.database, self.migrations, self.backups, "b" * 40
        )
        manifest = json.loads((self.migrations / "manifest.json").read_text())
        manifest["requiredColumns"]["Added"] = ["id", "missing"]
        (self.migrations / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        with self.assertRaisesRegex(RuntimeError, "columns do not match"):
            apply_schema_migrations.apply_migrations(
                self.database, self.migrations, self.backups, "c" * 40
            )

    def test_manifest_tracks_the_exact_prisma_schema(self):
        root = Path(__file__).parents[2]
        manifest = json.loads((root / "deploy/schema-migrations/manifest.json").read_text())
        actual = hashlib.sha256((root / "prisma/schema.prisma").read_bytes()).hexdigest()
        self.assertEqual(manifest["prismaSchemaSha256"], actual)


if __name__ == "__main__":
    unittest.main()
