CREATE TABLE "BuildupEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "buildupQuoteId" INTEGER NOT NULL,
    "quoteNo" TEXT,
    "customerName" TEXT,
    "warpCustomerId" TEXT,
    "payloadJson" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "confirmedBy" TEXT,
    "confirmedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "BuildupEvent_eventKey_key" ON "BuildupEvent"("eventKey");
CREATE INDEX "BuildupEvent_status_idx" ON "BuildupEvent"("status");
