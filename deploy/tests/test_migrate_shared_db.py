import importlib.util
import sqlite3
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "migrate-shared-db.py"
SPEC = importlib.util.spec_from_file_location("migrate_shared_db", MODULE_PATH)
assert SPEC and SPEC.loader
migrate_shared_db = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(migrate_shared_db)


class MigrateSharedDbTest(unittest.TestCase):
    def test_symlink_keeps_legacy_and_container_paths_on_one_journal(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            legacy = root / "legacy"
            shared = root / "shared"
            legacy.mkdir()
            shared.mkdir()
            source = legacy / "dev.db"
            target = shared / "dev.db"
            with sqlite3.connect(source) as connection:
                connection.execute("CREATE TABLE sample(id INTEGER)")

            self.assertTrue(migrate_shared_db.migrate(source, target))
            self.assertTrue(source.is_symlink())
            self.assertEqual(source.resolve(), target.resolve())
            self.assertFalse(migrate_shared_db.migrate(source, target))

            connection = sqlite3.connect(source)
            connection.execute("BEGIN IMMEDIATE")
            connection.execute("INSERT INTO sample VALUES (1)")
            self.assertTrue((shared / "dev.db-journal").exists())
            self.assertFalse((legacy / "dev.db-journal").exists())
            connection.commit()
            connection.close()


if __name__ == "__main__":
    unittest.main()
