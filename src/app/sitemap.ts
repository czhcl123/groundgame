import { dateKeyUTC } from '@/lib/game'
import { ARCHIVE_DAYS, recentDates } from '@/lib/dates'
import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

const BASE = 'https://groundgame.app'

/**
 * 站点地图。
 *
 * 每一天的挑战页都单独收录（英文 /d/{date} + 中文 /zh/d/{date}）：
 * 每天题目不同，值得独立 URL。中文版必须一起列，否则中文存档页
 * 只能在站内被发现，拿不到搜索流量。
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const dates = recentDates(ARCHIVE_DAYS)

  const daily: MetadataRoute.Sitemap = dates.flatMap((d, i) => {
    const lastModified = new Date(`${d}T00:00:00Z`)
    const priority = i === 0 ? 0.9 : 0.5
    return [
      {
        url: `${BASE}/d/${d}`,
        lastModified,
        changeFrequency: 'never' as const,
        priority,
      },
      {
        url: `${BASE}/zh/d/${d}`,
        lastModified,
        changeFrequency: 'never' as const,
        priority: i === 0 ? 0.8 : 0.4,
      },
    ]
  })

  return [
    {
      url: BASE,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE}/zh`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE}/how-it-works`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    ...daily,
  ]
}
