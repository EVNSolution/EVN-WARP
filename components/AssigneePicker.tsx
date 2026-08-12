'use client'

import { useState, useEffect } from 'react'

interface User { id: string; name: string; employmentType: string; externalRole: string | null }

interface Props {
  value: string
  onChange: (name: string) => void
  className?: string
}

export default function AssigneePicker({ value, onChange, className }: Props) {
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then((data: User[]) => setUsers(data))
      .catch(() => {})
  }, [])

  const internal = users.filter(u => u.employmentType !== '사외')
  const external = users.filter(u => u.employmentType === '사외')

  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={className}>
      <option value="">미배정</option>
      <optgroup label="사내">
        {internal.map(u => (
          <option key={u.id} value={u.name}>{u.name}</option>
        ))}
      </optgroup>
      {external.length > 0 && (
        <optgroup label="사외">
          {external.map(u => (
            <option key={u.id} value={u.name}>{u.name}{u.externalRole ? ` (${u.externalRole})` : ''}</option>
          ))}
        </optgroup>
      )}
    </select>
  )
}
