import { NextRequest, NextResponse } from 'next/server'

// 출장개시일 기준환율 조회 (fawazahmed0 currency API — 무료, 무키)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const currency = (searchParams.get('currency') || 'USD').toLowerCase()
  const date     = searchParams.get('date') || new Date().toISOString().slice(0, 10)

  if (currency === 'krw') {
    return NextResponse.json({ currency: 'KRW', date, rate: 1 })
  }

  try {
    const res = await fetch(
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/${currency}.json`,
      { next: { revalidate: 86400 } }
    )
    if (!res.ok) throw new Error('primary fetch failed')
    const data = await res.json()
    const rate = data[currency]?.['krw']
    if (!rate) throw new Error('KRW not in response')
    return NextResponse.json({ currency: currency.toUpperCase(), date, rate: Math.round(rate * 100) / 100 })
  } catch {
    // fallback mirror
    try {
      const res2 = await fetch(
        `https://latest.currency-api.pages.dev/v1/currencies/${currency}.json`,
        { next: { revalidate: 86400 } }
      )
      const data2 = await res2.json()
      const rate = data2[currency]?.['krw']
      if (!rate) throw new Error('fallback also failed')
      return NextResponse.json({ currency: currency.toUpperCase(), date, rate: Math.round(rate * 100) / 100, fallback: true })
    } catch {
      return NextResponse.json({ error: '환율 조회 실패. 직접 입력해주세요.' }, { status: 502 })
    }
  }
}
