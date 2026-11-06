/**
 * GroundGame 核心引擎
 *
 * 确定性设计：同一天 + 同一个 gameId → 永远出同一套题。
 * 玩家之间共享题目（可以比成绩），刷新页面不会变题。
 */

export type Scope = 'world' | 'country' | 'city'
export type Sport =
  | 'american football' | 'baseball' | 'basketball' | 'ice hockey'
  | 'soccer' | 'golf' | 'tennis' | 'olympics' | 'racing'
  | 'running' | 'cycling' | 'boxing' | 'rugby' | 'swimming'
  | 'athletics' | 'gymnastics' | 'cricket' | 'bobsled' | 'skiing'
  | 'canadian football' | 'mountaineering' | 'media' | 'music' | 'betting' | 'history'

export interface Question {
  id: string
  prompt: string
  /** 中文题干（lang='zh' 时显示）。缺失则回退到英文 prompt */
  promptZh?: string
  /** 地点背景故事（答对后显示）。缺失则不显示这一块 */
  story?: string
  /** 中文背景故事 */
  storyZh?: string
  answer: string
  lat: number
  lng: number
  scope: Scope
  sport: Sport
  tags: string[]
  /** 城市题的公开视野中心（不泄露答案坐标，只用于把地图视野拉对） */
  viewLat?: number
  viewLng?: number
}

export interface Guess {
  lat: number
  lng: number
}

/** 题目数量 */
export const QUESTIONS_PER_ROUND = 5

// ---------------------------------------------------------------- 距离与评分

const EARTH_RADIUS_KM = 6371
const DEG = Math.PI / 180

/** Haversine 距离（公里） */
export function haversineKm(a: Guess, b: Guess): number {
  const dLat = (b.lat - a.lat) * DEG
  const dLng = (b.lng - a.lng) * DEG
  const lat1 = a.lat * DEG
  const lat2 = b.lat * DEG
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * 难度分档。参考 GeoGuessr / World City Guesser 的常见分档，
 * 但阈值按「城市级定位」重新标定——世界地图上点对城市，误差本来就在百公里级。
 */
export type Difficulty = 'easy' | 'medium' | 'hard' | 'brutal'

export function difficultyFor(km: number): Difficulty {
  if (km < 60) return 'easy'
  if (km < 400) return 'medium'
  if (km < 1500) return 'hard'
  return 'brutal'
}

/** 各档基础分 */
const BASE_SCORE: Record<Difficulty, number> = {
  easy: 1000,
  medium: 600,
  hard: 300,
  brutal: 100,
}

/** 连续答对倍率：越到后面越值钱 */
export function multiplierFor(streak: number): number {
  // streak 0 → 1x, 1 → 1x, 2 → 1.2x, 3 → 1.5x, 4 → 2x, 5+ → 2.5x
  if (streak < 2) return 1
  if (streak === 2) return 1.2
  if (streak === 3) return 1.5
  if (streak === 4) return 2
  return 2.5
}

export interface RoundResult {
  questionId: string
  distanceKm: number
  difficulty: Difficulty
  baseScore: number
  multiplier: number
  score: number
  emoji: string
}

export function scoreGuess(
  question: Question,
  guess: Guess,
  streakBefore: number
): RoundResult {
  const distanceKm = haversineKm(guess, { lat: question.lat, lng: question.lng })
  const difficulty = difficultyFor(distanceKm)
  const baseScore = BASE_SCORE[difficulty]
  const multiplier = multiplierFor(streakBefore)
  return {
    questionId: question.id,
    distanceKm: Math.round(distanceKm),
    difficulty,
    baseScore,
    multiplier,
    score: Math.round(baseScore * multiplier),
    emoji: emojiFor(difficulty),
  }
}

export function emojiFor(d: Difficulty): string {
  switch (d) {
    case 'easy': return '🎯'
    case 'medium': return '👍'
    case 'hard': return '🤔'
    case 'brutal': return '🫠'
  }
}

export function labelFor(d: Difficulty): string {
  switch (d) {
    case 'easy': return 'Nailed it'
    case 'medium': return 'Close'
    case 'hard': return 'Close-ish'
    case 'brutal': return 'Way off'
  }
}

/** 连对判定：命中 easy 或 medium 档（400 km 以内）才算连对，连击倍率才继续涨 */
export function countsForStreak(d: Difficulty): boolean {
  return d === 'easy' || d === 'medium'
}

// ---------------------------------------------------------------- 确定性出题

/** xmur3 + sfc32 伪随机，保证同 seed 同序列 */
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
}

function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0
    let t = (a + b) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    d = (d + 1) | 0
    t = (t + d) | 0
    c = (c + t) | 0
    return (t >>> 0) / 4294967296
  }
}

export function makeRng(seed: string): () => number {
  const h = xmur3(seed)
  return sfc32(h(), h(), h(), h())
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * 生成某一天的题目。
 *
 * 约束（保证题目多样性）：
 *  1. 同一 sport 最多 2 题
 *  2. world scope 至少 `minWorld` 题、至多 `maxWorld` 题
 *     —— 不能全是城市题（全是城市就看不到世界地图了），
 *     也不能全是全球题（那样一局里没有缩放变化）
 *  3. 尽量覆盖 ≥3 个不同 sport
 *
 * 实现：分两轮。第一轮先专门挑 world scope 的题，保证下限；
 * 第二轮补足剩余题位。最后兜底放宽所有约束，保证题数够。
 */
export function dailyRound(
  all: Question[],
  dateKey: string,
  gameId: string,
  count = QUESTIONS_PER_ROUND
): Question[] {
  const rng = makeRng(`${gameId}:${dateKey}`)
  const pool = shuffle(all, rng)
  const picked: Question[] = []
  const sportCount = new Map<string, number>()
  const scopeCount = { world: 0, country: 0, city: 0 }

  const maxPerSport = 2
  const minWorld = Math.min(2, count)
  const maxWorld = Math.max(minWorld, count - 2)

  const take = (q: Question) => {
    picked.push(q)
    sportCount.set(q.sport, (sportCount.get(q.sport) ?? 0) + 1)
    scopeCount[q.scope]++
  }
  const alreadyPicked = (q: Question) => picked.some(p => p.id === q.id)

  // 第一轮：先满足 world scope 的下限
  for (const q of pool) {
    if (scopeCount.world >= minWorld) break
    if (q.scope !== 'world') continue
    if ((sportCount.get(q.sport) ?? 0) >= maxPerSport) continue
    take(q)
  }

  // 第二轮：补足剩余题位
  for (const q of pool) {
    if (picked.length >= count) break
    if (alreadyPicked(q)) continue
    const sc = sportCount.get(q.sport) ?? 0
    if (sc >= maxPerSport) continue
    if (q.scope === 'world' && scopeCount.world >= maxWorld) continue
    // sport 多样性：已选 3 题后不再选已出现过的 sport
    const distinctSports = new Set(picked.map(p => p.sport)).size
    if (distinctSports >= 3 && sc >= 1) continue
    take(q)
  }

  // 兜底：放宽所有约束补足题数
  if (picked.length < count) {
    for (const q of pool) {
      if (picked.length >= count) break
      if (alreadyPicked(q)) continue
      take(q)
    }
  }

  return picked
}

// ---------------------------------------------------------------- 日期工具

/** UTC 日期 key（YYYY-MM-DD），与服务器时区无关，保证全球玩家同题 */
export function dateKeyUTC(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

/** 解析 YYYY-MM-DD → Date（UTC 零点） */
export function parseDateKey(key: string): Date {
  return new Date(key + 'T00:00:00Z')
}

/** 昨天 / 明天（UTC） */
export function shiftDateKey(key: string, days: number): string {
  const d = parseDateKey(key)
  d.setUTCDate(d.getUTCDate() + days)
  return dateKeyUTC(d)
}

// ---------------------------------------------------------------- 本地存储

export interface DailyResult {
  date: string
  totalScore: number
  rounds: RoundResult[]
  streakCurrent: number
  streakBest: number
  completedAt: string
}

export const STORAGE_KEY = 'groundgame.results'
export const USERNAME_KEY = 'groundgame.username'

export function loadResults(): Record<string, DailyResult> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function saveResult(r: DailyResult): void {
  if (typeof window === 'undefined') return
  try {
    const all = loadResults()
    all[r.date] = r
    // 只保留最近 120 天
    const keys = Object.keys(all).sort()
    while (keys.length > 120) delete all[keys.shift()!]
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    /* 存储不可用时静默降级 */
  }
}

export function streakFrom(results: Record<string, DailyResult>, today: string): number {
  let n = 0
  let d = today
  // 今天没玩不算断（从昨天开始算）
  if (!results[d]) d = shiftDateKey(d, -1)
  while (results[d]) {
    n++
    d = shiftDateKey(d, -1)
  }
  return n
}

// ---------------------------------------------------------------- 地图投影

/**
 * 等距圆柱投影（Equirectangular）。够用且零依赖。
 * x: -180..180 → 0..1, y: 90..-90 → 0..1
 */
export function project(lat: number, lng: number): { x: number; y: number } {
  return {
    x: (lng + 180) / 360,
    y: (90 - lat) / 360,
  }
}

/** 反投影 */
export function unproject(x: number, y: number): { lat: number; lng: number } {
  return {
    lat: 90 - y * 360,
    lng: x * 360 - 180,
  }
}

/** 猜测是否落在合法范围内（防止点到地图外） */
export function isValidGuess(g: Guess): boolean {
  return (
    Number.isFinite(g.lat) && Number.isFinite(g.lng) &&
    g.lat >= -90 && g.lat <= 90 && g.lng >= -180 && g.lng <= 180
  )
}
