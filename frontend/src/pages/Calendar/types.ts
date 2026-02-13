import type { CalendarEvent, CalendarView } from '@/services/calendarApi'

export type { CalendarEvent, CalendarView }

export type CalendarRange = {
  start: Date
  end: Date
}

export type DraftSlot = {
  start: Date
  end: Date
}
