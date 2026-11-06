import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import GamePage from '@/components/GamePage'
import { isDateKey, recentDates } from '@/lib/dates'
import { roundSchema } from '@/lib/schema'
import { archiveMetadataZh } from '@/lib/seo'

export const dynamic = 'force-static'

export function generateStaticParams() {
  return recentDates(90).map((date) => ({ date }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>
}): Promise<Metadata> {
  const { date } = await params
  if (!isDateKey(date)) return {}
  return archiveMetadataZh(date)
}

export default async function Page({
  params,
}: {
  params: Promise<{ date: string }>
}) {
  const { date } = await params
  if (!isDateKey(date)) notFound()
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(roundSchema({ dateKey: date, lang: 'zh', questionCount: 5 })),
        }}
      />
      <GamePage dateKey={date} lang="zh" hero={false} />
    </>
  )
}
