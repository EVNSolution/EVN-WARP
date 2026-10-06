CREATE TABLE "CustomerMerge" (
    "sourceId" TEXT NOT NULL PRIMARY KEY,
    "targetId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "previewToken" TEXT NOT NULL,
    "choicesJson" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ("sourceId" <> "targetId")
);

CREATE INDEX "CustomerMerge_targetId_idx" ON "CustomerMerge"("targetId");

-- Keep canonical customers reachable; a subsequent archived merge may remove an intermediate.
CREATE TRIGGER "CustomerMerge_protect_target" BEFORE DELETE ON "Customer"
WHEN EXISTS (SELECT 1 FROM "CustomerMerge" WHERE "targetId" = OLD."id")
 AND NOT EXISTS (SELECT 1 FROM "CustomerMerge" WHERE "sourceId" = OLD."id")
BEGIN
    SELECT RAISE(ABORT, 'merged_customer_delete_refused');
END;

CREATE TRIGGER "CustomerMerge_no_source_reuse" BEFORE INSERT ON "Customer"
WHEN EXISTS (SELECT 1 FROM "CustomerMerge" WHERE "sourceId" = NEW."id")
BEGIN
    SELECT RAISE(ABORT, 'merged_customer_id_reserved');
END;

CREATE TRIGGER "CustomerMerge_no_update" BEFORE UPDATE ON "CustomerMerge"
BEGIN
    SELECT RAISE(ABORT, 'customer_merge_audit_immutable');
END;

CREATE TRIGGER "CustomerMerge_no_delete" BEFORE DELETE ON "CustomerMerge"
BEGIN
    SELECT RAISE(ABORT, 'customer_merge_audit_immutable');
END;
