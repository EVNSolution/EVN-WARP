'use client'

import { useState } from 'react'
import Link from 'next/link'

type TodoItem = { dealId: string; dealName: string; assignee: string | null; label: string; detail: string }

interface Props {
  dateLabel: string
  assignees: string[]
  todoByAssignee: Record<string, TodoItem[]>
}

export default function TodayTodoButton({ dateLabel, assignees, todoByAssignee }: Props) {
  const [open, setOpen] = useState(false)
  const totalCount = Object.values(todoByAssignee).reduce((s, arr) => s + arr.length, 0)

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-white hover:bg-slate-700 transition flex items-center gap-1.5">
        오늘 할 일
        {totalCount > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold">
            {totalCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[70vh] overflow-hidden flex flex-col mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-3 bg-slate-800 flex items-center justify-between shrink-0">
              <h2 className="text-[13px] font-bold text-white tracking-wide">오늘 할 일</h2>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-slate-300">{dateLabel}</span>
                <button onClick={() => setOpen(false)} className="text-slate-300 hover:text-white text-sm leading-none">✕</button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto">
              {assignees.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">진행 중인 리드가 없습니다</p>
              ) : (
                <div className="space-y-3">
                  {assignees.map(name => {
                    const items = todoByAssignee[name] ?? []
                    return (
                      <div key={name}>
                        <p className="text-xs font-bold text-slate-700 mb-1">{name}</p>
                        {items.length === 0 ? (
                          <p className="text-[11px] text-slate-300 pl-2">오늘 통화 없음</p>
                        ) : (
                          <ul className="space-y-1">
                            {items.map(t => (
                              <li key={t.dealId} className="text-[11px] text-slate-500 pl-2 flex items-center gap-1.5">
                                <span className={`inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold
                                  ${t.label === '예정된 미팅' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-700'}`}>
                                  {t.label}
                                </span>
                                <Link href={`/funnel/${t.dealId}`} className="text-indigo-600 hover:underline font-medium" onClick={() => setOpen(false)}>
                                  {t.dealName}
                                </Link>
                                <span className="text-slate-400">— {t.detail}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
