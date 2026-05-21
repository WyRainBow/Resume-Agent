import { Clock } from "lucide-react";
import { useEffect, useState } from "react";

function formatParseElapsed(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function getParseElapsedColor(ms: number): string {
  if (ms < 2000) return "text-emerald-600 dark:text-emerald-400";
  if (ms < 5000) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
}

interface ParseImportTimerBadgeProps {
  startedAt?: number;
  elapsedMs?: number;
  active?: boolean;
}

/** 粘贴导入解析计时徽章（与 AIImportModal 计时风格一致） */
export function ParseImportTimerBadge({
  startedAt,
  elapsedMs,
  active = false,
}: ParseImportTimerBadgeProps) {
  const [displayMs, setDisplayMs] = useState(elapsedMs ?? 0);

  useEffect(() => {
    if (!active || !startedAt) {
      if (elapsedMs != null) {
        setDisplayMs(elapsedMs);
      }
      return;
    }

    const tick = () => setDisplayMs(Date.now() - startedAt);
    tick();
    const timerId = window.setInterval(tick, 100);
    return () => window.clearInterval(timerId);
  }, [active, startedAt, elapsedMs]);

  if (!startedAt && elapsedMs == null) {
    return null;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-chat-border/80 bg-chat-canvas px-2.5 py-0.5 text-xs font-semibold tabular-nums shadow-sm dark:border-slate-700 dark:bg-slate-800 ${getParseElapsedColor(displayMs)}`}
      title={active ? "解析进行中" : "解析耗时"}
      aria-live="polite"
    >
      <Clock className="h-3 w-3 shrink-0" />
      {formatParseElapsed(displayMs)}
    </span>
  );
}
