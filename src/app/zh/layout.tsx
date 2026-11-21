import type { Metadata } from 'next'
import '../globals.css'
import { baseMetadata, languageAlternates } from '@/lib/site'

export const metadata: Metadata = {
  ...baseMetadata('zh'),
  alternates: {
    canonical: 'https://groundquiz.com/zh',
    languages: languageAlternates(),
  },
  verification: {
    google: 'dXPNaU_hNcsjLcY-evyZ5paa-2SF4m0ZVYjTg0K2iGA',
    other: {
      'msvalidate.01': '87865D2AEA9BDBEE5E8EA72DF58CE57A',
    },
  },
}

/**
 * 中文站根 layout。
 *
 * 与 (en) 组并行的第二个根 layout —— 这样中文页的 <html lang="zh-CN">
 * 才正确，而不是被根 layout 硬编码成 en。
 */
export default function ZhLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
