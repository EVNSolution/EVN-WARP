import pathlib
import sqlite3
import unittest


class SalesProcessMigrationTest(unittest.TestCase):
    def test_forward_migration_preserves_legacy_facts_and_audit_is_immutable(self):
        db = sqlite3.connect(':memory:')
        db.executescript('CREATE TABLE SalesDeal (id TEXT PRIMARY KEY, stageCode TEXT, checklistJson TEXT, memo TEXT);')
        legacy = ('legacy', '2-1', '{"1-1-0":true,"2-1-1":true}', 'preserved note')
        db.execute('INSERT INTO SalesDeal VALUES(?,?,?,?)', legacy)
        sql = pathlib.Path(__file__).parents[1] / 'schema-migrations/2026101601_add_sales_process.sql'
        db.executescript(sql.read_text())
        self.assertEqual(db.execute('SELECT id,stageCode,checklistJson,memo FROM SalesDeal').fetchone(), legacy)
        self.assertEqual(db.execute('SELECT salesProcessJson,salesProcessRevision FROM SalesDeal').fetchone(), (None, 0))
        db.execute('INSERT INTO SalesProcessAudit (id,dealId,actorId,actorName,reason,beforeJson,afterJson) VALUES(?,?,?,?,?,?,?)',
                   ('audit', 'legacy', 'test', 'Test', 'Correction', '{}', '{}'))
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute("UPDATE SalesProcessAudit SET reason='changed'")
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute('DELETE FROM SalesProcessAudit')
        self.assertEqual(db.execute('SELECT COUNT(*) FROM SalesProcessAudit').fetchone()[0], 1)
        db.close()

    def test_display_deletion_preserves_immutable_audit_and_records_admin(self):
        db = sqlite3.connect(':memory:')
        db.execute('PRAGMA foreign_keys=ON')
        db.execute('CREATE TABLE SalesDeal (id TEXT PRIMARY KEY)')
        root = pathlib.Path(__file__).parents[1] / 'schema-migrations'
        db.executescript((root / '2026101601_add_sales_process.sql').read_text())
        db.execute("INSERT INTO SalesProcessAudit VALUES('audit','deal','author','Author','Reason','{}','{}',CURRENT_TIMESTAMP)")
        original = db.execute('SELECT * FROM SalesProcessAudit').fetchone()
        db.executescript((root / '2026101602_add_sales_process_audit_deletion.sql').read_text())
        self.assertEqual(db.execute('SELECT * FROM SalesProcessAudit').fetchone(), original)
        db.execute("INSERT INTO SalesProcessAuditDeletion(auditId,actorId,actorName) VALUES('audit','admin','Admin')")
        self.assertEqual(db.execute('SELECT * FROM SalesProcessAudit').fetchone(), original)
        self.assertEqual(db.execute('SELECT COUNT(*) FROM SalesProcessAudit a WHERE NOT EXISTS (SELECT 1 FROM SalesProcessAuditDeletion d WHERE d.auditId=a.id)').fetchone()[0], 0)
        for statement in ["DELETE FROM SalesProcessAudit", "UPDATE SalesProcessAudit SET reason='changed'", "DELETE FROM SalesProcessAuditDeletion", "UPDATE SalesProcessAuditDeletion SET actorId='changed'"]:
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute(statement)
        with self.assertRaises(sqlite3.IntegrityError):
            db.execute("INSERT INTO SalesProcessAuditDeletion(auditId,actorId,actorName) VALUES('missing','admin','Admin')")
        db.close()
