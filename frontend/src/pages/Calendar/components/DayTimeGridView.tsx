import type { CalendarEvent } from '../types'
import { WeekTimeGridView } from './WeekTimeGridView'

type DayTimeGridViewProps = {
  currentDate: Date
  events: CalendarEvent[]
  onPickSlot: (start: Date, end: Date) => void
  onEventClick: (event: CalendarEvent, anchorRect: DOMRect) => void
}

export function DayTimeGridView({ currentDate, events, onPickSlot, onEventClick }: DayTimeGridViewProps) {
  return <WeekTimeGridView currentDate={currentDate} events={events} onPickSlot={onPickSlot} onEventClick={onEventClick} mode="day" />
}
