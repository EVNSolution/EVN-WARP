-- 활동 댓글 — 활동(일정·업무)별 대화 이력 + 첨부. AI(CLEVER)가 회의자료 재료로 읽는다.
CREATE TABLE "ActivityComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "filesJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityComment_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "WorkActivity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ActivityComment_activityId_idx" ON "ActivityComment"("activityId");
