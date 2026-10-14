-- 사용자 복수 팀(최대 3) — 기존 teamId 는 팀1(주 팀)로 유지하고 팀2·팀3 컬럼을 추가한다.
-- 「내 팀 보기」 등 기본 선택은 항상 팀1(teamId)이다.
ALTER TABLE "User" ADD COLUMN "teamId2" TEXT REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD COLUMN "teamId3" TEXT REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
