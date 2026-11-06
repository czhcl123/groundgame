import type { Metadata } from 'next'
import '../globals.css'
import { baseMetadata, languageAlternates } from '@/lib/site'

export const metadata: Metadata = {
  ...baseMetadata('zh'),
  alternates: {
    canonical: 'https://groundgame.app/zh',
    languages: languageAlternates(),
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
