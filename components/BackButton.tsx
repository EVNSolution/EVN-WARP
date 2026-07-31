'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

interface Props {
  fallbackHref: string
  className?: string
}

export default function BackButton({ fallbackHref, className }: Props) {
  const router = useRouter()

  function handleClick() {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push(fallbackHref)
    }
  }

  return (
    <button onClick={handleClick} className={className}>
      <ArrowLeft size={20} />
    </button>
  )
}
