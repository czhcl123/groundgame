import type { Metadata } from 'next'
import '../globals.css'
import { baseMetadata, languageAlternates } from '@/lib/site'

export const metadata: Metadata = {
  ...baseMetadata('en'),
  alternates: {
    canonical: 'https://groundgame.app/',
    languages: languageAlternates(),
  },
}

/**
 * 英文站根 layout。
 *
 * 项目用两个并行的根 layout（(en) 组 / zh 目录）来让 <html lang> 正确，
 * 所以顶层没有 src/app/layout.tsx。Next 要求：没有顶层 layout 时，
 * 每个根 layout 都要自己输出 <html> 和 <body>。
 */
export default function EnLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
