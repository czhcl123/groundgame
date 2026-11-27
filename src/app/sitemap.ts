import { dateKeyUTC } from '@/lib/game'
import { ARCHIVE_DAYS, recentDates } from '@/lib/dates'
import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

const BASE = 'https://groundquiz.com'

/**
 * 上线日。早于该日期的归档页仍可正常访问（用户从站内链接进入），
 * 但不进 sitemap：它们只是上线前的空档日期，没有搜索需求，
 * 列进去只会稀释新站的抓取预算（GSC 曾 184/185 全部「已发现-尚未编入索引」）。
 */
const SITE_LAUNCH_DATE = '2026-11-22'

/**
 * 站点地图。
 *
 * 上线后每一天的挑战页都单独收录（英文 /d/{date} + 中文 /zh/d/{date}）：
 * 每天题目不同，值得独立 URL。中文版必须一起列，否则中文存档页
 * 只能在站内被发现，拿不到搜索流量。
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const dates = recentDates(ARCHIVE_DAYS).filter((d) => d >= SITE_LAUNCH_DATE)

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
    {
      url: `${BASE}/questions`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    ...daily,
  ]
}
