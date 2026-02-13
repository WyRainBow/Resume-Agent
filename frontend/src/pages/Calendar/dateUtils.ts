const CHINA_TZ = 'Asia/Shanghai'

function getChinaParts(date: Date): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: CHINA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const parts = formatter.formatToParts(date)
  const pick = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value || '0')
  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: pick('hour'),
    minute: pick('minute'),
  }
}

export function isSameChinaDay(lhs: Date, rhs: Date): boolean {
  const a = getChinaParts(lhs)
  const b = getChinaParts(rhs)
  return a.year === b.year && a.month === b.month && a.day === b.day
}

export function getChinaHourMinute(date: Date): { hour: number; minute: number } {
  const { hour, minute } = getChinaParts(date)
  return { hour, minute }
}

export function formatChinaTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', {
    timeZone: CHINA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfDay(date: Date): Date {
  const d = startOfDay(date)
  d.setDate(d.getDate() + 1)
  return d
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function startOfWeek(date: Date): Date {
  const d = startOfDay(date)
  const day = d.getDay()
  return addDays(d, -day)
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

export function getMonthGridRange(currentDate: Date): { start: Date; end: Date } {
  const first = startOfMonth(currentDate)
  const start = startOfWeek(first)
  const end = addDays(start, 42)
  return { start, end }
}

export function formatMonthTitle(date: Date): string {
  const { year, month } = getChinaParts(date)
  return `${year}年${month}月`
}

export function formatDateLabel(date: Date): string {
  const { month, day } = getChinaParts(date)
  return `${month}月${day}日`
}

export function toIso(date: Date): string {
  return date.toISOString()
}

export function toDateInputValue(date: Date): string {
  const { year, month, day } = getChinaParts(date)
  const y = year
  const m = `${month}`.padStart(2, '0')
  const d = `${day}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function toTimeInputValue(date: Date): string {
  const { hour, minute } = getChinaHourMinute(date)
  const h = `${hour}`.padStart(2, '0')
  const m = `${minute}`.padStart(2, '0')
  return `${h}:${m}`
}

export function parseDateTimeInput(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map((v) => Number(v))
  const [hour, minute] = timeStr.split(':').map((v) => Number(v))
  const utcMillis = Date.UTC(year, month - 1, day, hour - 8, minute, 0, 0)
  return new Date(utcMillis)
}

export function roundToNextHalfHour(base: Date): Date {
  const d = new Date(base)
  d.setSeconds(0, 0)
  const mins = d.getMinutes()
  const delta = mins === 0 || mins === 30 ? 0 : mins < 30 ? 30 - mins : 60 - mins
  d.setMinutes(mins + delta)
  return d
}
