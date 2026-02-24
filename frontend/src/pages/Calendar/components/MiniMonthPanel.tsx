import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  addDays,
  formatMonthTitle,
  getMonthGridRange,
  isSameChinaDay,
  startOfDay,
} from "../dateUtils";
import type { CalendarEvent } from "../types";

type MiniMonthPanelProps = {
  currentDate: Date;
  events: CalendarEvent[];
  onPickDate: (date: Date) => void;
  onNavigateMonth: (delta: number) => void;
};

const WEEK_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

export function MiniMonthPanel({
  currentDate,
  events,
  onPickDate,
  onNavigateMonth,
}: MiniMonthPanelProps) {
  const { start } = getMonthGridRange(currentDate);
  const today = startOfDay(new Date());
  const hasEventOnDay = (day: Date) =>
    events.some((ev) => isSameChinaDay(new Date(ev.starts_at), day));

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <button
          className="rounded-md px-2 py-1 text-lg font-semibold text-slate-700 hover:bg-slate-100"
          type="button"
        >
          {formatMonthTitle(currentDate)}
        </button>
        <div className="flex gap-1">
          <button
            type="button"
            className="rounded-md p-1 hover:bg-slate-100"
            onClick={() => onNavigateMonth(-1)}
          >
            <ChevronLeft className="h-4 w-4 text-slate-500" />
          </button>
          <button
            type="button"
            className="rounded-md p-1 hover:bg-slate-100"
            onClick={() => onNavigateMonth(1)}
          >
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7 text-center text-xs font-semibold text-slate-400">
        {WEEK_LABELS.map((label) => (
          <div key={label} className="py-1">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {Array.from({ length: 42 }).map((_, idx) => {
          const day = addDays(start, idx);
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const isToday = startOfDay(day).getTime() === today.getTime();
          const isSelected =
            startOfDay(day).getTime() === startOfDay(currentDate).getTime();
          const hasEvent = hasEventOnDay(day);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onPickDate(day)}
              className={`mx-auto flex h-10 w-10 flex-col items-center justify-center rounded-full text-base transition ${
                isSelected
                  ? "bg-slate-900 text-white"
                  : isToday
                    ? "bg-slate-100 text-slate-900"
                    : isCurrentMonth
                      ? "text-slate-700 hover:bg-slate-100"
                      : "text-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className="leading-none">{day.getDate()}</span>
              {hasEvent && (
                <span
                  className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${isSelected ? "bg-white" : "bg-slate-400"}`}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
