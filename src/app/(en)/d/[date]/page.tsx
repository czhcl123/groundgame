import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import GamePage from '@/components/GamePage'
import { isDateKey, recentDates } from '@/lib/dates'
import { roundSchema } from '@/lib/schema'

export const dynamic = 'force-static'

/** 预渲染最近 90 天 */
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
    title: `Round of ${date} — GroundGame`,
    description: `Five geography questions for ${date}. Tap where it happened on the world map.`,
    alternates: {
      canonical: `https://groundgame.app/d/${date}`,
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
          __html: JSON.stringify(roundSchema({ dateKey: date, lang: 'en', questionCount: 5 })),
        }}
      />
      <GamePage dateKey={date} lang="en" hero={false} />
    </>
  )
}
