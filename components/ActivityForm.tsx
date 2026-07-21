'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Save, Users, Building2, MapPin, Globe, Paperclip, AtSign,
  BarChart2, BookOpen, Star, TrendingUp, Link2, Unlink,
  Mail, Phone, FileText, UserPlus, Coffee, GraduationCap,
  Briefcase, Target, FileCheck, CalendarDays, HelpCircle, X,
  Code2, PenTool, Package, Wrench, Settings, ClipboardCheck,
  PieChart, Landmark, Award, ChevronDown, Mic,
  Building, Receipt, RefreshCw, Scale, Upload, FileUp,
} from 'lucide-react'
import Link from 'next/link'
import CallAnalysisModal from '@/components/CallAnalysisModal'

/* ── 활동 유형 분류 가이드 (매뉴얼 기준) ── */
const TYPE_GUIDE = [
  {
    category: '커뮤니케이션',
    color: 'bg-blue-50 border-blue-200',
    labelColor: 'text-blue-700 bg-blue-100',
    desc: '사람과의 소통·연락 활동',
    types: [
      { name: '내부회의',   desc: '팀 내부 또는 전사 정기·비정기 미팅' },
      { name: '외부미팅',   desc: '교통비·숙박비 없이 당일 이동 가능한 외부 관계자와의 미팅 (고객·영업 제외)' },
      { name: '이메일',     desc: '주요 이메일 발송·수신 (아웃룩 링크 첨부 가능)' },
      { name: '전화·통화', desc: '전화 통화, 화상 통화, 온라인 미팅' },
    ],
  },
  {
    category: '현장·이동',
    color: 'bg-orange-50 border-orange-200',
    labelColor: 'text-orange-700 bg-orange-100',
    desc: '외부 이동을 수반하는 업무',
    types: [
      { name: '국내출장', desc: '고속철·고속버스·숙박 등 교통비/숙박비가 발생하는 국내 타 지역 출장' },
      { name: '해외출장', desc: '해외 출장 — 국가·도시·목적 기록 권장' },
    ],
  },
  {
    category: '발표·행사',
    color: 'bg-rose-50 border-rose-200',
    labelColor: 'text-rose-700 bg-rose-100',
    desc: '발표·전시·사내외 행사 참여 — 업계 홍보·정보 수집·기술 발표 목적',
    types: [
      { name: '발표/전시·행사', desc: '사내 발표, 전시회 참관, 컨퍼런스 발표, 기업 행사 참가 (투자 유치 목적 제외 → 투자·IR 사용)' },
    ],
  },
  {
    category: '학습',
    color: 'bg-amber-50 border-amber-200',
    labelColor: 'text-amber-700 bg-amber-100',
    desc: '역량 개발 및 지식 습득 활동',
    types: [
      { name: '교육/연수',       desc: '사내외 교육, 자격증 취득, 위탁 연수 프로그램' },
      { name: '세미나·컨퍼런스', desc: '업계 세미나, 컨퍼런스 참관 — 학습 목적 중심' },
    ],
  },
  {
    category: '업무산출물',
    color: 'bg-slate-50 border-slate-200',
    labelColor: 'text-slate-700 bg-slate-100',
    desc: '실질적인 산출물을 직접 생산하는 작업',
    types: [
      { name: '문서·자료작성',  desc: '보고서, 기획서, 분석 자료, 제도·프로세스 문서 작성' },
      { name: '개발·구현',      desc: '시스템, SW, 펌웨어, 제어로직 등 개발 및 구현 작업' },
      { name: '도면·설계',      desc: 'CAD 도면, 회로도, 기술 설계도 등 설계 산출물 작성' },
      { name: '제품제작·조립',  desc: '제품 부품 조립, 제작, 시작품 제조 등 물리적 생산 작업' },
    ],
  },
  {
    category: '현장서비스',
    color: 'bg-yellow-50 border-yellow-200',
    labelColor: 'text-yellow-700 bg-yellow-100',
    desc: '고객 현장 방문 서비스 — AS·설치·점검',
    types: [
      { name: 'AS출동',    desc: '고객 현장 장애·고장 대응 방문 — 수리 내용 및 결과 기록' },
      { name: '설치·시운전', desc: '신규 장비·시스템 설치 및 초기 운전 확인' },
      { name: '정기점검',  desc: '계약에 따른 주기적 유지보수 및 점검 방문' },
    ],
  },
  {
    category: '영업',
    color: 'bg-violet-50 border-violet-200',
    labelColor: 'text-violet-700 bg-violet-100',
    desc: 'B2B 영업 전 과정의 고객 접점 활동',
    types: [
      { name: '고객미팅',  desc: '기존 고객사와의 관계 유지·심화 목적 대면 미팅' },
      { name: '신규영업',  desc: '잠재 고객 발굴, 첫 접촉, 니즈 탐색' },
      { name: '제안/견적', desc: '제안서 발표, 견적 협의, RFP 대응' },
      { name: '고객행사',  desc: '고객 초청 행사, 데모데이, 영업 목적 세미나 주관' },
    ],
  },
  {
    category: '관계·네트워킹',
    color: 'bg-teal-50 border-teal-200',
    labelColor: 'text-teal-700 bg-teal-100',
    desc: '중장기 관계 형성 및 사업 기회 탐색',
    types: [
      { name: '인재영입',      desc: '채용 후보자 면담, 영입 협의 활동' },
      { name: '외부 네트워킹', desc: '업계 관계자와의 비공식 교류, 커뮤니티 활동' },
      { name: '파트너십 타진', desc: '협력사·파트너십 가능성 탐색 및 초기 협의' },
    ],
  },
  {
    category: '투자·IR',
    color: 'bg-indigo-50 border-indigo-200',
    labelColor: 'text-indigo-700 bg-indigo-100',
    desc: '투자 유치 목적의 투자자 대상 활동',
    types: [
      { name: 'IR 발표',     desc: '투자자 대상 공식 IR 피칭·발표 — 불특정 업계 발표와 구분' },
      { name: '투자자 미팅', desc: '잠재·기존 투자자와의 1:1 또는 소규모 미팅' },
      { name: '투자행사',    desc: 'Demo Day, VC 컨퍼런스 등 투자 유치가 주목적인 행사 (단순 업계 참관 → 발표·행사 사용)' },
    ],
  },
  {
    category: '수주·발행',
    color: 'bg-teal-50 border-teal-200',
    labelColor: 'text-teal-700 bg-teal-100',
    desc: '외부 발행 문서 및 수주 확정 — 세금계산서 발행 시 실적 자동 계상',
    types: [
      { name: '견적서 발행', desc: '고객에게 공식 견적서 발송 (제안/견적 단계와 구분 — 문서 발행 시점 기록용)' },
      { name: 'PO 발행',    desc: '외부 협력사·공급업체에 구매 주문서(Purchase Order) 발송' },
      { name: '수주 확정',  desc: '고객으로부터 주문 확정 통보 수령 — 계약 체결 또는 발주서 수신 기준' },
      { name: '세금계산서 발행', desc: '고객에게 세금계산서 발행 → 매출 실적 인식 (KPI 수치 연계 가능)' },
    ],
  },
  {
    category: '경영·행정',
    color: 'bg-stone-50 border-stone-300',
    labelColor: 'text-stone-700 bg-stone-100',
    desc: '경영·재무·세무·법무·대관 행정 업무',
    types: [
      { name: '대관·신청', desc: '정부·공공기관·협회 등 대외기관 신청, 허가, 등록, 인가 업무' },
      { name: '세무·회계', desc: '세금 신고, 부가세·법인세 납부, 재무제표 작성, 회계 처리' },
      { name: '신고·갱신', desc: '각종 인허가·자격증·등록 갱신, 정기 신고, 만기 처리 업무' },
      { name: '법무·계약', desc: '계약서 검토·체결, 법무 자문, 지식재산권, 분쟁 대응' },
      { name: '경영기획',  desc: '이사회, 경영 계획 수립, 예산 편성, 내부 의사결정 지원' },
    ],
  },
  {
    category: '근태',
    color: 'bg-green-50 border-green-200',
    labelColor: 'text-green-700 bg-green-100',
    desc: '연차·반차 등 휴가 기록',
    types: [
      { name: '연차',      desc: '하루 전체 연차 사용' },
      { name: '반차(오전)', desc: '오전 반차 (~오후 1시)' },
      { name: '반차(오후)', desc: '오후 반차 (오후 1시~)' },
    ],
  },
] as const

/* ── 활동 유형 8개 카테고리 ── */
const ACTIVITY_CATEGORIES = [
  { label: '커뮤니케이션',   types: ['내부회의', '외부미팅', '이메일', '전화·통화'] },
  { label: '현장·이동',      types: ['국내출장', '해외출장'] },
  { label: '발표·행사',      types: ['발표/전시·행사'] },
  { label: '학습',           types: ['교육/연수', '세미나·컨퍼런스'] },
  { label: '업무산출물',     types: ['문서·자료작성', '개발·구현', '도면·설계', '제품제작·조립'] },
  { label: '현장서비스',     types: ['AS출동', '설치·시운전', '정기점검'] },
  { label: '영업',           types: ['고객미팅', '신규영업', '제안/견적', '고객행사'] },
  { label: '관계·네트워킹',  types: ['인재영입', '외부 네트워킹', '파트너십 타진'] },
  { label: '투자·IR',        types: ['IR 발표', '투자자 미팅', '투자행사'] },
  { label: '수주·발행',      types: ['견적서 발행', 'PO 발행', '수주 확정', '세금계산서 발행'] },
  { label: '경영·행정',      types: ['대관·신청', '세무·회계', '신고·갱신', '법무·계약', '경영기획'] },
  { label: '근태',           types: ['연차', '반차(오전)', '반차(오후)'] },
] as const

const TYPE_META: Record<string, { icon: React.ReactNode; color: string; activeColor: string; placeholder: string }> = {
  '내부회의':       { icon: <Users size={13} />,          color: 'border-blue-200   text-blue-600   bg-blue-50',      activeColor: 'bg-blue-600   text-white border-blue-600',    placeholder: '회의 내용, 결정사항, 후속 조치 등을 기록하세요' },
  '외부미팅':       { icon: <Building2 size={13} />,      color: 'border-purple-200 text-purple-600 bg-purple-50',    activeColor: 'bg-purple-600 text-white border-purple-600',  placeholder: '미팅 내용, 상대방 정보, 후속 조치 등을 기록하세요' },
  '이메일':         { icon: <Mail size={13} />,           color: 'border-sky-200    text-sky-600    bg-sky-50',       activeColor: 'bg-sky-600    text-white border-sky-600',     placeholder: '이메일 제목, 상대방, 주요 내용 등을 기록하세요' },
  '전화·통화':      { icon: <Phone size={13} />,          color: 'border-cyan-200   text-cyan-700   bg-cyan-50',      activeColor: 'bg-cyan-700   text-white border-cyan-700',    placeholder: '통화 상대방, 주요 내용, 결과 등을 기록하세요' },
  '국내출장':       { icon: <MapPin size={13} />,         color: 'border-orange-200 text-orange-600 bg-orange-50',    activeColor: 'bg-orange-500 text-white border-orange-500',  placeholder: '출장 목적, 방문처, 결과 등을 기록하세요' },
  '해외출장':       { icon: <Globe size={13} />,          color: 'border-red-200    text-red-600    bg-red-50',       activeColor: 'bg-red-500    text-white border-red-500',     placeholder: '출장 목적, 방문 국가/도시, 결과 등을 기록하세요' },
  '발표/전시·행사': { icon: <Star size={13} />,           color: 'border-rose-200   text-rose-600   bg-rose-50',      activeColor: 'bg-rose-500   text-white border-rose-500',    placeholder: '발표 주제/행사명, 참가 목적, 주요 성과 등을 기록하세요' },
  '교육/연수':      { icon: <BookOpen size={13} />,       color: 'border-amber-200  text-amber-600  bg-amber-50',     activeColor: 'bg-amber-500  text-white border-amber-500',   placeholder: '교육 주제, 기관, 주요 학습 내용 등을 기록하세요' },
  '세미나·컨퍼런스':{ icon: <GraduationCap size={13} />, color: 'border-amber-300  text-amber-700  bg-amber-50',     activeColor: 'bg-amber-700  text-white border-amber-700',   placeholder: '행사명, 주요 세션, 학습 내용, 네트워킹 결과 등을 기록하세요' },
  '문서·자료작성':  { icon: <FileText size={13} />,       color: 'border-slate-300  text-slate-600  bg-slate-50',     activeColor: 'bg-slate-600  text-white border-slate-600',   placeholder: '작성 문서명, 목적, 주요 내용, 배포처 등을 기록하세요' },
  '개발·구현':      { icon: <Code2 size={13} />,          color: 'border-slate-300  text-slate-600  bg-slate-50',     activeColor: 'bg-slate-600  text-white border-slate-600',   placeholder: '개발 항목, 구현 내용, 진행 상태, 이슈 등을 기록하세요' },
  '도면·설계':      { icon: <PenTool size={13} />,        color: 'border-slate-300  text-slate-600  bg-slate-50',     activeColor: 'bg-slate-600  text-white border-slate-600',   placeholder: '도면명, 설계 범위, 주요 변경사항 등을 기록하세요' },
  '제품제작·조립':  { icon: <Package size={13} />,        color: 'border-slate-300  text-slate-600  bg-slate-50',     activeColor: 'bg-slate-600  text-white border-slate-600',   placeholder: '제품명, 수량, 조립 내용, 품질 확인 결과 등을 기록하세요' },
  'AS출동':         { icon: <Wrench size={13} />,         color: 'border-yellow-200 text-yellow-700 bg-yellow-50',    activeColor: 'bg-yellow-600 text-white border-yellow-600',   placeholder: '고객사명, 장애 내용, 조치 사항, 결과 등을 기록하세요' },
  '설치·시운전':    { icon: <Settings size={13} />,       color: 'border-yellow-200 text-yellow-700 bg-yellow-50',    activeColor: 'bg-yellow-600 text-white border-yellow-600',   placeholder: '고객사명, 설치 장비, 시운전 결과, 인수 확인 등을 기록하세요' },
  '정기점검':       { icon: <ClipboardCheck size={13} />, color: 'border-yellow-200 text-yellow-700 bg-yellow-50',    activeColor: 'bg-yellow-600 text-white border-yellow-600',   placeholder: '고객사명, 점검 항목, 이상 유무, 조치 내용 등을 기록하세요' },
  '고객미팅':       { icon: <Briefcase size={13} />,      color: 'border-violet-200 text-violet-600 bg-violet-50',    activeColor: 'bg-violet-600 text-white border-violet-600',  placeholder: '고객사명, 미팅 목적, 주요 논의 내용, 다음 단계 등을 기록하세요' },
  '신규영업':       { icon: <Target size={13} />,         color: 'border-violet-200 text-violet-600 bg-violet-50',    activeColor: 'bg-violet-600 text-white border-violet-600',  placeholder: '잠재 고객사명, 접촉 경로, 니즈 파악 내용, 후속 계획 등을 기록하세요' },
  '제안/견적':      { icon: <FileCheck size={13} />,      color: 'border-violet-200 text-violet-600 bg-violet-50',    activeColor: 'bg-violet-600 text-white border-violet-600',  placeholder: '고객사명, 제안 내용, 금액, 반응 및 피드백 등을 기록하세요' },
  '고객행사':       { icon: <CalendarDays size={13} />,   color: 'border-violet-200 text-violet-600 bg-violet-50',    activeColor: 'bg-violet-600 text-white border-violet-600',  placeholder: '행사명, 참석 고객사, 목적, 주요 성과 등을 기록하세요' },
  '인재영입':       { icon: <UserPlus size={13} />,       color: 'border-teal-200   text-teal-600   bg-teal-50',      activeColor: 'bg-teal-600   text-white border-teal-600',    placeholder: '후보자 직무, 미팅 내용, 다음 단계 등을 기록하세요' },
  '외부 네트워킹':  { icon: <Coffee size={13} />,         color: 'border-green-200  text-green-600  bg-green-50',     activeColor: 'bg-green-600  text-white border-green-600',   placeholder: '상대방 소속/직위, 미팅 목적, 주요 대화 내용 등을 기록하세요' },
  '파트너십 타진':  { icon: <Link2 size={13} />,          color: 'border-emerald-200 text-emerald-600 bg-emerald-50', activeColor: 'bg-emerald-600 text-white border-emerald-600', placeholder: '상대 기업/기관, 협업 분야, 논의 내용, 다음 단계 등을 기록하세요' },
  '견적서 발행':     { icon: <FileCheck size={13} />,     color: 'border-teal-200 text-teal-700 bg-teal-50',    activeColor: 'bg-teal-600 text-white border-teal-600',    placeholder: '고객사명, 견적 금액, 제품·서비스 내용, 유효기간 등을 기록하세요' },
  'PO 발행':        { icon: <Package size={13} />,       color: 'border-teal-200 text-teal-700 bg-teal-50',    activeColor: 'bg-teal-600 text-white border-teal-600',    placeholder: '협력사명, 발주 품목, 수량, 납기일 등을 기록하세요' },
  '수주 확정':      { icon: <ClipboardCheck size={13} />,color: 'border-teal-200 text-teal-700 bg-teal-50',    activeColor: 'bg-teal-600 text-white border-teal-600',    placeholder: '고객사명, 수주 금액, 납기, 특이 조건 등을 기록하세요' },
  '세금계산서 발행': { icon: <Receipt size={13} />,      color: 'border-teal-200 text-teal-700 bg-teal-50',    activeColor: 'bg-teal-600 text-white border-teal-600',    placeholder: '고객사명, 발행 금액, 공급 내역 등을 기록하세요' },
  '실적추가':       { icon: <TrendingUp size={13} />,     color: 'border-emerald-200 text-emerald-600 bg-emerald-50', activeColor: 'bg-emerald-600 text-white border-emerald-600', placeholder: '실적 관련 메모, 특이사항 등을 기록하세요' },
  'IR 발표':        { icon: <PieChart size={13} />,       color: 'border-indigo-200  text-indigo-600  bg-indigo-50',  activeColor: 'bg-indigo-600  text-white border-indigo-600',  placeholder: '발표 대상 투자자/기관, 피칭 내용, 질의응답 주요 내용, 후속 조치 등을 기록하세요' },
  '투자자 미팅':    { icon: <Landmark size={13} />,       color: 'border-indigo-200  text-indigo-600  bg-indigo-50',  activeColor: 'bg-indigo-600  text-white border-indigo-600',  placeholder: '투자자/기관명, 미팅 목적, 주요 논의 내용, 다음 단계 등을 기록하세요' },
  '투자행사':       { icon: <Award size={13} />,          color: 'border-indigo-200  text-indigo-600  bg-indigo-50',  activeColor: 'bg-indigo-600  text-white border-indigo-600',  placeholder: '행사명, 참석 목적, 주요 만남·성과, 후속 연락 등을 기록하세요' },
  '대관·신청':  { icon: <Building size={13} />,     color: 'border-stone-300  text-stone-700  bg-stone-50',   activeColor: 'bg-stone-600   text-white border-stone-600',   placeholder: '기관명, 신청 항목, 처리 결과 등을 기록하세요' },
  '세무·회계':  { icon: <Receipt size={13} />,      color: 'border-stone-300  text-stone-700  bg-stone-50',   activeColor: 'bg-stone-600   text-white border-stone-600',   placeholder: '세목, 신고 기간, 납부 금액, 처리 기관 등을 기록하세요' },
  '신고·갱신':  { icon: <RefreshCw size={13} />,    color: 'border-stone-300  text-stone-700  bg-stone-50',   activeColor: 'bg-stone-600   text-white border-stone-600',   placeholder: '신고·갱신 항목, 기한, 처리 결과 등을 기록하세요' },
  '법무·계약':  { icon: <Scale size={13} />,         color: 'border-stone-300  text-stone-700  bg-stone-50',   activeColor: 'bg-stone-600   text-white border-stone-600',   placeholder: '계약 상대방, 계약 내용, 주요 조건, 처리 결과 등을 기록하세요' },
  '경영기획':   { icon: <BarChart2 size={13} />,    color: 'border-stone-300  text-stone-700  bg-stone-50',   activeColor: 'bg-stone-600   text-white border-stone-600',   placeholder: '안건, 결정사항, 후속 조치 등을 기록하세요' },
  '연차':       { icon: <CalendarDays size={13} />, color: 'border-green-200 text-green-700 bg-green-50', activeColor: 'bg-green-600  text-white border-green-600',  placeholder: '연차 사유 또는 일정을 입력하세요 (선택)' },
  '반차(오전)': { icon: <CalendarDays size={13} />, color: 'border-green-200 text-green-700 bg-green-50', activeColor: 'bg-green-600  text-white border-green-600',  placeholder: '오전 반차 사유 또는 일정을 입력하세요 (선택)' },
  '반차(오후)': { icon: <CalendarDays size={13} />, color: 'border-green-200 text-green-700 bg-green-50', activeColor: 'bg-green-600  text-white border-green-600',  placeholder: '오후 반차 사유 또는 일정을 입력하세요 (선택)' },
  // 레거시 (기존 데이터 표시용)
  '외부회의':  { icon: <Building2 size={13} />, color: 'border-purple-200 text-purple-600 bg-purple-50', activeColor: 'bg-purple-600 text-white border-purple-600', placeholder: '미팅 내용, 상대방 정보, 후속 조치 등을 기록하세요' },
  '발표/보고': { icon: <BarChart2 size={13} />, color: 'border-teal-200   text-teal-600   bg-teal-50',   activeColor: 'bg-teal-600   text-white border-teal-600',   placeholder: '발표 내용, 대상, 주요 피드백 등을 기록하세요' },
  '전시/행사': { icon: <Star size={13} />,      color: 'border-rose-200   text-rose-600   bg-rose-50',   activeColor: 'bg-rose-500   text-white border-rose-500',   placeholder: '행사명, 참가 목적, 주요 성과 등을 기록하세요' },
  '사무업무':  { icon: <FileText size={13} />,  color: 'border-slate-300  text-slate-600  bg-slate-50',  activeColor: 'bg-slate-600  text-white border-slate-600',  placeholder: '업무 내용, 진행 사항, 결과 등을 기록하세요' },
}

function toWeekId(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dow = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dow)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function generateWeekOptions() {
  const seen = new Set<string>()
  const opts: { value: string; label: string }[] = []
  const now = new Date()
  for (let delta = 1; delta >= -11; delta--) {
    const d = new Date(now)
    d.setDate(d.getDate() + delta * 7)
    const wId = toWeekId(d)
    if (!seen.has(wId)) {
      seen.add(wId)
      opts.push({ value: wId, label: delta === 0 ? `${wId} (이번 주)` : wId })
    }
  }
  return opts
}

function fmtComma(v: string) {
  const n = parseInt(v.replace(/[^0-9]/g, ''), 10)
  return isNaN(n) ? '' : n.toLocaleString('ko-KR')
}
function digitsOnly(v: string) { return v.replace(/[^0-9]/g, '') }

type Team    = { id: string; name: string }
type KpiItem = { id: string; label: string; unit: string | null; taskId: string }
type CmItem  = { id: string; index: number; description: string }
type Task    = {
  id: string; code: string; title: string
  teamId: string; strategy: string
  parentId: string | null
  kpiItems: KpiItem[]
  countermeasures: CmItem[]
}
type User = { id: string; name: string | null; email: string }

type VehicleOption = { id: string; name: string; plateNo: string }

interface Props {
  teams:    Team[]
  tasks:    Task[]
  users?:   User[]
  vehicles?: VehicleOption[]
  initial?: {
    id?:               string
    userId?:           string
    userName?:         string
    taskId?:           string | null
    teamId?:           string
    date?:             string
    endDate?:          string
    type?:             string
    title?:            string
    content?:          string
    mentions?:         string
    kpiItemId?:        string
    kpiWeek?:          string
    countermeasureId?: string
    planStatus?:       string
    referenceUrl?:     string
    expenseTransport?:        number | null
    expenseAccomm?:           number | null
    expenseMeal?:             number | null
    expenseOther?:            number | null
    expenseNote?:             string | null
    expenseTransportReceipt?: string | null
    expenseAccommReceipt?:    string | null
    expenseMealReceipt?:      string | null
    expenseOtherReceipt?:     string | null
    documentUrl?:             string | null
  }
  mode:            'new' | 'edit'
  returnUrl?:      string
  expensePrintUrl?: string
}

const TRIP_TYPES  = new Set(['국내출장', '해외출장'])
const LEAVE_TYPES = new Set(['연차', '반차(오전)', '반차(오후)'])
const DOC_TYPES   = new Set(['견적서 발행', 'PO 발행', '수주 확정', '세금계산서 발행'])

export default function ActivityForm({ teams, tasks, users = [], vehicles = [], initial, mode, returnUrl = '/notes', expensePrintUrl }: Props) {
  const router = useRouter()
  const WEEK_OPTIONS = generateWeekOptions()
  const currentWeekId = WEEK_OPTIONS.find(o => o.label.includes('이번 주'))?.value ?? WEEK_OPTIONS[0]?.value ?? ''

  const [userId,   setUserId]   = useState(initial?.userId   ?? '')
  const [userName, setUserName] = useState(initial?.userName ?? '')
  const [linked, setLinked] = useState<boolean>(initial?.taskId != null ? true : false)

  const initTask = initial?.taskId ? tasks.find(t => t.id === initial.taskId) : null
  const initParentId = initTask
    ? (initTask.parentId ?? initTask.id)
    : ''
  const initChildId = initTask?.parentId != null ? initTask.id : ''

  const [parentTaskId, setParentTaskId] = useState(initParentId)
  const [childTaskId,  setChildTaskId]  = useState(initChildId)
  const [teamId,       setTeamId]       = useState(initial?.teamId ?? teams[0]?.id ?? '')

  const [date,         setDate]         = useState(initial?.date    ?? new Date().toISOString().slice(0, 10))
  const [endDate,      setEndDate]      = useState(initial?.endDate ?? '')
  const [type,         setType]         = useState<string>(initial?.type ?? '내부회의')
  const [title,        setTitle]        = useState(initial?.title     ?? '')
  const [content,      setContent]      = useState(initial?.content   ?? '')
  const [mentionChips, setMentionChips] = useState<string[]>(() => {
    const raw = initial?.mentions ?? ''
    if (!raw) return []
    return raw.split(/[\s,]+/).filter(m => m.startsWith('@') && m.length > 1)
  })
  const [activePicker, setActivePicker] = useState<'team' | 'user' | null>(null)
  const [referenceUrl, setReferenceUrl] = useState(initial?.referenceUrl ?? '')
  const [kpiItemId,        setKpiItemId]        = useState(initial?.kpiItemId        ?? '')
  const [kpiWeek,          setKpiWeek]          = useState(initial?.kpiWeek          || currentWeekId)
  const [countermeasureId, setCountermeasureId] = useState(initial?.countermeasureId ?? '')
  const [planStatus, setPlanStatus] = useState<'계획'|'완료'>(
    initial?.planStatus === '완료' ? '완료' : '계획'
  )
  const [actualStr,  setActualStr]  = useState('')
  const [saving,              setSaving]              = useState(false)
  const [error,               setError]               = useState('')
  const [showGuide,           setShowGuide]           = useState(false)
  const [showMeetingAnalysis, setShowMeetingAnalysis] = useState(false)

  // 차량사용
  const [useVehicle,    setUseVehicle]    = useState(false)
  const [vehId,         setVehId]         = useState(vehicles[0]?.id ?? '')
  const [vehDeparture,  setVehDeparture]  = useState('')
  const [vehDest,       setVehDest]       = useState('')
  const [vehOdomBefore, setVehOdomBefore] = useState('')
  const [vehOdomAfter,  setVehOdomAfter]  = useState('')
  const [vehBizUse,     setVehBizUse]     = useState(true)
  const [vehNotes,      setVehNotes]      = useState('')

  // 비용정산 토글 (기존 비용 데이터가 있으면 열림)
  const [useExpense, setUseExpense] = useState(() =>
    !!(initial?.expenseTransport || initial?.expenseAccomm || initial?.expenseMeal || initial?.expenseOther)
  )

  // 문서 첨부
  const [documentUrl,    setDocumentUrl]    = useState(initial?.documentUrl ?? '')
  const [uploadingDoc,   setUploadingDoc]   = useState(false)
  const [pendingDocFile, setPendingDocFile] = useState<File | null>(null)
  const docInputRef = useRef<HTMLInputElement>(null)

  // 비용정산
  const [expenseTransport, setExpenseTransport] = useState<string>(initial?.expenseTransport ? String(initial.expenseTransport) : '')
  const [expenseAccomm,    setExpenseAccomm]    = useState<string>(initial?.expenseAccomm    ? String(initial.expenseAccomm)    : '')
  const [expenseMeal,      setExpenseMeal]      = useState<string>(initial?.expenseMeal      ? String(initial.expenseMeal)      : '')
  const [expenseOther,     setExpenseOther]     = useState<string>(initial?.expenseOther     ? String(initial.expenseOther)     : '')
  const [expenseNote,      setExpenseNote]      = useState(initial?.expenseNote ?? '')
  const [expenseTransportReceipt, setExpenseTransportReceipt] = useState(initial?.expenseTransportReceipt ?? '')
  const [expenseAccommReceipt,    setExpenseAccommReceipt]    = useState(initial?.expenseAccommReceipt    ?? '')
  const [expenseMealReceipt,      setExpenseMealReceipt]      = useState(initial?.expenseMealReceipt      ?? '')
  const [expenseOtherReceipt,     setExpenseOtherReceipt]     = useState(initial?.expenseOtherReceipt     ?? '')
  const [uploadingCat, setUploadingCat] = useState<string | null>(null)
  const receiptInputRef = useRef<HTMLInputElement>(null)
  const pendingCat      = useRef<string | null>(null)
  const expenseTotal = (Number(expenseTransport) || 0) + (Number(expenseAccomm) || 0) + (Number(expenseMeal) || 0) + (Number(expenseOther) || 0)

  const EXPENSE_ROWS = [
    { key: 'transport', label: '교통비', amount: expenseTransport, setAmount: setExpenseTransport, receipt: expenseTransportReceipt, setReceipt: setExpenseTransportReceipt },
    { key: 'accomm',   label: '숙박비', amount: expenseAccomm,    setAmount: setExpenseAccomm,    receipt: expenseAccommReceipt,    setReceipt: setExpenseAccommReceipt },
    { key: 'meal',     label: '식비',   amount: expenseMeal,      setAmount: setExpenseMeal,      receipt: expenseMealReceipt,      setReceipt: setExpenseMealReceipt },
    { key: 'other',    label: '기타',   amount: expenseOther,     setAmount: setExpenseOther,     receipt: expenseOtherReceipt,     setReceipt: setExpenseOtherReceipt },
  ] as const

  async function uploadReceipt(category: string, file: File) {
    if (!initial?.id) return
    setUploadingCat(category)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('category', category)
      fd.append('date', date)
      const res  = await fetch(`/api/activities/${initial.id}/receipts`, { method: 'POST', body: fd })
      const data = await res.json()
      const row  = EXPENSE_ROWS.find(r => r.key === category)
      if (!row) return
      // 영수증 URL 누적
      const prev = row.receipt
      row.setReceipt(prev ? `${prev}|${data.url}` : data.url)
      // OCR 금액 누적
      if (data.amount != null) {
        const cur = Number(row.amount) || 0
        row.setAmount(String(cur + data.amount))
      }
      // payload에 즉시 반영 (PUT)
      const patch: Record<string, any> = {
        [`expense${category.charAt(0).toUpperCase() + category.slice(1)}Receipt`]:
          prev ? `${prev}|${data.url}` : data.url,
      }
      if (data.amount != null) patch[`expense${category.charAt(0).toUpperCase() + category.slice(1)}`] = (Number(row.amount) || 0) + data.amount
      await fetch(`/api/activities/${initial.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    } finally {
      setUploadingCat(null)
    }
  }

  async function uploadDocument(file: File) {
    if (!initial?.id) { setPendingDocFile(file); return }
    setUploadingDoc(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('date', date)
      const res  = await fetch(`/api/activities/${initial.id}/documents`, { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) setDocumentUrl(data.documentUrl ?? data.url)
    } finally {
      setUploadingDoc(false)
    }
  }


  const parentTasks  = tasks.filter(t => t.parentId === null)
  const childTasks   = tasks.filter(t => t.parentId === parentTaskId)
  const finalTaskId  = linked ? (childTaskId || parentTaskId || null) : null
  const finalTask    = finalTaskId ? tasks.find(t => t.id === finalTaskId) : null
  const finalTeamId  = linked ? (finalTask?.teamId ?? teamId) : teamId
  const taskKpiItems = finalTask?.kpiItems ?? []
  const taskCms      = finalTask?.countermeasures ?? []
  const selectedKpi  = taskKpiItems.find(k => k.id === kpiItemId)

  const meta = TYPE_META[type] ?? TYPE_META['문서·자료작성']
  const IS_KPI_TYPE = type === '실적추가' || type === '세금계산서 발행'

  function handleParentSelect(pid: string) {
    setParentTaskId(pid)
    setChildTaskId('')
    setKpiItemId('')
    setCountermeasureId('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (linked && !parentTaskId) { setError('전략과제를 선택해주세요.'); return }
    if (!linked && !finalTeamId) { setError('팀을 선택해주세요.'); return }

    let finalTitle = title.trim()
    if (IS_KPI_TYPE) {
      if (!kpiItemId) { setError('KPI 항목을 선택해주세요.'); return }
      if (!actualStr) { setError('실적 값을 입력해주세요.'); return }
      if (!finalTitle) {
        const unit = selectedKpi?.unit ? ` ${selectedKpi.unit}` : ''
        finalTitle = `${selectedKpi?.label ?? 'KPI'} 실적 — ${fmtComma(actualStr)}${unit} (${kpiWeek})`
      }
    }
    if (LEAVE_TYPES.has(type) && !finalTitle) finalTitle = type
    if (!finalTitle) { setError('제목을 입력해주세요.'); return }
    setSaving(true); setError('')

    const actualNum = IS_KPI_TYPE ? parseInt(digitsOnly(actualStr), 10) : undefined
    const isTrip = TRIP_TYPES.has(type)
    const hasExpense = type !== '해외출장' && !LEAVE_TYPES.has(type)
    const payload = {
      taskId: finalTaskId,
      teamId: finalTeamId,
      ...(userId   && { userId }),
      ...(userName && { userName }),
      date, type, title: finalTitle, content,
      mentions: mentionChips.length > 0 ? mentionChips.join(', ') : null,
      planStatus,
      referenceUrl: referenceUrl.trim() || null,
      countermeasureId: countermeasureId || null,
      endDate: (isTrip || LEAVE_TYPES.has(type)) && endDate && endDate > date ? endDate : null,
      ...(IS_KPI_TYPE && { kpiItemId, kpiWeek, actualNum }),
      ...(hasExpense && useExpense ? {
        expenseTransport: expenseTransport ? Number(expenseTransport) : null,
        expenseAccomm:    expenseAccomm    ? Number(expenseAccomm)    : null,
        expenseMeal:      expenseMeal      ? Number(expenseMeal)      : null,
        expenseOther:     expenseOther     ? Number(expenseOther)     : null,
        expenseNote:      expenseNote.trim() || null,
        expenseTransportReceipt: expenseTransportReceipt || null,
        expenseAccommReceipt:    expenseAccommReceipt    || null,
        expenseMealReceipt:      expenseMealReceipt      || null,
        expenseOtherReceipt:     expenseOtherReceipt     || null,
      } : hasExpense ? {
        expenseTransport: null, expenseAccomm: null, expenseMeal: null, expenseOther: null,
        expenseNote: null, expenseTransportReceipt: null, expenseAccommReceipt: null,
        expenseMealReceipt: null, expenseOtherReceipt: null,
      } : {}),
      documentUrl: documentUrl || null,
    }

    try {
      const url    = mode === 'edit' ? `/api/activities/${initial?.id}` : '/api/activities'
      const method = mode === 'edit' ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data   = await res.json()
      if (!res.ok) { setError(data.error ?? '저장 실패'); setSaving(false); return }

      // 신규 저장 시 대기 중인 문서 파일 업로드
      if (pendingDocFile && data.id && mode === 'new') {
        const fd = new FormData()
        fd.append('file', pendingDocFile)
        fd.append('date', date)
        await fetch(`/api/activities/${data.id}/documents`, { method: 'POST', body: fd })
      }

      // 차량사용 체크된 경우 운행일지 생성
      if (useVehicle && vehId && mode === 'new') {
        const odomBefore = Number(vehOdomBefore)
        const odomAfter  = Number(vehOdomAfter)
        if (vehDeparture && vehDest && odomBefore && odomAfter && odomAfter >= odomBefore) {
          await fetch('/api/vehicle-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              vehicleId:      vehId,
              date,
              driverName:     userName,
              departure:      vehDeparture,
              destination:    vehDest,
              purpose:        finalTitle,
              odometerBefore: odomBefore,
              odometerAfter:  odomAfter,
              isBusinessUse:  vehBizUse,
              notes:          vehNotes || null,
              activityId:     data.id ?? null,
            }),
          })
        }
      }

      router.push(returnUrl)
      router.refresh()
    } catch (err: any) {
      setError(`저장 오류: ${err?.message ?? '서버에 연결할 수 없습니다.'}`)
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('이 활동을 삭제하시겠습니까?')) return
    await fetch(`/api/activities/${initial?.id}`, { method: 'DELETE' })
    router.push(returnUrl)
    router.refresh()
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <Link href={returnUrl} className="text-sm text-slate-400 hover:text-indigo-600 transition-colors mb-2 inline-block">
          ← 업무공간
        </Link>
        <h1 className="text-xl font-bold text-slate-900">
          {mode === 'new' ? '활동 추가' : '활동 수정'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ① 과제 연계 여부 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-slate-700 mb-3">과제 연계 여부</p>
          <div className="flex gap-3">
            <button type="button"
              onClick={() => setLinked(true)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                linked
                  ? 'border-indigo-500 bg-indigo-600 text-white'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}>
              <Link2 size={14} />
              과제 연계
            </button>
            <button type="button"
              onClick={() => { setLinked(false); setParentTaskId(''); setChildTaskId(''); setKpiItemId('') }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                !linked
                  ? 'border-slate-500 bg-slate-600 text-white'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}>
              <Unlink size={14} />
              독립 활동
            </button>
          </div>
          {linked && (
            <p className="mt-2 text-xs text-slate-400">
              입력한 활동이 3페이지 주간관리 해당 과제 아래 자동 표시됩니다.
            </p>
          )}
        </div>

        {/* ② 과제 연계 시: 전략과제 → 세부과제 선택 */}
        {linked && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">

            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">전략과제</p>
              {parentTasks.length === 0
                ? <p className="text-xs text-slate-400">등록된 전략과제가 없습니다.</p>
                : (
                  <div className="space-y-1.5">
                    {parentTasks.map(task => (
                      <button key={task.id} type="button"
                        onClick={() => handleParentSelect(task.id)}
                        className={`w-full text-left px-4 py-2.5 rounded-lg border transition-colors ${
                          parentTaskId === task.id
                            ? 'border-indigo-400 bg-indigo-50'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded mr-2 ${
                          task.strategy === 'A' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'
                        }`}>{task.strategy}</span>
                        <span className="text-xs font-mono text-slate-400 mr-2">{task.code}</span>
                        <span className="text-sm font-medium text-slate-800">{task.title}</span>
                      </button>
                    ))}
                  </div>
                )
              }
            </div>

            {parentTaskId && childTasks.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">
                  세부과제
                  <span className="ml-1.5 text-xs text-slate-400 font-normal">— 선택 시 해당 세부과제 아래 표시됩니다</span>
                </p>
                <div className="space-y-1.5">
                  <button type="button"
                    onClick={() => { setChildTaskId(''); setKpiItemId(''); setCountermeasureId('') }}
                    className={`w-full text-left px-4 py-2 rounded-lg border text-xs transition-colors ${
                      childTaskId === ''
                        ? 'border-slate-400 bg-slate-100 text-slate-700 font-semibold'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                    }`}>
                    전략과제에 직접 연계
                  </button>
                  {childTasks.map(task => (
                    <button key={task.id} type="button"
                      onClick={() => { setChildTaskId(task.id); setKpiItemId(''); setCountermeasureId('') }}
                      className={`w-full text-left px-4 py-2.5 rounded-lg border transition-colors ${
                        childTaskId === task.id
                          ? 'border-indigo-400 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}>
                      <span className="text-xs text-slate-400 mr-2">{task.code}</span>
                      <span className="text-sm font-medium text-slate-800">{task.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {finalTaskId && taskCms.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-slate-700 mb-2">
                  간트 실행안
                  <span className="ml-1.5 text-xs text-slate-400 font-normal">— 선택 시 해당 실행안 아래 표시됩니다</span>
                </p>
                <div className="space-y-1.5">
                  <button type="button"
                    onClick={() => setCountermeasureId('')}
                    className={`w-full text-left px-4 py-2 rounded-lg border text-xs transition-colors ${
                      countermeasureId === ''
                        ? 'border-slate-400 bg-slate-100 text-slate-700 font-semibold'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                    }`}>
                    실행안 미지정 (과제 수준에 표시)
                  </button>
                  {taskCms.map(cm => (
                    <button key={cm.id} type="button"
                      onClick={() => setCountermeasureId(cm.id)}
                      className={`w-full text-left px-4 py-2.5 rounded-lg border transition-colors ${
                        countermeasureId === cm.id
                          ? 'border-indigo-400 bg-indigo-50'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      }`}>
                      <span className="text-indigo-400 mr-2 text-xs">●</span>
                      <span className="text-sm text-slate-700">{cm.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ③ 독립 활동 시: 팀 선택 */}
        {!linked && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-sm font-semibold text-slate-700 mb-3">담당 팀</p>
            <div className="flex flex-wrap gap-2">
              {teams.map(t => (
                <button key={t.id} type="button"
                  onClick={() => setTeamId(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    teamId === t.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}>{t.name}</button>
              ))}
            </div>
          </div>
        )}

        {/* ③-b 담당자 (users 목록이 있을 때만 표시) */}
        {users.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-sm font-semibold text-slate-700 mb-2">담당자</p>
            <select
              value={userId}
              onChange={e => {
                const u = users.find(u => u.id === e.target.value)
                setUserId(e.target.value)
                setUserName(u ? (u.name ?? u.email) : '')
              }}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="">-- 담당자 선택 --</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
              ))}
            </select>
          </div>
        )}

        {/* ④ 날짜 + 활동 유형(카테고리) + 진행 상태 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          {/* 날짜 */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">
              {TRIP_TYPES.has(type) ? '출장 기간' : LEAVE_TYPES.has(type) ? '휴가 기간' : '날짜'}
            </p>
            {(TRIP_TYPES.has(type) || LEAVE_TYPES.has(type)) ? (
              <div className="flex items-center gap-2 flex-wrap">
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                <span className="text-slate-400 text-sm">~</span>
                <input type="date" value={endDate || date} onChange={e => setEndDate(e.target.value)}
                  min={date}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                {LEAVE_TYPES.has(type) && endDate && endDate > date && (() => {
                  const days = Math.round((new Date(endDate).getTime() - new Date(date).getTime()) / 86400000) + 1
                  return <span className="text-xs font-semibold text-green-600">{days}일</span>
                })()}
              </div>
            ) : (
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            )}
          </div>

          {/* 활동 유형 — 카테고리 그룹 */}
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-sm font-semibold text-slate-700">활동 유형</p>
              <button type="button" onClick={() => setShowGuide(true)}
                className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-indigo-500 transition-colors">
                <HelpCircle size={13} />
                <span>분류 가이드</span>
              </button>
            </div>
            <div className="space-y-2">
              {ACTIVITY_CATEGORIES.map(cat => (
                <div key={cat.label} className="flex items-start gap-3">
                  <span className="text-[9px] font-bold text-slate-400 tracking-wide w-20 shrink-0 pt-1.5 text-right">
                    {cat.label}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.types.map(t => {
                      const m = TYPE_META[t] ?? TYPE_META['문서·자료작성']
                      return (
                        <button key={t} type="button" onClick={() => {
                            if (t === '해외출장' && mode !== 'edit') {
                              router.push(`/trip/new?type=해외출장${date ? `&date=${date}` : ''}`)
                              return
                            }
                            setType(t)
                          }}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                            type === t ? m.activeColor : m.color
                          }`}>
                          {m.icon}{t}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 진행 상태 */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm font-semibold text-slate-700 mb-2">진행 상태</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPlanStatus('계획')}
                className={`px-5 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                  planStatus === '계획'
                    ? 'bg-slate-600 text-white border-slate-600'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}>
                계획
              </button>
              <button type="button" onClick={() => setPlanStatus('완료')}
                className={`px-5 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                  planStatus === '완료'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}>
                완료
              </button>
            </div>
          </div>
        </div>

        {/* ⑤-a 이메일 URL 패널 */}
        {type === '이메일' && (
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <Mail size={14} className="text-sky-600" />
              <p className="text-sm font-bold text-sky-800">이메일 참고 링크</p>
            </div>
            <p className="text-xs text-sky-500 mb-3">
              아웃룩 웹에서 이메일 우클릭 → 링크 복사 후 붙여넣기
            </p>
            <input
              type="url"
              value={referenceUrl}
              onChange={e => setReferenceUrl(e.target.value)}
              placeholder="https://outlook.office.com/mail/..."
              className="w-full border border-sky-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
          </div>
        )}

        {/* ⑤-b 실적 KPI 패널 (실적추가·세금계산서 발행) */}
        {IS_KPI_TYPE && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Receipt size={14} className="text-teal-600" />
              <p className="text-sm font-bold text-teal-800">매출 실적 입력 (KPI 연계)</p>
            </div>

            {!finalTaskId ? (
              <p className="text-sm text-teal-600">먼저 과제를 선택하세요.</p>
            ) : taskKpiItems.length === 0 ? (
              <p className="text-sm text-teal-600">이 과제에 등록된 정량 KPI가 없습니다.</p>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-teal-700 mb-2">KPI 항목</label>
                  <div className="space-y-1.5">
                    {taskKpiItems.map(kpi => (
                      <button key={kpi.id} type="button" onClick={() => setKpiItemId(kpi.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                          kpiItemId === kpi.id
                            ? 'border-teal-400 bg-white text-teal-800 font-semibold'
                            : 'border-teal-200 bg-white/60 text-slate-700 hover:border-teal-300'
                        }`}>
                        {kpi.label}
                        {kpi.unit && <span className="ml-1.5 text-xs text-slate-400">({kpi.unit})</span>}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-teal-700 mb-2">기준 주</label>
                    <select value={kpiWeek} onChange={e => setKpiWeek(e.target.value)}
                      className="w-full border border-teal-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400">
                      {WEEK_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-teal-700 mb-2">
                      실적 값{selectedKpi?.unit ? ` (${selectedKpi.unit})` : ''}
                    </label>
                    <input
                      type="text" inputMode="numeric"
                      value={fmtComma(actualStr)}
                      onChange={e => setActualStr(digitsOnly(e.target.value))}
                      placeholder="숫자 입력"
                      className="w-full border border-teal-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-400" />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ⑥ 제목 + 내용 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              제목
              {(type === '실적추가' || LEAVE_TYPES.has(type))
                ? <span className="ml-1.5 text-xs text-slate-400 font-normal">— 비워두면 자동 생성됩니다</span>
                : linked
                  ? <span className="ml-1.5 text-xs text-slate-400 font-normal">— 3페이지 주간업무에 자동 표시됩니다</span>
                  : null
              }
            </label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder={type === '실적추가' ? '(선택) 메모용 제목' : '활동 제목을 입력하세요'}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">세부 내용</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={4}
              placeholder={meta.placeholder}
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
            <button type="button" onClick={() => setShowMeetingAnalysis(true)}
              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors">
              <Mic size={12} />
              음성 회의록으로 자동 작성
            </button>
          </div>
        </div>

        {/* ⑦ @멘션 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            <AtSign size={13} className="inline mr-1 text-indigo-400" />
            업무협조 / 알림
          </label>

          {/* 선택된 멘션 칩 */}
          {mentionChips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {mentionChips.map((chip, i) => (
                <span key={i} className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-full text-xs text-indigo-700 font-semibold">
                  {chip}
                  <button type="button"
                    onClick={() => setMentionChips(prev => prev.filter((_, idx) => idx !== i))}
                    className="text-indigo-400 hover:text-indigo-700 transition-colors ml-0.5">
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* 멘션 추가 버튼 */}
          <div className="flex gap-2 flex-wrap">
            {/* @전체 */}
            <button type="button"
              onClick={() => {
                if (!mentionChips.includes('@전체')) setMentionChips(prev => [...prev, '@전체'])
                setActivePicker(null)
              }}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
              @전체
              <span className="ml-1 text-[10px] text-slate-400 font-normal">전사공지</span>
            </button>

            {/* @팀 */}
            {teams.length > 0 && (
              <div className="relative">
                <button type="button"
                  onClick={() => setActivePicker(v => v === 'team' ? null : 'team')}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    activePicker === 'team'
                      ? 'border-indigo-400 text-indigo-600 bg-indigo-50'
                      : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50'
                  }`}>
                  @팀 <ChevronDown size={11} />
                </button>
                {activePicker === 'team' && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 min-w-[120px] overflow-hidden">
                    {teams.map(t => (
                      <button key={t.id} type="button"
                        onClick={() => {
                          const chip = `@${t.name}`
                          if (!mentionChips.includes(chip)) setMentionChips(prev => [...prev, chip])
                          setActivePicker(null)
                        }}
                        className="block w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                        @{t.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* @개인 */}
            {users.length > 0 && (
              <div className="relative">
                <button type="button"
                  onClick={() => setActivePicker(v => v === 'user' ? null : 'user')}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    activePicker === 'user'
                      ? 'border-indigo-400 text-indigo-600 bg-indigo-50'
                      : 'border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50'
                  }`}>
                  @개인 <ChevronDown size={11} />
                </button>
                {activePicker === 'user' && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-20 min-w-[140px] max-h-48 overflow-y-auto">
                    {users.map(u => (
                      <button key={u.id} type="button"
                        onClick={() => {
                          const chip = `@${u.name ?? u.email}`
                          if (!mentionChips.includes(chip)) setMentionChips(prev => [...prev, chip])
                          setActivePicker(null)
                        }}
                        className="block w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                        @{u.name ?? u.email}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {mentionChips.length === 0 && (
            <p className="mt-2 text-[11px] text-slate-400">
              위 버튼으로 알림 받을 대상을 선택하세요. @전체는 전사 공지로 표시됩니다.
            </p>
          )}

          {/* 드롭다운 외부 클릭 닫기 */}
          {activePicker !== null && (
            <div className="fixed inset-0 z-10" onClick={() => setActivePicker(null)} />
          )}
        </div>

        {(type === '국내출장' || type === '해외출장') && (
          <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Paperclip size={13} className="text-slate-400" />
              <p className="text-xs font-semibold text-slate-500">출장비 정산 자동화 (준비 중)</p>
            </div>
            <p className="text-xs text-slate-400">출장 계획 및 비용 정산을 자동으로 처리합니다.</p>
            <button type="button" disabled
              className="mt-2 px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-400 cursor-not-allowed">
              정산 시작
            </button>
          </div>
        )}

        {/* ── 차량사용 ── */}
        {vehicles.length > 0 && !LEAVE_TYPES.has(type) && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={useVehicle} onChange={e => setUseVehicle(e.target.checked)}
                  className="w-4 h-4 rounded accent-indigo-600" />
                <span className="text-sm font-semibold text-slate-700">차량사용</span>
                <span className="text-xs font-normal text-slate-400">(운행일지 자동 기록)</span>
              </label>
            </div>
            {useVehicle && (
              <div className="space-y-3 mt-3 pt-3 border-t border-slate-100">
                {/* 차량 선택 */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">차량</label>
                  <select value={vehId} onChange={e => setVehId(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                    {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.plateNo})</option>)}
                  </select>
                </div>
                {/* 출발지 / 도착지 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">출발지</label>
                    <input type="text" value={vehDeparture} onChange={e => setVehDeparture(e.target.value)}
                      placeholder="예: 동작"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">도착지</label>
                    <input type="text" value={vehDest} onChange={e => setVehDest(e.target.value)}
                      placeholder="예: 고객사 A"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                </div>
                {/* 주행거리 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">운행 전 주행거리 (km)</label>
                    <input type="number" value={vehOdomBefore} onChange={e => setVehOdomBefore(e.target.value)}
                      placeholder="0"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">운행 후 주행거리 (km)</label>
                    <input type="number" value={vehOdomAfter} onChange={e => setVehOdomAfter(e.target.value)}
                      placeholder="0"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                </div>
                {/* 운행거리 자동계산 표시 */}
                {vehOdomBefore && vehOdomAfter && Number(vehOdomAfter) >= Number(vehOdomBefore) && (
                  <div className="bg-indigo-50 rounded-lg px-4 py-2 text-center">
                    <span className="text-xs text-slate-500">운행거리: </span>
                    <span className="text-sm font-bold text-indigo-600">
                      {(Number(vehOdomAfter) - Number(vehOdomBefore)).toLocaleString()} km
                    </span>
                  </div>
                )}
                {/* 업무용 여부 + 비고 */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">업무용 여부</span>
                    {[true, false].map(v => (
                      <button key={String(v)} type="button"
                        onClick={() => setVehBizUse(v)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                          vehBizUse === v
                            ? v ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-slate-500 text-white border-slate-500'
                            : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}>
                        {v ? '업무용' : '개인용'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">비고</label>
                  <input type="text" value={vehNotes} onChange={e => setVehNotes(e.target.value)}
                    placeholder="특이사항"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 비용정산 (해외출장·근태 제외) ── */}
        {type !== '해외출장' && !LEAVE_TYPES.has(type) && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={useExpense} onChange={e => setUseExpense(e.target.checked)}
                  className="w-4 h-4 rounded accent-indigo-600" />
                <span className="text-sm font-semibold text-slate-700">비용정산</span>
                <span className="text-xs font-normal text-slate-400">(선택)</span>
              </label>
              {expensePrintUrl && expenseTotal > 0 && useExpense && (
                <a href={expensePrintUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-all">
                  🖨 비용신청품의서 인쇄
                </a>
              )}
            </div>

            {useExpense && (<>
            {/* 숨겨진 파일 input */}
            <input ref={receiptInputRef} type="file" accept="image/*,application/pdf" className="hidden"
              onChange={e => {
                const cat = pendingCat.current
                if (!cat || !e.target.files?.[0]) return
                uploadReceipt(cat, e.target.files[0])
                e.target.value = ''
              }} />

            <div className="space-y-2 mb-3">
              {EXPENSE_ROWS.map(row => {
                const isUploading = uploadingCat === row.key
                const receiptUrls = row.receipt ? row.receipt.split('|') : []
                return (
                  <div key={row.key} className="flex items-start gap-2">
                    <label className="w-14 text-xs font-medium text-slate-500 pt-2.5 shrink-0">{row.label}</label>
                    <div className="flex-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.amount ? Number(row.amount).toLocaleString('ko-KR') : ''}
                        onChange={e => {
                          const raw = e.target.value.replace(/,/g, '')
                          if (raw === '' || /^\d+$/.test(raw)) row.setAmount(raw)
                        }}
                        placeholder="0"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                      {/* 첨부된 영수증 목록 */}
                      {receiptUrls.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {receiptUrls.map((url, i) => (
                            <div key={i} className="flex items-center gap-0.5">
                              <a href={url} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-blue-500 hover:underline">📄{i + 1}</a>
                              <button type="button" onClick={() => {
                                const next = receiptUrls.filter((_, idx) => idx !== i)
                                row.setReceipt(next.join('|'))
                              }} className="text-[9px] text-slate-300 hover:text-red-400">✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* 영수증 업로드 버튼 (수정 모드만) */}
                    {mode === 'edit' && initial?.id ? (
                      isUploading ? (
                        <span className="text-[10px] text-blue-400 pt-2.5">업로드중…</span>
                      ) : (
                        <button type="button"
                          onClick={() => { pendingCat.current = row.key; receiptInputRef.current?.click() }}
                          className="text-lg pt-1.5 text-slate-300 hover:text-blue-500 transition shrink-0"
                          title="영수증 첨부 (OCR 자동인식)">📎</button>
                      )
                    ) : (
                      <span className="w-6 shrink-0" />
                    )}
                  </div>
                )
              })}
            </div>

            {expenseTotal > 0 && (
              <div className="flex justify-end items-center gap-2 py-2 border-t border-slate-100 mb-3">
                <span className="text-xs text-slate-500">합계</span>
                <span className="text-sm font-bold text-indigo-600">{expenseTotal.toLocaleString('ko-KR')}원</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">비용 메모</label>
              <input type="text" value={expenseNote} onChange={e => setExpenseNote(e.target.value)}
                placeholder="비용 관련 특이사항"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>

            {mode === 'new' && (
              <p className="text-[11px] text-slate-400 mt-2">💡 영수증 첨부는 저장 후 수정 화면에서 가능합니다.</p>
            )}
            </>)}
          </div>
        )}

        {/* ── 문서 첨부 (수주·발행 유형) ── */}
        {DOC_TYPES.has(type) && (
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <FileUp size={14} className="text-teal-600" />
              <p className="text-sm font-semibold text-slate-700">문서 첨부</p>
              <span className="text-xs font-normal text-slate-400">(PDF · 이미지 · Word · Excel · HWP)</span>
            </div>

            {/* 숨겨진 파일 input */}
            <input ref={docInputRef} type="file"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.hwp"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (!f) return
                uploadDocument(f)
                e.target.value = ''
              }} />

            {/* 첨부된 파일 목록 */}
            {documentUrl && (
              <div className="flex flex-wrap gap-2 mb-3">
                {documentUrl.split('|').map((url, i) => {
                  const name = decodeURIComponent(url.split('/').pop() ?? `파일${i + 1}`)
                  return (
                    <div key={i} className="flex items-center gap-1 bg-teal-50 border border-teal-200 rounded-lg px-2.5 py-1.5">
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-teal-700 hover:underline max-w-[160px] truncate">{name}</a>
                      <button type="button" onClick={() => {
                        const parts = documentUrl.split('|').filter((_, idx) => idx !== i)
                        setDocumentUrl(parts.join('|'))
                        if (initial?.id) {
                          fetch(`/api/activities/${initial.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ documentUrl: parts.join('|') || null }),
                          })
                        }
                      }} className="text-slate-300 hover:text-red-400 ml-0.5">
                        <X size={11} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* 새 파일 선택 (pending, 신규 저장 전) */}
            {pendingDocFile && !initial?.id && (
              <div className="flex items-center gap-1 bg-teal-50 border border-teal-200 rounded-lg px-2.5 py-1.5 mb-3 w-fit">
                <span className="text-xs text-teal-700 max-w-[200px] truncate">{pendingDocFile.name}</span>
                <button type="button" onClick={() => setPendingDocFile(null)}
                  className="text-slate-300 hover:text-red-400 ml-0.5"><X size={11} /></button>
              </div>
            )}

            <button type="button"
              onClick={() => docInputRef.current?.click()}
              disabled={uploadingDoc}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-teal-700 border border-teal-200 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors disabled:opacity-50">
              {uploadingDoc ? (
                <><span className="text-xs">업로드 중…</span></>
              ) : (
                <><Upload size={14} /><span>파일 업로드</span></>
              )}
            </button>
            {mode === 'new' && !pendingDocFile && (
              <p className="text-[11px] text-slate-400 mt-2">💡 파일을 선택하면 저장 시 자동으로 첨부됩니다.</p>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="flex items-center justify-between">
          {mode === 'edit' && (
            <button type="button" onClick={handleDelete}
              className="px-4 py-2 text-sm font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
              삭제
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <Link href={returnUrl}
              className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              취소
            </Link>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-60">
              <Save size={14} />{saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </form>

      {/* ── 음성 회의록 자동화 모달 ── */}
      {showMeetingAnalysis && (
        <CallAnalysisModal
          mode="meeting"
          onClose={() => setShowMeetingAnalysis(false)}
          onApply={({ content: c, result, nextAction }) => {
            let text = c
            if (result) text += `\n\n[결과] ${result}`
            if (nextAction) text += `\n\n[다음 액션] ${nextAction}`
            setContent(text)
            setShowMeetingAnalysis(false)
          }}
        />
      )}

      {/* ── 활동 유형 분류 가이드 모달 ── */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setShowGuide(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}>

            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900">활동 유형 분류 가이드</h2>
                <p className="text-[10px] text-slate-400 mt-0.5">10개 카테고리 · 27개 유형 — 매뉴얼 기준</p>
              </div>
              <button onClick={() => setShowGuide(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 transition-colors">
                <X size={15} />
              </button>
            </div>

            {/* 카테고리 목록 */}
            <div className="overflow-y-auto px-6 py-4 space-y-3">
              {TYPE_GUIDE.map(cat => (
                <div key={cat.category} className={`rounded-xl border p-4 ${cat.color}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${cat.labelColor}`}>
                      {cat.category}
                    </span>
                    <span className="text-[10px] text-slate-500">{cat.desc}</span>
                  </div>
                  <div className="space-y-1">
                    {cat.types.map(t => (
                      <div key={t.name} className="flex items-start gap-2">
                        <span className="text-[10px] font-bold text-slate-700 w-24 shrink-0 pt-0.5">{t.name}</span>
                        <span className="text-[10px] text-slate-500 leading-relaxed">{t.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
              <p className="text-[9px] text-slate-400 text-center">
                이 분류 기준은 시스템 내 활동 유형 선택의 기준이 됩니다. 분류가 모호할 경우 가장 주된 목적에 따라 선택하세요.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
