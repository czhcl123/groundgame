import type { Metadata } from 'next'

export const SITE_URL = 'https://groundgame.app'

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
      default: isZh ? 'GroundGame — 每日地理猜测游戏' : 'GroundGame — Daily geography guessing game',
      template: '%s | GroundGame',
    },
    description: isZh
      ? '每天 5 道地理题,在地图上点出它发生的地方。体育历史、场馆、名人出生地,60 到 90 秒一局。'
      : 'Five questions a day. Tap where it happened on the world map. Sports geography, history, and landmarks — 60 to 90 seconds a round.',
    keywords: isZh
      ? ['地理游戏', '每日猜谜', '地图游戏', '地理知识', '体育地理']
      : [
          'geography game',
          'guessing game',
          'daily geography puzzle',
          'map quiz',
          'sports geography',
          'world capitals game',
          'learn geography',
        ],
    openGraph: {
      type: 'website',
      url: isZh ? `${SITE_URL}/zh` : SITE_URL,
      title: isZh ? 'GroundGame — 每日地理猜测游戏' : 'GroundGame — Daily geography guessing game',
      description: isZh
        ? '每天 5 道地理题,在地图上点出它发生的地方。60 到 90 秒一局。'
        : 'Five questions a day. Tap where it happened on the world map. 60 to 90 seconds a round.',
      siteName: 'GroundGame',
      locale: isZh ? 'zh_CN' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: isZh ? 'GroundGame — 每日地理猜测游戏' : 'GroundGame — Daily geography guessing game',
      description: isZh
        ? '每天 5 道地理题,在地图上点出它发生的地方。'
        : 'Five questions a day. Tap where it happened on the world map.',
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
