CREATE TABLE "CompanyScheduleRule" (
    "id"          TEXT     NOT NULL PRIMARY KEY,
    "title"       TEXT     NOT NULL,
    "recurrence"  TEXT     NOT NULL,
    "dayOfWeek"   INTEGER,
    "dayOfMonth"  INTEGER,
    "active"      BOOLEAN  NOT NULL DEFAULT true,
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 초기 운영일정 데이터 (재무/회계 반복일정)
INSERT INTO "CompanyScheduleRule" ("id","title","recurrence","dayOfWeek","dayOfMonth") VALUES
  ('csr_mon_01', '주간정산 (전주 플렉스 품의)', 'WEEKLY_DOW', 1, NULL),
  ('csr_mon_02', '연구비정산',                 'WEEKLY_DOW', 1, NULL),
  ('csr_d05_01', '전월 비용증빙 1차 마감',       'MONTHLY_DAY', NULL, 5),
  ('csr_d10_01', '매입/매출 계산서 마감',        'MONTHLY_DAY', NULL, 10),
  ('csr_d10_02', '원천세 마감',                 'MONTHLY_DAY', NULL, 10),
  ('csr_d15_01', '가결산 마감',                 'MONTHLY_DAY', NULL, 15),
  ('csr_d15_02', '각 부문 예상매출 확인',        'MONTHLY_DAY', NULL, 15),
  ('csr_d20_01', '각 부문 예상매출·비용·지급계획 취합', 'MONTHLY_DAY', NULL, 20),
  ('csr_d25_01', '거래처 정산',                 'MONTHLY_DAY', NULL, 25),
  ('csr_d25_02', '물류정산',                   'MONTHLY_DAY', NULL, 25),
  ('csr_last_01','미결-자금계획 점검',           'MONTHLY_LAST', NULL, NULL),
  ('csr_last_02','특고고용산재 신고마감',         'MONTHLY_LAST', NULL, NULL);
