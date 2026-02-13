import type { SavedResume } from '@/services/storage/StorageAdapter'
import type { ApplicationProgressEntry } from '@/services/applicationProgressApi'

type MetricsEntry = Pick<ApplicationProgressEntry, 'progress' | 'application_date'>

export type DashboardKpis = {
  resumeCount: number
  applicationCount: number
  last7DaysCount: number
  activePipelineCount: number
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

const STATUS_COLORS: Record<string, string> = {
  已投简历: '#C9D8F2',
  简历挂: '#FF7373',
  测评未做: '#9BDCFD',
  测评完成: '#F7E8AE',
  等待一面: '#A9E7DC',
  一面完成: '#F5D9DD',
  一面被刷: '#AFE1A6',
  等待二面: '#D9CCF4',
  二面完成: '#EECDE8',
  二面被刷: '#D4E68D',
  未设置: '#CBD5E1',
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

  return {
    resumeCount,
    applicationCount: entries.length,
    last7DaysCount,
    activePipelineCount,
  }
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

  return {
    resumeCount,
    applicationCount: entries.length,
    last7DaysCount,
    activePipelineCount,
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

export function buildProgressDistribution(entries: MetricsEntry[]): ProgressDistributionItem[] {
  const grouped = new Map<string, number>()
  for (const entry of entries) {
    const status = normalizeStatus(entry.progress)
    grouped.set(status, (grouped.get(status) || 0) + 1)
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
