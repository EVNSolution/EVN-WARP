-- AI 생성 캐시(주간회의 브리핑) — 마지막 생성본을 저장해 재시작·배포 후에도 즉시 띄운다.
CREATE TABLE "AiDigestCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "json" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
