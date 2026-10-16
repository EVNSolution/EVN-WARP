'use client'

import { useId } from 'react'
import BuildupQuotePicker, { type QuoteImportResult } from './BuildupQuotePicker'
import type { SalesProcessData } from '@/lib/sales-process'
import { InquiryStatusBadge } from './InquiryStatus'
import SalesProcessHistory, { type AuditEntry } from './SalesProcessHistory'

type DocumentOption = { id: string; docKey: string; fileName: string }

interface Props {
  stageCode: string
  quoteImport?: {dealId:string;revision:number;saved:boolean;onImported:(result:QuoteImportResult)=>void}
  value: SalesProcessData
  onChange: (value: SalesProcessData) => void
  documents: DocumentOption[]
  reason: string
  onReasonChange: (reason: string) => void
  queue?: { position: number | null; message: string }
  audit?: AuditEntry[]
  auditDealId?: string
  canDeleteAudit?: boolean
}

const INPUT_CLASS = 'mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:text-sm'
const INQUIRY_STATUSES: SalesProcessData['inquiryStatus'][] = ['상담 대기', '부재중 대기']
const DEPOSIT_STATUSES: { value: SalesProcessData['deposit']['status']; label: string }[] = [
  { value: 'unpaid', label: '미입금' },
  { value: 'paid', label: '입금 완료' },
  { value: 'refunded', label: '환불' },
  { value: 'cancelled', label: '취소' },
]

function RequiredCheck({ missing }: { missing: boolean }) {
  if (!missing) return null
  return <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">확인 필요</span>
}

function parseAmount(raw: string) {
  if (raw === '') return null
  const amount = Number(raw)
  return Number.isFinite(amount) ? amount : null
}


export default function SalesProcessFields({
  stageCode,
  value,
  onChange,
  documents,
  reason,
  onReasonChange,
  queue,
  audit,
  auditDealId,
  canDeleteAudit,
  quoteImport,
}: Props) {
  const id = useId()
  const quoteDocuments = documents.filter(document => ['quotation','initial_quotation','final_quotation'].includes(document.docKey))
  const depositDocuments = documents.filter(document => document.docKey === 'evn_deposit_slip')
  const selectedQuoteExists = quoteDocuments.some(document => document.id === value.finalQuote.documentId)
  const selectedDepositExists = depositDocuments.some(document => document.id === value.deposit.documentId)

  const setFinalQuote = (patch: Partial<SalesProcessData['finalQuote']>) => {
    onChange({ ...value, finalQuote: { ...value.finalQuote, ...patch } })
  }

  const setDeposit = (patch: Partial<SalesProcessData['deposit']>) => {
    onChange({ ...value, deposit: { ...value.deposit, ...patch } })
  }

  const canClearReview = reason.trim().length > 0
  const hasSupportedStage = stageCode === '1-1' || stageCode === '1-3' || stageCode === '2-1'

  if (!hasSupportedStage) return null

  return (
    <section className="space-y-4 px-4 py-4 bg-white" aria-label="B2C 영업 진행 정보">
      {stageCode === '1-1' && (
        <fieldset>
          <legend className="text-sm font-semibold text-slate-700">문의 상태</legend>
          {value.inquiryStatus === '첫 상담 완료' ? <div className="mt-2"><InquiryStatusBadge status="첫 상담 완료" /></div> :
          <div className="mt-2 grid grid-cols-2 gap-2 sm:max-w-md">
            {INQUIRY_STATUSES.map(status => (
              <label key={status} className="cursor-pointer">
                <input
                  type="radio"
                  name={`${id}-inquiry-status`}
                  value={status}
                  checked={(value.inquiryStatus === '부재중 대기' ? '부재중 대기' : '상담 대기') === status}
                  onChange={() => onChange({ ...value, inquiryStatus: status })}
                  className="peer sr-only"
                />
                <span className="flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 transition peer-checked:border-blue-600 peer-checked:bg-blue-50 peer-checked:text-blue-700 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-blue-600">
                  {status}
                </span>
              </label>
            ))}
          </div>}
        </fieldset>
      )}

      {stageCode === '1-3' && quoteImport && <BuildupQuotePicker {...quoteImport} hasQuote={Object.values(value.finalQuote).some(v => v !== '' && v != null)} />}

      {stageCode === '1-3' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-quote-date`} className="text-sm font-semibold text-slate-700">
              최종 견적 확정일
              <RequiredCheck missing={!value.finalQuote.date} />
            </label>
            <input
              id={`${id}-quote-date`}
              type="date"
              value={value.finalQuote.date ?? ''}
              onChange={event => setFinalQuote({ date: event.target.value })}
              className={INPUT_CLASS}
            />
            <p className="mt-1 text-xs text-slate-500">KST 기준 · 고객과 최종 합의한 날짜를 입력하세요.</p>
          </div>

          <div>
            <label htmlFor={`${id}-quote-model`} className="text-sm font-semibold text-slate-700">
              차량 모델
              <RequiredCheck missing={!value.finalQuote.model} />
            </label>
            <input
              id={`${id}-quote-model`}
              value={value.finalQuote.model ?? ''}
              onChange={event => setFinalQuote({ model: event.target.value })}
              className={INPUT_CLASS}
              placeholder="예: PV5"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor={`${id}-quote-spec`} className="text-sm font-semibold text-slate-700">
              확정 사양
              <RequiredCheck missing={!value.finalQuote.spec} />
            </label>
            <textarea
              id={`${id}-quote-spec`}
              value={value.finalQuote.spec ?? ''}
              onChange={event => setFinalQuote({ spec: event.target.value })}
              className={`${INPUT_CLASS} min-h-24 resize-y`}
              placeholder="차량 및 주요 특장 사양"
            />
          </div>

          <div>
            <label htmlFor={`${id}-quote-amount`} className="text-sm font-semibold text-slate-700">
              {value.finalQuote.grossAmountWon == null ? '최종 견적 금액' : '실구매가(기타 포함)'}
              <RequiredCheck missing={value.finalQuote.amountWon == null} />
            </label>
            <div className="relative">
              <input
                id={`${id}-quote-amount`}
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={value.finalQuote.amountWon ?? ''}
                onChange={event => setFinalQuote({ amountWon: parseAmount(event.target.value) })}
                className={`${INPUT_CLASS} pr-10`}
              />
              <span className="pointer-events-none absolute bottom-2.5 right-3 text-sm text-slate-500">원</span>
            </div>
          </div>

          <div>
            <label htmlFor={`${id}-quote-gross`} className="text-sm font-semibold text-slate-700">차량·특장 총액</label>
            <div className="relative"><input id={`${id}-quote-gross`} type="number" min="0" step="1" inputMode="numeric"
              value={value.finalQuote.grossAmountWon ?? ''} onChange={event => setFinalQuote({grossAmountWon:parseAmount(event.target.value)})}
              className={`${INPUT_CLASS} pr-10`} /><span className="absolute bottom-2.5 right-3 text-sm text-slate-500">원</span></div>
            <p className="mt-1 text-xs text-slate-500">BuildUP EV의 차량·특장 가격 합계(VAT 포함, 탁송료 제외). 기존 기록에서 확인되지 않는 금액은 비워 둡니다.</p>
          </div>

          <div>
            <label htmlFor={`${id}-quote-document`} className="text-sm font-semibold text-slate-700">
              최종 견적서
              <RequiredCheck missing={!value.finalQuote.documentId || !selectedQuoteExists} />
            </label>
            <select
              id={`${id}-quote-document`}
              value={selectedQuoteExists ? value.finalQuote.documentId : ''}
              onChange={event => setFinalQuote({ documentId: event.target.value })}
              className={INPUT_CLASS}
            >
              <option value="">견적서를 선택하세요</option>
              {quoteDocuments.map(document => (
                <option key={document.id} value={document.id}>{document.fileName}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">파일이 없으면 아래 증빙서류에서 먼저 견적서를 업로드하세요.</p>
          </div>
        </div>
      )}

      {stageCode === '2-1' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            1차 계약금 업무 기준은 <strong>100,000원</strong>입니다. 실제 입금액은 덮어쓰지 않습니다.
          </div>

          {value.deposit.amountWon != null && value.deposit.amountWon !== 100000 && (
            <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              실제 입금액이 10만원과 다릅니다. 저장된 금액은 유지되며 확인이 필요합니다.
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-deposit-status`} className="text-sm font-semibold text-slate-700">
                계약금 상태
                <RequiredCheck missing={!value.deposit.status} />
              </label>
              <select
                id={`${id}-deposit-status`}
                value={value.deposit.status ?? ''}
                onChange={event => setDeposit({ status: event.target.value as SalesProcessData['deposit']['status'] })}
                className={INPUT_CLASS}
              >
                {!value.deposit.status && <option value="">상태를 확인하세요</option>}
                {DEPOSIT_STATUSES.map(status => (
                  <option key={status.value} value={status.value}>{status.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor={`${id}-deposit-amount`} className="text-sm font-semibold text-slate-700">
                실제 입금액
                <RequiredCheck missing={value.deposit.amountWon == null} />
              </label>
              <div className="relative">
                <input
                  id={`${id}-deposit-amount`}
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={value.deposit.amountWon ?? ''}
                  onChange={event => setDeposit({ amountWon: parseAmount(event.target.value) })}
                  className={`${INPUT_CLASS} pr-10`}
                />
                <span className="pointer-events-none absolute bottom-2.5 right-3 text-sm text-slate-500">원</span>
              </div>
            </div>

            <div>
              <label htmlFor={`${id}-deposit-date`} className="text-sm font-semibold text-slate-700">
                실제 은행 입금일
                <RequiredCheck missing={!value.deposit.date} />
              </label>
              <input
                id={`${id}-deposit-date`}
                type="date"
                value={value.deposit.date ?? ''}
                onChange={event => setDeposit({ date: event.target.value })}
                className={INPUT_CLASS}
              />
              <p className="mt-1 text-xs text-slate-500">KST 기준 · YYYY-MM-DD</p>
            </div>

            <div>
              <label htmlFor={`${id}-deposit-time`} className="text-sm font-semibold text-slate-700">
                실제 은행 입금시각 <span className="font-normal text-slate-400">(선택)</span>
              </label>
              <input
                id={`${id}-deposit-time`}
                type="time"
                value={value.deposit.time ?? ''}
                onChange={event => setDeposit({ time: event.target.value })}
                className={INPUT_CLASS}
              />
              <p className="mt-1 text-xs text-slate-500">KST 기준 · HH:mm</p>
            </div>

            <div>
              <label htmlFor={`${id}-deposit-model`} className="text-sm font-semibold text-slate-700">
                동일 차량 모델
                <RequiredCheck missing={!value.deposit.model} />
              </label>
              <input
                id={`${id}-deposit-model`}
                value={value.deposit.model ?? ''}
                onChange={event => setDeposit({ model: event.target.value })}
                className={INPUT_CLASS}
                placeholder="예: PV5"
              />
            </div>

            <div>
              <label htmlFor={`${id}-deposit-spec`} className="text-sm font-semibold text-slate-700">
                주요 사양
                <RequiredCheck missing={!value.deposit.spec} />
              </label>
              <input
                id={`${id}-deposit-spec`}
                value={value.deposit.spec ?? ''}
                onChange={event => setDeposit({ spec: event.target.value })}
                className={INPUT_CLASS}
                placeholder="순번 비교에 필요한 주요 사양"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor={`${id}-deposit-document`} className="text-sm font-semibold text-slate-700">
                EV&amp; 계약금 송금 내역
                <RequiredCheck missing={!value.deposit.documentId || !selectedDepositExists} />
              </label>
              <select
                id={`${id}-deposit-document`}
                value={selectedDepositExists ? value.deposit.documentId : ''}
                onChange={event => setDeposit({ documentId: event.target.value })}
                className={INPUT_CLASS}
              >
                <option value="">송금 내역을 선택하세요</option>
                {depositDocuments.map(document => (
                  <option key={document.id} value={document.id}>{document.fileName}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">파일이 없으면 아래 증빙서류에서 먼저 송금 내역을 업로드하세요.</p>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <label htmlFor={`${id}-review-pending`} className="flex items-start gap-3 text-sm font-semibold text-amber-950">
              <input
                id={`${id}-review-pending`}
                type="checkbox"
                checked={value.deposit.reviewPending}
                disabled={value.deposit.reviewPending && !canClearReview}
                onChange={event => onChange({
                  ...value,
                  deposit: { ...value.deposit, reviewPending: event.target.checked },
                })}
                className="mt-0.5 h-4 w-4 rounded border-amber-400 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <span>입금일·사양 변경에 따른 순번 검토 필요</span>
            </label>
            <p className="mt-2 text-xs leading-5 text-amber-800">
              입금 정보나 사양을 바꾸면 검토 상태와 정정 사유가 필요합니다. 같은 날의 정확한 입금시각을 모르면 임의로 순서를 정하지 않습니다.
            </p>
            {value.deposit.reviewPending && !canClearReview && (
              <p className="mt-1 text-xs font-semibold text-amber-900">검토 상태를 해제하려면 아래에 정정 사유를 입력하세요.</p>
            )}
          </div>

          {queue?.message && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-800">{queue.message}</p>
              {queue.position != null && (
                <p className="mt-1 text-xs text-slate-600">서버에서 확인된 대기 순번: {queue.position}번</p>
              )}
            </div>
          )}
        </div>
      )}

      {stageCode !== '1-1' && <div className="border-t border-slate-200 pt-4">
        <label htmlFor={`${id}-reason`} className="text-sm font-semibold text-slate-700">정정 사유</label>
        <textarea
          id={`${id}-reason`}
          value={reason}
          onChange={event => onReasonChange(event.target.value)}
          className={`${INPUT_CLASS} min-h-20 resize-y`}
          placeholder="기존 저장값을 고치는 이유를 입력하세요"
        />
        <p className="mt-1 text-xs text-slate-500">이미 저장한 견적·입금 정보를 고칠 때는 정정 사유를 입력해 주세요.</p>
      </div>}

      {audit && <SalesProcessHistory audit={audit} dealId={auditDealId} canDelete={canDeleteAudit} />}

    </section>
  )
}
