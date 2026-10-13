-- MCP 도구 호출 로그 — AI 사용 집계용. 호출 인자(내용)는 저장하지 않는다.
CREATE TABLE "McpLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "McpLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "McpLog_createdAt_idx" ON "McpLog"("createdAt");
CREATE INDEX "McpLog_category_idx" ON "McpLog"("category");
