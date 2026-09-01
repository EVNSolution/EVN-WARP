import type { Metadata } from 'next'
import { Noto_Sans_KR, Jost } from 'next/font/google'
import './globals.css'

const notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '900'],
  variable: '--font-korean',
})

const jost = Jost({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-latin',
})

export const metadata: Metadata = {
  title: 'EV& WARP',
  description: '목표관리 통합 플랫폼',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'WARP' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <head>
        <meta name="theme-color" content="#0B1D3A" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={`${notoSansKR.variable} ${jost.variable} h-full bg-gray-50`}>{children}</body>
    </html>
  )
}
