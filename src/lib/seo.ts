import type { Metadata } from 'next'
import { dailyRound } from '@/lib/game'
import type { Question } from '@/lib/game'
import raw from '@/data/questions.json'

const ALL = raw.questions as Question[]
const GAME_ID = 'groundgame'

/**
 * 每页的 SEO 标题和描述。
 *
 * 存档页不能只写 "Round of 2026-11-05" —— 那是一个零关键词的标题，
 * 183 个页面全都长这样，等于放弃了长尾。真实的每日题目覆盖多个联赛，
 * 所以标题直接列出当天实际出现的联赛（NBA / NHL / MLB / NFL…），
 * 这样每天的页面都对应一个具体的搜索词。
 */

/** sport 字段 -> 搜索者会用的名字 */
const LEAGUE_NAME: Record<string, string> = {
  'american football': 'NFL',
  'canadian football': 'CFL',
  baseball: 'MLB',
  basketball: 'NBA',
  'ice hockey': 'NHL',
  soccer: 'Soccer',
  golf: 'Golf',
  tennis: 'Tennis',
  olympics: 'Olympics',
  racing: 'Racing',
  running: 'Running',
  cycling: 'Cycling',
  boxing: 'Boxing',
  rugby: 'Rugby',
  swimming: 'Swimming',
  athletics: 'Athletics',
  gymnastics: 'Gymnastics',
  cricket: 'Cricket',
  bobsled: 'Bobsled',
  skiing: 'Skiing',
  mountaineering: 'Mountaineering',
  media: 'Sports Media',
}

/** 中文名 */
const LEAGUE_NAME_ZH: Record<string, string> = {
  'american football': '美式橄榄球',
  'canadian football': '加拿大橄榄球',
  baseball: '棒球',
  basketball: '篮球',
  'ice hockey': '冰球',
  soccer: '足球',
  golf: '高尔夫',
  tennis: '网球',
  olympics: '奥运',
  racing: '赛车',
  running: '跑步',
  cycling: '自行车',
  boxing: '拳击',
  rugby: '橄榄球',
  swimming: '游泳',
  athletics: '田径',
  gymnastics: '体操',
  cricket: '板球',
  bobsled: '雪车',
  skiing: '滑雪',
  mountaineering: '登山',
  media: '体育媒体',
}

/** 英文连接词：NBA, NHL & MLB */
function joinEnglish(items: string[]): string {
  if (items.length <= 1) return items[0] || ''
  if (items.length === 2) return `${items[0]} & ${items[1]}`
  return `${items.slice(0, -1).join(', ')} & ${items[items.length - 1]}`
}

/** 中文连接词：篮球、冰球和棒球 */
function joinChinese(items: string[]): string {
  if (items.length <= 1) return items[0] || ''
  if (items.length === 2) return `${items[0]}和${items[1]}`
  return `${items.slice(0, -1).join('、') }和${items[items.length - 1]}`
}

/**
 * 当天题目涉及的联赛，按出现次数排序。
 * 最多取 3 个 —— 再多标题就超 60 字符了。
 */
export function leaguesFor(dateKey: string): string[] {
  const round = dailyRound(ALL, dateKey, GAME_ID)
  const counts = new Map<string, number>()
  for (const q of round) counts.set(q.sport, (counts.get(q.sport) || 0) + 1)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([sport]) => sport)
}

/** 品牌后缀长度：所有 title 都要预留出来 */
const SUFFIX = ' | GroundGame'
const TITLE_LIMIT = 60

/** 英文标题：NBA, NHL & MLB Sports Quiz — 2026-11-05 */
export function archiveTitleEn(dateKey: string): string {
  const leagues = leaguesFor(dateKey)
  const names = leagues.map((s) => LEAGUE_NAME[s] || s)
  const label = names.length ? joinEnglish(names) : 'Sports'
  return capTitle(`${label} Sports Quiz — ${dateKey}`, dateKey)
}

/** 中文标题：篮球、冰球和棒球地理问答 — 2026-11-05 */
export function archiveTitleZh(dateKey: string): string {
  const leagues = leaguesFor(dateKey)
  const names = leagues.map((s) => LEAGUE_NAME_ZH[s] || s)
  const label = names.length ? joinChinese(names) : '体育'
  return capTitle(`${label}地理问答 — ${dateKey}`, dateKey)
}

/**
 * 把标题压到 60 字符以内（含品牌后缀）。
 *
 * 注意：Next 会把 "&" 转义成 "&amp;" 输出到 HTML（5 个字符），所以这里
 * 必须按转义后的长度来算，否则 "NFL, MLB & NBA ..." 会算成 55 而实际是 59+。
 */
function capTitle(title: string, dateKey: string): string {
  const escaped = (t: string) => t.replace(/&/g, "&amp;").length
  if (escaped(title) + SUFFIX.length <= TITLE_LIMIT) return title

  const leagues = leaguesFor(dateKey)
  // 逐个减少联赛数量
  for (let n = leagues.length - 1; n >= 1; n--) {
    const names = leagues.slice(0, n).map((s) => LEAGUE_NAME[s] || s)
    const candidate = `${joinEnglish(names)} Sports Quiz — ${dateKey}`
    if (escaped(candidate) + SUFFIX.length <= TITLE_LIMIT) return candidate
  }
  return `Daily Sports Quiz — ${dateKey}`
}

/** 英文描述 */
export function archiveDescriptionEn(dateKey: string): string {
  const leagues = leaguesFor(dateKey)
  const names = leagues.map((s) => LEAGUE_NAME[s] || s).join(', ')
  return `Five ${names} questions for ${dateKey}. Tap where it happened on the world map.`
}

/** 中文描述 */
export function archiveDescriptionZh(dateKey: string): string {
  const leagues = leaguesFor(dateKey)
  const names = leagues.map((s) => LEAGUE_NAME_ZH[s] || s).join('、')
  return `${dateKey} 的五道${names}地理题。在地图上点出它发生的地方。`
}

/** 存档页 metadata（英文站） */
export function archiveMetadata(dateKey: string): Metadata {
  return {
    title: archiveTitleEn(dateKey),
    description: archiveDescriptionEn(dateKey),
    alternates: {
      canonical: `https://groundgame.app/d/${dateKey}`,
      languages: {
        'en-US': `https://groundgame.app/d/${dateKey}`,
        'zh-CN': `https://groundgame.app/zh/d/${dateKey}`,
        'x-default': `https://groundgame.app/d/${dateKey}`,
      },
    },
  }
}

/** 存档页 metadata（中文站） */
export function archiveMetadataZh(dateKey: string): Metadata {
  return {
    title: archiveTitleZh(dateKey),
    description: archiveDescriptionZh(dateKey),
    alternates: {
      canonical: `https://groundgame.app/zh/d/${dateKey}`,
      languages: {
        'en-US': `https://groundgame.app/d/${dateKey}`,
        'zh-CN': `https://groundgame.app/zh/d/${dateKey}`,
        'x-default': `https://groundgame.app/d/${dateKey}`,
      },
    },
  }
}
