import type { Metadata } from 'next'

export const SITE_URL = 'https://groundquiz.com'

/**
 * 两个根 layout（英文站 / 中文站）共用的 metadata。
 *
 * 用 route group 实现多根 layout 时，Next 不允许存在顶层 app/layout.tsx，
 * 所以 layout 的公共部分抽到这里，避免两边写重复。
 */
export function baseMetadata(lang: 'en' | 'zh'): Metadata {
  const isZh = lang === 'zh'
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: isZh ? '体育地理每日问答 — 在地图上点出它发生的地方' : 'Sports Geography Quiz — Guess Where It Happened',
      template: '%s | GroundGame',
    },
    description: isZh
      ? '每天 5 道体育地理题,在地图上点出它发生的地方。题材涵盖 NBA / NHL / MLB / NFL / 足球等联赛的场馆、球员出生地与体坛历史时刻。'
      : 'Five sports geography questions a day. Tap where it happened on the world map - arenas, birthplaces and historic moments from the NBA, NHL, MLB, NFL, soccer and more.',
    keywords: isZh
      ? ['体育地理', '地理猜谜游戏', '每日问答游戏', '地图游戏', 'NBA球馆', '体育知识']
      : [
          'geography quiz',
          'map quiz',
          'world map quiz',
        ],
    openGraph: {
      type: 'website',
      url: isZh ? `${SITE_URL}/zh` : SITE_URL,
      title: isZh ? '体育地理每日问答 — 在地图上点出它发生的地方' : 'Sports Geography Quiz — Guess Where It Happened',
      description: isZh
        ? '每天 5 道体育地理题,在地图上点出它发生的地方。题材涵盖各大联赛场馆、球员出生地与体坛历史时刻。'
        : 'Five sports geography questions a day. Tap where it happened on the world map - arenas, birthplaces and historic moments.',
      siteName: 'GroundGame',
      locale: isZh ? 'zh_CN' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: isZh ? '体育地理每日问答 — 在地图上点出它发生的地方' : 'Sports Geography Quiz — Guess Where It Happened',
      description: isZh
        ? '每天 5 道体育地理题,在地图上点出它发生的地方。'
        : 'Five sports geography questions a day. Tap where it happened on the world map.',
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

/** 中英文互相指向（+ x-default 指向英文主站） */
export function languageAlternates() {
  return {
    'en-US': SITE_URL,
    'zh-CN': `${SITE_URL}/zh`,
    'x-default': SITE_URL,
  }
}
