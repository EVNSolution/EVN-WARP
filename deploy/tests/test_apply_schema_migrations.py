import hashlib
import importlib.util
import json
import sqlite3
import tempfile
import unittest
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

    def write_contract(self, sql: str = "CREATE TABLE Added(id TEXT PRIMARY KEY);"):
        (self.migrations / "001_add_table.sql").write_text(sql, encoding="utf-8")
        (self.migrations / "manifest.json").write_text(
            json.dumps(
                {
                    "prismaSchemaSha256": "a" * 64,
                    "requiredTables": ["Added"],
                    "requiredIndexes": [],
                    "requiredColumns": {"Added": ["id"]},
                }
            ),
            encoding="utf-8",
        )

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
