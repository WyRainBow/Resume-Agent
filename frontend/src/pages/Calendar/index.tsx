import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import WorkspaceLayout from '@/pages/WorkspaceLayout'
import { useAuth } from '@/contexts/AuthContext'
import { createCalendarEvent, deleteCalendarEvent, listCalendarEvents, updateCalendarEvent, type CalendarView } from '@/services/calendarApi'
import { CalendarAIImportModal } from './components/CalendarAIImportModal'
import { CalendarShell } from './components/CalendarShell'
import { CreateScheduleModal } from './components/CreateScheduleModal'
import { DayTimeGridView } from './components/DayTimeGridView'
import { EventDetailPopover } from './components/EventDetailPopover'
import { MiniMonthPanel } from './components/MiniMonthPanel'
import { InterviewListView } from './components/InterviewListView'
import { MonthGridView } from './components/MonthGridView'
import { WeekTimeGridView } from './components/WeekTimeGridView'
import { addDays, addMonths, formatDateLabel, formatMonthTitle, getMonthGridRange, roundToNextHalfHour, startOfDay, startOfWeek, toIso } from './dateUtils'
import type { CalendarEvent, CalendarRange, DraftSlot } from './types'

/** 有面试视图：前后各 365 天，即「所有的」 */
const INTERVIEWS_VIEW_DAYS = 365

function getRangeForView(view: CalendarView, cursor: Date): CalendarRange {
  if (view === 'month') return getMonthGridRange(cursor)
  if (view === 'week') {
    const start = startOfWeek(cursor)
    return { start, end: addDays(start, 7) }
  }
  if (view === 'interviews') {
    const center = startOfDay(cursor)
    return { start: addDays(center, -INTERVIEWS_VIEW_DAYS), end: addDays(center, INTERVIEWS_VIEW_DAYS) }
  }
  const start = startOfDay(cursor)
  return { start, end: addDays(start, 1) }
}

function formatRangeTitle(view: CalendarView, cursor: Date): string {
  if (view === 'month') return formatMonthTitle(cursor)
  if (view === 'week') {
    const start = startOfWeek(cursor)
    const end = addDays(start, 6)
    return `${formatDateLabel(start)} - ${formatDateLabel(end)}`
  }
  if (view === 'interviews') {
    return '有面试的日程 · 所有的'
  }
  return `${cursor.getFullYear()}年${cursor.getMonth() + 1}月${cursor.getDate()}日`
}

export default function CalendarPage() {
  const { isAuthenticated, openModal } = useAuth()
  const [view, setView] = useState<CalendarView>('week')
  const [cursor, setCursor] = useState<Date>(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [aiImportOpen, setAiImportOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailAnchorRect, setDetailAnchorRect] = useState<DOMRect | null>(null)
  const [draftSlot, setDraftSlot] = useState<DraftSlot>(() => {
    const start = roundToNextHalfHour(new Date())
    const end = new Date(start)
    end.setMinutes(end.getMinutes() + 30)
    return { start, end }
  })
  const [draftPrefill, setDraftPrefill] = useState<{
    title?: string
    location?: string
    notes?: string
    isAllDay?: boolean
  } | null>(null)

  const range = useMemo(() => getRangeForView(view, cursor), [view, cursor])
  const rangeTitle = useMemo(() => formatRangeTitle(view, cursor), [view, cursor])

  const refreshEvents = async () => {
    const refreshed = await listCalendarEvents(toIso(range.start), toIso(range.end))
    setEvents(refreshed)
    if (selectedEvent) {
      const updatedSelected = refreshed.find((item) => item.id === selectedEvent.id) || null
      setSelectedEvent(updatedSelected)
      if (!updatedSelected) setDetailOpen(false)
    }
  }

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      openModal('login')
      return
    }
    let alive = true
    const load = async () => {
      setLoading(true)
      try {
        const data = await listCalendarEvents(toIso(range.start), toIso(range.end))
        if (!alive) return
        setEvents(data)
        if (selectedEvent) {
          const updatedSelected = data.find((item) => item.id === selectedEvent.id) || null
          setSelectedEvent(updatedSelected)
          if (!updatedSelected) setDetailOpen(false)
        }
      } catch (err) {
        console.error(err)
        if (!alive) return
        setEvents([])
      } finally {
        if (alive) setLoading(false)
      }
    }
    void load()
    return () => {
      alive = false
    }
  }, [isAuthenticated, openModal, range.end, range.start])

  const openCreateWithSlot = (slot?: DraftSlot) => {
    if (slot) {
      setDraftSlot(slot)
    } else {
      const start = roundToNextHalfHour(new Date())
      const end = new Date(start)
      end.setMinutes(end.getMinutes() + 30)
      setDraftSlot({ start, end })
    }
    setDraftPrefill(null)
    setEditMode(false)
    setModalOpen(true)
  }

  const changePeriod = (delta: number) => {
    if (view === 'month') {
      setCursor((prev) => addMonths(prev, delta))
      return
    }
    if (view === 'week') {
      setCursor((prev) => addDays(prev, delta * 7))
      return
    }
    if (view === 'interviews') {
      setCursor((prev) => addDays(prev, delta * INTERVIEWS_VIEW_DAYS))
      return
    }
    setCursor((prev) => addDays(prev, delta))
  }

  return (
    <WorkspaceLayout>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="h-full">
        <CalendarShell
          view={view}
          rangeTitle={rangeTitle}
          onChangeView={(v) => {
            setView(v)
            if (v === 'interviews') setCursor(new Date())
          }}
          onPrev={() => changePeriod(-1)}
          onNext={() => changePeriod(1)}
          onToday={() => setCursor(new Date())}
          onOpenCreate={() => openCreateWithSlot()}
          onOpenAiImport={() => setAiImportOpen(true)}
          left={
            <MiniMonthPanel
              currentDate={cursor}
              events={events}
              onPickDate={(date) => {
                setCursor(date)
                setView('day')
              }}
              onNavigateMonth={(delta) => setCursor((prev) => addMonths(prev, delta))}
            />
          }
          content={
            loading ? (
              <div className="flex h-full items-center justify-center text-slate-500">加载日历数据中...</div>
            ) : view === 'interviews' ? (
              <InterviewListView
                events={events}
                onEventClick={(event, anchorRect) => {
                  setSelectedEvent(event)
                  setDetailAnchorRect(anchorRect)
                  setDetailOpen(true)
                }}
              />
            ) : view === 'month' ? (
              <MonthGridView
                currentDate={cursor}
                events={events}
                onSelectDate={(date) => setCursor(date)}
                onEventClick={(event, anchorRect) => {
                  setSelectedEvent(event)
                  setDetailAnchorRect(anchorRect)
                  setDetailOpen(true)
                }}
              />
            ) : view === 'week' ? (
              <WeekTimeGridView
                currentDate={cursor}
                events={events}
                mode="week"
                onPickSlot={(start, end) => openCreateWithSlot({ start, end })}
                onEventClick={(event, anchorRect) => {
                  setSelectedEvent(event)
                  setDetailAnchorRect(anchorRect)
                  setDetailOpen(true)
                }}
              />
            ) : (
              <DayTimeGridView
                currentDate={cursor}
                events={events}
                onPickSlot={(start, end) => openCreateWithSlot({ start, end })}
                onEventClick={(event, anchorRect) => {
                  setSelectedEvent(event)
                  setDetailAnchorRect(anchorRect)
                  setDetailOpen(true)
                }}
              />
            )
          }
        />
      </motion.div>

      <EventDetailPopover
        open={detailOpen}
        event={selectedEvent}
        anchorRect={detailAnchorRect}
        onClose={() => {
          setDetailOpen(false)
          setDetailAnchorRect(null)
        }}
        onEdit={() => {
          if (!selectedEvent) return
          setDraftSlot({
            start: new Date(selectedEvent.starts_at),
            end: new Date(selectedEvent.ends_at),
          })
          setEditMode(true)
          setModalOpen(true)
          setDetailOpen(false)
          setDetailAnchorRect(null)
        }}
        onDelete={async () => {
          if (!selectedEvent) return
          if (!window.confirm(`确定删除日程「${selectedEvent.title}」吗？`)) return
          try {
            await deleteCalendarEvent(selectedEvent.id)
            setDetailOpen(false)
            setDetailAnchorRect(null)
            setSelectedEvent(null)
            await refreshEvents()
          } catch (error: unknown) {
            const maybeAxios = error as { response?: { data?: { detail?: string } }; message?: string }
            const detail = maybeAxios.response?.data?.detail
            alert(typeof detail === 'string' && detail.trim() ? `删除失败：${detail}` : `删除失败：${maybeAxios.message || '请稍后重试'}`)
          }
        }}
      />

      <CreateScheduleModal
        open={modalOpen}
        defaultStart={draftSlot.start}
        defaultEnd={draftSlot.end}
        mode={editMode ? 'edit' : 'create'}
        initialTitle={(editMode ? selectedEvent?.title : draftPrefill?.title) || ''}
        initialLocation={(editMode ? selectedEvent?.location : draftPrefill?.location) || ''}
        initialNotes={(editMode ? selectedEvent?.notes : draftPrefill?.notes) || ''}
        initialIsAllDay={Boolean((editMode ? selectedEvent?.is_all_day : draftPrefill?.isAllDay) || false)}
        onClose={() => setModalOpen(false)}
        onSubmit={async ({ title, startsAt, endsAt, isAllDay, location, notes }) => {
          try {
            if (editMode && selectedEvent) {
              await updateCalendarEvent(selectedEvent.id, {
                title,
                starts_at: startsAt.toISOString(),
                ends_at: endsAt.toISOString(),
                is_all_day: isAllDay,
                location: location || null,
                notes: notes || null,
                color: selectedEvent.color || '#8ab4ff',
              })
            } else {
              await createCalendarEvent({
                title,
                starts_at: startsAt.toISOString(),
                ends_at: endsAt.toISOString(),
                is_all_day: isAllDay,
                location: location || null,
                notes: notes || null,
                color: '#8ab4ff',
              })
            }
            await refreshEvents()
            setModalOpen(false)
            setEditMode(false)
            setDraftPrefill(null)
          } catch (error: unknown) {
            const maybeAxios = error as { response?: { data?: { detail?: string } }; message?: string }
            const detail = maybeAxios.response?.data?.detail
            throw new Error(typeof detail === 'string' && detail.trim() ? detail : maybeAxios.message || '保存失败')
          }
        }}
      />

      <CalendarAIImportModal
        open={aiImportOpen}
        onClose={() => setAiImportOpen(false)}
        onApply={({ title, startsAt, endsAt, isAllDay, location, notes }) => {
          setDraftSlot({ start: startsAt, end: endsAt })
          setDraftPrefill({ title, location, notes, isAllDay })
          setEditMode(false)
          setAiImportOpen(false)
          setModalOpen(true)
        }}
      />
    </WorkspaceLayout>
  )
}
