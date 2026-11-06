import { dateKeyUTC, shiftDateKey } from '@/lib/game'

/** 归档页天数：最近 90 天 */
export const ARCHIVE_DAYS = 90

/** 生成最近 N 天的日期 key 列表（含今天，按倒序） */
export function recentDates(days = ARCHIVE_DAYS): string[] {
  const today = dateKeyUTC()
  const out: string[] = []
  for (let i = 0; i < days; i++) out.push(shiftDateKey(today, -i))
  return out
}

/** 路径式日期校验 */
export function isDateKey(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}
