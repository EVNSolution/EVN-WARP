-- CreateTable
CREATE TABLE "HqMailRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "notificationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "operationId" TEXT,
    "payloadJson" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "HqMailRequest_notificationId_key" ON "HqMailRequest"("notificationId");

-- CreateIndex
CREATE UNIQUE INDEX "HqMailRequest_idempotencyKey_key" ON "HqMailRequest"("idempotencyKey");

-- CreateIndex
CREATE INDEX "HqMailRequest_status_nextAttemptAt_idx" ON "HqMailRequest"("status", "nextAttemptAt");
