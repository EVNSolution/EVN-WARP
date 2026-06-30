/*
  Warnings:

  - Added the required column `teamSeq` to the `StrategyTask` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StrategyTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "teamSeq" INTEGER NOT NULL,
    "subSeq" INTEGER,
    "strategy" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT '진행중',
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "problemStatement" TEXT,
    "goalStatement" TEXT,
    "kpi1Label" TEXT,
    "kpi1Value" TEXT,
    "kpi2Label" TEXT,
    "kpi2Value" TEXT,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StrategyTask_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StrategyTask_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "StrategyTask" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StrategyTask" ("code", "confirmed", "createdAt", "endDate", "goalStatement", "id", "kpi1Label", "kpi1Value", "kpi2Label", "kpi2Value", "owner", "problemStatement", "startDate", "status", "strategy", "teamId", "title", "updatedAt") SELECT "code", "confirmed", "createdAt", "endDate", "goalStatement", "id", "kpi1Label", "kpi1Value", "kpi2Label", "kpi2Value", "owner", "problemStatement", "startDate", "status", "strategy", "teamId", "title", "updatedAt" FROM "StrategyTask";
DROP TABLE "StrategyTask";
ALTER TABLE "new_StrategyTask" RENAME TO "StrategyTask";
CREATE UNIQUE INDEX "StrategyTask_code_key" ON "StrategyTask"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
