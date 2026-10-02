CREATE TABLE "PersonalCard" (
    "id"        TEXT     NOT NULL PRIMARY KEY,
    "userId"    TEXT     NOT NULL,
    "alias"     TEXT     NOT NULL,
    "last4"     TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "PersonalCard_userId_idx" ON "PersonalCard"("userId");

CREATE TABLE "CardUsage" (
    "id"              TEXT     NOT NULL PRIMARY KEY,
    "date"            TEXT     NOT NULL,
    "payMethod"       TEXT     NOT NULL,
    "corporateCardId" TEXT,
    "personalCardId"  TEXT,
    "cardLabel"       TEXT,
    "merchant"        TEXT     NOT NULL,
    "attendees"       TEXT,
    "category"        TEXT     NOT NULL,
    "description"     TEXT,
    "amount"          REAL     NOT NULL,
    "activityId"      TEXT,
    "userId"          TEXT,
    "userName"        TEXT,
    "status"          TEXT     NOT NULL DEFAULT '신청',
    "approverName"    TEXT,
    "approverNote"    TEXT,
    "approvedAt"      DATETIME,
    "createdAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "CardUsage_date_idx" ON "CardUsage"("date");
CREATE INDEX "CardUsage_activityId_idx" ON "CardUsage"("activityId");
CREATE INDEX "CardUsage_userId_idx" ON "CardUsage"("userId");
