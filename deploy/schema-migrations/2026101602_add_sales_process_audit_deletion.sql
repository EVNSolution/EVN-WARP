CREATE TABLE "SalesProcessAuditDeletion" (
  "auditId" TEXT NOT NULL PRIMARY KEY,
  "actorId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesProcessAuditDeletion_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "SalesProcessAudit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TRIGGER "SalesProcessAuditDeletion_no_update" BEFORE UPDATE ON "SalesProcessAuditDeletion" BEGIN SELECT RAISE(ABORT, 'immutable sales process audit deletion'); END;
CREATE TRIGGER "SalesProcessAuditDeletion_no_delete" BEFORE DELETE ON "SalesProcessAuditDeletion" BEGIN SELECT RAISE(ABORT, 'immutable sales process audit deletion'); END;
