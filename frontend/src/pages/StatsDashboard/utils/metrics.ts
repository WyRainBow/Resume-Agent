import type { SavedResume } from '@/services/storage/StorageAdapter'
import type { ApplicationProgressEntry } from '@/services/applicationProgressApi'

type MetricsEntry = Pick<ApplicationProgressEntry, 'progress' | 'application_date'>

export type DashboardKpis = {
  resumeCount: number
  applicationCount: number
  last7DaysCount: number
  activePipelineCount: number
  /** 本周（周一至今）投递份数 */
  thisWeekApplicationCount: number
  /** 本周（周一至今）活跃流程数 */
  activePipelineThisWeekCount: number
}

export type DailyTrendPoint = {
  label: string
  value: number
}

export type ProgressDistributionItem = {
  label: string
  value: number
  color: string
}

const STATUS_ALIAS: Record<string, string> = {
  已投递: '已投简历',
  offer: '二面完成',
  笔试: '测评完成',
  一面: '一面完成',
  二面: '二面完成',
  三面: '二面完成',
}

// 高对比度配色，便于在饼图中区分
const STATUS_COLORS: Record<string, string> = {
  已投简历: '#5B8FCE',   // 中蓝
  简历挂: '#E85A5A',     // 红
  测评未做: '#4DB8E8',   // 天蓝
  测评完成: '#E8B84A',   // 橙黄
  等待一面: '#2DB89E',   // 青绿
  一面完成: '#D96B9A',   // 玫红
  一面被刷: '#6BB86B',   // 绿
  等待二面: '#8B7BC8',   // 紫
  二面完成: '#C86BB8',   // 紫红
  二面被刷: '#8BC84D',   // 黄绿
  未设置: '#94A3B8',     // 灰蓝
  面试: '#F59E0B',       // 琥珀/橙，与蓝色系明显区分
}

const INACTIVE_STATUSES = new Set(['简历挂', '一面被刷', '二面被刷'])

function normalizeStatus(raw: string | null | undefined): string {
  const value = (raw || '').trim()
  if (!value) return '未设置'
  return STATUS_ALIAS[value] || value
}

function parseDate(dateValue: string | null | undefined): Date | null {
  if (!dateValue) return null
  const value = dateValue.trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  const dt = new Date(y, mo, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null
  return dt
}

function startOfDay(dt: Date): Date {
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
}

export function buildKpis(resumes: SavedResume[], entries: MetricsEntry[]): DashboardKpis {
  const resumeCount = Array.isArray(resumes) ? resumes.length : 0
  const today = startOfDay(new Date())
  const start = new Date(today)
  start.setDate(start.getDate() - 6)

  const last7DaysCount = entries.reduce((sum, entry) => {
    const dt = parseDate(entry.application_date)
    if (!dt) return sum
    const day = startOfDay(dt)
    if (day >= start && day <= today) return sum + 1
    return sum
  }, 0)

  const activePipelineCount = entries.reduce((sum, entry) => {
    const status = normalizeStatus(entry.progress)
    if (status === '未设置') return sum
    if (INACTIVE_STATUSES.has(status)) return sum
    return sum + 1
  }, 0)

  const { thisWeekApplicationCount, activePipelineThisWeekCount } = getThisWeekCounts(entries)
  return {
    resumeCount,
    applicationCount: entries.length,
    last7DaysCount,
    activePipelineCount,
    thisWeekApplicationCount,
    activePipelineThisWeekCount,
  }
}

/** 本周一 0 点（本地），与日历周一致 */
function getWeekStart(today: Date): Date {
  const d = new Date(today)
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  return startOfDay(d)
}

/** 本周日 0 点（即整周最后一天的日期），与日历「本周」一致 */
function getWeekEnd(today: Date): Date {
  const start = getWeekStart(today)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  return startOfDay(end)
}

function getThisWeekCounts(entries: MetricsEntry[]): { thisWeekApplicationCount: number; activePipelineThisWeekCount: number } {
  const today = startOfDay(new Date())
  const weekStart = getWeekStart(today)
  const weekEnd = getWeekEnd(today)

  let thisWeekApplicationCount = 0
  let activePipelineThisWeekCount = 0
  for (const entry of entries) {
    const dt = parseDate(entry.application_date)
    if (!dt) continue
    const day = startOfDay(dt)
    if (day < weekStart || day > weekEnd) continue
    thisWeekApplicationCount += 1
    const status = normalizeStatus(entry.progress)
    if (status !== '未设置' && !INACTIVE_STATUSES.has(status)) activePipelineThisWeekCount += 1
  }
  return { thisWeekApplicationCount, activePipelineThisWeekCount }
}

export function buildKpisFromCount(resumeCount: number, entries: MetricsEntry[]): DashboardKpis {
  const today = startOfDay(new Date())
  const start = new Date(today)
  start.setDate(start.getDate() - 6)

  const last7DaysCount = entries.reduce((sum, entry) => {
    const dt = parseDate(entry.application_date)
    if (!dt) return sum
    const day = startOfDay(dt)
    if (day >= start && day <= today) return sum + 1
    return sum
  }, 0)

  const activePipelineCount = entries.reduce((sum, entry) => {
    const status = normalizeStatus(entry.progress)
    if (status === '未设置') return sum
    if (INACTIVE_STATUSES.has(status)) return sum
    return sum + 1
  }, 0)

  const { thisWeekApplicationCount, activePipelineThisWeekCount } = getThisWeekCounts(entries)
  return {
    resumeCount,
    applicationCount: entries.length,
    last7DaysCount,
    activePipelineCount,
    thisWeekApplicationCount,
    activePipelineThisWeekCount,
  }
}

export function buildDailyTrend(entries: MetricsEntry[]): DailyTrendPoint[] {
  const today = startOfDay(new Date())
  const days = Array.from({ length: 7 }, (_, idx) => {
    const dt = new Date(today)
    dt.setDate(today.getDate() - (6 - idx))
    return dt
  })

  const counter = new Map<string, number>()
  for (const entry of entries) {
    const dt = parseDate(entry.application_date)
    if (!dt) continue
    const key = dt.toISOString().slice(0, 10)
    counter.set(key, (counter.get(key) || 0) + 1)
  }

  return days.map((day) => {
    const key = day.toISOString().slice(0, 10)
    return {
      label: `${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`,
      value: counter.get(key) || 0,
    }
  })
}

export function buildProgressDistribution(
  entries: MetricsEntry[],
  interviewCount: number = 0
): ProgressDistributionItem[] {
  const grouped = new Map<string, number>()
  for (const entry of entries) {
    const status = normalizeStatus(entry.progress)
    grouped.set(status, (grouped.get(status) || 0) + 1)
  }
  if (interviewCount > 0) {
    grouped.set('面试', interviewCount)
  }

  const items = Array.from(grouped.entries())
    .map(([label, value]) => ({
      label,
      value,
      color: STATUS_COLORS[label] || '#CBD5E1',
    }))
    .sort((a, b) => b.value - a.value)

  return items
}

/** 本周（周一至周日，与日历一致）进展状态分布，用于「本周进展状态分布」图 */
export function buildProgressDistributionThisWeek(
  entries: MetricsEntry[],
  interviewCountThisWeek: number = 0
): ProgressDistributionItem[] {
  const today = startOfDay(new Date())
  const weekStart = getWeekStart(today)
  const weekEnd = getWeekEnd(today)
  const grouped = new Map<string, number>()
  for (const entry of entries) {
    const dt = parseDate(entry.application_date)
    if (!dt) continue
    const day = startOfDay(dt)
    if (day < weekStart || day > weekEnd) continue
    const status = normalizeStatus(entry.progress)
    grouped.set(status, (grouped.get(status) || 0) + 1)
  }
  if (interviewCountThisWeek > 0) {
    grouped.set('面试', interviewCountThisWeek)
  }

  const items = Array.from(grouped.entries())
    .map(([label, value]) => ({
      label,
      value,
      color: STATUS_COLORS[label] || '#CBD5E1',
    }))
    .sort((a, b) => b.value - a.value)

  return items
}
