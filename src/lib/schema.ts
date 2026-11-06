import type { Metadata } from 'next'

const SITE = 'https://groundgame.app'

/** WebSite + SearchAction（首页用） */
export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'GroundGame',
    url: SITE,
    inLanguage: 'en-US',
    description:
      'A daily geography guessing game. Five questions a day, tap where it happened on the world map.',
  }
}

/**
 * 每日挑战页的 schema。
 * 用 WebPage + breadcrumb，而不是 Game —— Google 的 game 标记要求
 * 真实可交互的游戏玩法字段，而这类「每天一局」的网页游戏
 * 用 WebPage + 具体玩法描述更稳，不会因为缺字段被判无效。
 */
export function roundSchema(opts: {
  dateKey: string
  lang: 'en' | 'zh'
  questionCount: number
}) {
  const { dateKey, lang, questionCount } = opts
  const isZh = lang === 'zh'
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: isZh ? `${dateKey} 的挑战` : `Round of ${dateKey}`,
    url: isZh ? `${SITE}/zh/d/${dateKey}` : `${SITE}/d/${dateKey}`,
    inLanguage: isZh ? 'zh-CN' : 'en-US',
    description: isZh
      ? `${dateKey} 的五道地理题。在地图上点出它发生的地方。`
      : `Five geography questions for ${dateKey}. Tap where it happened on the world map.`,
    isPartOf: { '@type': 'WebSite', name: 'GroundGame', url: SITE },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'GroundGame', item: SITE },
        { '@type': 'ListItem', position: 2, name: dateKey, item: `${SITE}/d/${dateKey}` },
      ],
    },
    about: {
      '@type': 'Thing',
      name: isZh ? '每日地理猜测' : 'Daily geography guessing game',
      description: isZh
        ? `每天 ${questionCount} 道题，在地图上点出它发生的地方，越近分越高。`
        : `${questionCount} questions a day. Tap where it happened on the world map; the closer you click, the more you score.`,
    },
  }
}

/** 玩法说明页 */
export function howItWorksSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How is a guess scored?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'We measure the straight-line distance in kilometres between your click and the correct place, then convert it into points: under 60 km is 1000 points, 60–400 km is 600, 400–1,500 km is 300, and anything further is 100. There is no time bonus.',
        },
      },
      {
        '@type': 'Question',
        name: 'What does the streak multiplier do?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Hitting within 400 km counts as a hit and builds your streak. The multiplier applies to every later question: ×1 for the first two, then ×1.2, ×1.5, ×2 and ×2.5 from the fifth consecutive hit onward. A miss resets it to ×1.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I play with the keyboard?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Tab to the map, use the arrow keys to move the crosshair (hold Shift for larger steps) and press Enter to place your guess.',
        },
      },
      {
        '@type': 'Question',
        name: 'Does everyone get the same questions?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. The round is seeded by the UTC date, so everyone playing on the same day gets the same five questions. Your own results stay in your browser.',
        },
      },
    ],
  }
}
