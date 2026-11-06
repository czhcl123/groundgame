import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import GamePage from '@/components/GamePage'
import { isDateKey, recentDates } from '@/lib/dates'
import { roundSchema } from '@/lib/schema'

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
  return {
    title: `${date} 的挑战 — GroundGame`,
    description: `${date} 的五道地理题。在地图上点出它发生的地方。`,
    alternates: {
      canonical: `https://groundgame.app/zh/d/${date}`,
      languages: {
        'en-US': `https://groundgame.app/d/${date}`,
        'zh-CN': `https://groundgame.app/zh/d/${date}`,
        'x-default': `https://groundgame.app/d/${date}`,
      },
    },
  }
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
