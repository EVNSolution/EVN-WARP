ALTER TABLE "CompanyScheduleRule" ADD COLUMN "month" INTEGER;

-- YEARLY_MONTHDAY 일정 (특정 연간 월+일 반복)
-- 1. 부가세신고 및 납부 (법인): 1/4/7/10월 25일
INSERT INTO "CompanyScheduleRule" ("id","title","recurrence","dayOfWeek","dayOfMonth","month") VALUES
  ('csr_vat_c_01', '부가세신고 및 납부 (법인)', 'YEARLY_MONTHDAY', NULL, 25, 1),
  ('csr_vat_c_04', '부가세신고 및 납부 (법인)', 'YEARLY_MONTHDAY', NULL, 25, 4),
  ('csr_vat_c_07', '부가세신고 및 납부 (법인)', 'YEARLY_MONTHDAY', NULL, 25, 7),
  ('csr_vat_c_10', '부가세신고 및 납부 (법인)', 'YEARLY_MONTHDAY', NULL, 25, 10);

-- 2. 전년도 결산 완료: 3월 15일
INSERT INTO "CompanyScheduleRule" ("id","title","recurrence","dayOfWeek","dayOfMonth","month") VALUES
  ('csr_settle_03', '전년도 결산 완료', 'YEARLY_MONTHDAY', NULL, 15, 3);

-- 3. 연말정산 서류 마감: 2월 15일
INSERT INTO "CompanyScheduleRule" ("id","title","recurrence","dayOfWeek","dayOfMonth","month") VALUES
  ('csr_yearend_02', '연말정산 서류 마감', 'YEARLY_MONTHDAY', NULL, 15, 2);

-- 4. 부가세신고 및 납부 (개인): 1/7월 25일
INSERT INTO "CompanyScheduleRule" ("id","title","recurrence","dayOfWeek","dayOfMonth","month") VALUES
  ('csr_vat_p_01', '부가세신고 및 납부 (개인)', 'YEARLY_MONTHDAY', NULL, 25, 1),
  ('csr_vat_p_07', '부가세신고 및 납부 (개인)', 'YEARLY_MONTHDAY', NULL, 25, 7);

-- 5. 개인사업자 종합소득세 신고: 5월 31일
INSERT INTO "CompanyScheduleRule" ("id","title","recurrence","dayOfWeek","dayOfMonth","month") VALUES
  ('csr_inctax_05', '개인사업자 종합소득세 신고', 'YEARLY_MONTHDAY', NULL, 31, 5);
