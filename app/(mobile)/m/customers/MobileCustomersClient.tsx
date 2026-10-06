'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronRight, GitMerge, Phone, Search } from 'lucide-react'
import { countDuplicateCustomers } from '@/lib/customer-mobile'

type Customer = {
  id: string
  name: string
  phone: string | null
  status: string
  customerSegment: string | null
  assignee: string | null
  leads: { id: string }[]
}

type Segment = 'all' | 'B2C' | 'B2B'

export default function MobileCustomersClient({
  customers: initial,
  canMergeCustomers,
  canRefresh,
}: {
  customers: Customer[]
  canMergeCustomers: boolean
  canRefresh: boolean
}) {
  const [customers, setCustomers] = useState(initial)
  const [search, setSearch] = useState('')
  const [segment, setSegment] = useState<Segment>('all')

  const reloadCustomers = useCallback(async () => {
    if (!canRefresh) return
    try {
      const response = await fetch('/api/customers', { cache: 'no-store' })
      if (response.ok) setCustomers(await response.json())
    } catch { /* Keep the last known list while offline. */ }
  }, [canRefresh])

  useEffect(() => {
    const refresh = window.setTimeout(reloadCustomers, 0)
    window.addEventListener('focus', reloadCustomers)
    return () => {
      window.clearTimeout(refresh)
      window.removeEventListener('focus', reloadCustomers)
    }
  }, [reloadCustomers])

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('ko-KR')
    const digits = query.replace(/\D/g, '')
    return customers.filter(customer => {
      const customerSegment = customer.customerSegment ?? 'B2C'
      if (segment !== 'all' && customerSegment !== segment) return false
      if (!query) return true
      return customer.name.toLocaleLowerCase('ko-KR').includes(query)
        || (customer.phone ?? '').toLocaleLowerCase('ko-KR').includes(query)
        || (!!digits && (customer.phone ?? '').replace(/\D/g, '').includes(digits))
    })
  }, [customers, search, segment])

  const duplicateCount = canMergeCustomers ? countDuplicateCustomers(customers) : 0

  return (
    <div className="min-h-full bg-gray-50">
      <div className="border-b border-gray-100 bg-white px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">고객 관리</h1>
            <p className="mt-0.5 text-xs text-gray-500">전체 {customers.length}명 · 표시 {filtered.length}명</p>
          </div>
          {canMergeCustomers && (
            <Link
              href="/m/customers/duplicates"
              className="relative flex min-h-11 items-center gap-1.5 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-gray-700 active:bg-gray-50"
            >
              <GitMerge size={17} />
              중복 확인
              {duplicateCount > 0 && (
                <span
                  role="status"
                  aria-label={`처리할 중복 고객 ${duplicateCount}건`}
                  className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white tabular-nums"
                >
                  {duplicateCount > 99 ? '99+' : duplicateCount}
                </span>
              )}
            </Link>
          )}
        </div>

        <label className="relative mt-3 block">
          <span className="sr-only">고객 검색</span>
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="이름 또는 전화번호 검색"
            className="min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white"
          />
        </label>

        <div className="mt-3 grid grid-cols-3 gap-2" aria-label="고객 구분">
          {([
            ['all', '전체'],
            ['B2C', 'B2C'],
            ['B2B', 'B2B'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSegment(value)}
              aria-pressed={segment === value}
              className={`min-h-11 rounded-xl border text-sm font-semibold ${
                segment === value
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-200 bg-white text-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 p-4">
        {filtered.length === 0 && (
          <div className="rounded-xl border border-gray-100 bg-white px-4 py-10 text-center text-sm text-gray-400">
            조건에 맞는 고객이 없습니다.
          </div>
        )}
        {filtered.map(customer => (
          <Link
            key={customer.id}
            href={`/m/customers/${customer.id}`}
            className="flex min-h-11 items-center gap-3 rounded-xl border border-gray-100 bg-white p-4 shadow-sm active:bg-gray-50"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-base font-bold text-gray-900">{customer.name || '이름 미입력'}</span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  (customer.customerSegment ?? 'B2C') === 'B2B'
                    ? 'bg-violet-100 text-violet-700'
                    : 'bg-sky-50 text-sky-600'
                }`}>
                  {customer.customerSegment ?? 'B2C'}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-sm text-gray-500">
                <Phone size={14} />
                <span>{customer.phone || '연락처 없음'}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-600">{customer.status}</span>
                <span className="rounded-full bg-blue-50 px-2 py-1 font-semibold text-blue-700">리드 {customer.leads.length}건</span>
              </div>
            </div>
            <ChevronRight size={20} className="shrink-0 text-gray-300" />
          </Link>
        ))}
      </div>
    </div>
  )
}
