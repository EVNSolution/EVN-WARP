ALTER TABLE "SalesDeal" ADD COLUMN "salesProcessJson" TEXT;
ALTER TABLE "SalesDeal" ADD COLUMN "salesProcessRevision" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "SalesProcessAudit" (
 "id" TEXT NOT NULL PRIMARY KEY, "dealId" TEXT NOT NULL, "actorId" TEXT NOT NULL,
 "actorName" TEXT NOT NULL, "reason" TEXT NOT NULL, "beforeJson" TEXT NOT NULL,
 "afterJson" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SalesProcessAudit_dealId_createdAt_idx" ON "SalesProcessAudit"("dealId", "createdAt");
CREATE TRIGGER "SalesProcessAudit_no_update" BEFORE UPDATE ON "SalesProcessAudit" BEGIN SELECT RAISE(ABORT, 'immutable sales process audit'); END;
CREATE TRIGGER "SalesProcessAudit_no_delete" BEFORE DELETE ON "SalesProcessAudit" BEGIN SELECT RAISE(ABORT, 'immutable sales process audit'); END;
