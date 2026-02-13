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
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
}

export function formatDateLabel(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`
}

export function toIso(date: Date): string {
  return date.toISOString()
}

export function toDateInputValue(date: Date): string {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function toTimeInputValue(date: Date): string {
  const h = `${date.getHours()}`.padStart(2, '0')
  const m = `${date.getMinutes()}`.padStart(2, '0')
  return `${h}:${m}`
}

export function parseDateTimeInput(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00`)
}

export function roundToNextHalfHour(base: Date): Date {
  const d = new Date(base)
  d.setSeconds(0, 0)
  const mins = d.getMinutes()
  const delta = mins === 0 || mins === 30 ? 0 : mins < 30 ? 30 - mins : 60 - mins
  d.setMinutes(mins + delta)
  return d
}
