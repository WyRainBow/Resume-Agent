import { useMemo } from "react";
import { CheckCircle2, Circle, CircleX, LoaderCircle, Wrench } from "lucide-react";
import ThoughtProcess from "@/components/chat/ThoughtProcess";
import type { AgentProcessNode } from "@/types/chat";
import type { PresentedProcessNode } from "@/agent-presentation/ConversationPresentation";

interface AgentProcessTimelineProps {
  nodes: AgentProcessNode[];
  isProcessing?: boolean;
  className?: string;
  onLatestThoughtPresented?: () => void;
  presentationNodes?: PresentedProcessNode[];
  onProcessSegmentPresented?: (nodeId: string) => void;
}

type ToolProcessNode = Extract<AgentProcessNode, { kind: "tool" }>;

function ToolProcessCard({
  node,
}: {
  node: ToolProcessNode;
}) {
  const isRunning = node.status === "running";
  const isError = node.status === "error";
  const progress = isRunning ? node.progress : undefined;
  const progressPercent = progress
    ? Math.min(92, Math.max(8, ((progress.current - 0.25) / progress.total) * 100))
    : 0;
  const StatusIcon = isRunning ? LoaderCircle : isError ? CircleX : CheckCircle2;
  return (
    <div
      data-tool-call-id={node.toolCallId}
      className="flex items-start gap-3 rounded-xl border border-chat-border/70 bg-chat-surface px-3.5 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
    >
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-chat-canvas text-chat-accent dark:bg-slate-800">
        {isRunning ? (
          <StatusIcon className="size-4 animate-spin" />
        ) : (
          <StatusIcon className={`size-4 ${isError ? "text-rose-500" : "text-emerald-600"}`} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-medium text-chat-ink dark:text-slate-100">
            <Wrench className="size-3.5 text-chat-ink-muted" />
            {node.label}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              isRunning
                ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300"
                : isError
                  ? "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"
                  : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
            }`}
          >
            {progress
              ? `诊断中 ${progress.current}/${progress.total}`
              : isRunning
                ? "执行中"
                : isError
                  ? "执行失败"
                  : "执行成功"}
          </span>
        </div>
        {progress && (
          <div className="mt-3 space-y-2.5">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-chat-ink dark:text-slate-100">
                当前：{progress.label}
              </span>
              <span className="text-chat-ink-muted">正在逐项核对</span>
            </div>
            <div
              role="progressbar"
              aria-label="简历诊断进度"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={progress.current}
              aria-valuetext={`第 ${progress.current}/${progress.total} 阶段正在进行，报告尚未完成`}
              className="h-1.5 overflow-hidden rounded-full bg-chat-canvas dark:bg-slate-800"
            >
              <div
                className="h-full rounded-full bg-chat-accent transition-[width] duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {progress.stages.map((stage, index) => {
                const completed = index < progress.current - 1;
                const active = index === progress.current - 1;
                const StageIcon = completed
                  ? CheckCircle2
                  : active
                    ? LoaderCircle
                    : Circle;
                return (
                  <span
                    key={stage}
                    className={`inline-flex items-center gap-1.5 text-[11px] ${
                      completed
                        ? "text-emerald-700 dark:text-emerald-300"
                        : active
                          ? "font-medium text-chat-accent"
                          : "text-chat-ink-muted/60"
                    }`}
                  >
                    <StageIcon
                      className={`size-3.5 shrink-0 ${active ? "animate-spin" : ""}`}
                    />
                    {stage}
                  </span>
                );
              })}
            </div>
            <p className="rounded-lg bg-chat-canvas/70 px-2.5 py-2 text-xs leading-relaxed text-chat-ink-muted dark:bg-slate-800/60">
              {progress.summary}
            </p>
          </div>
        )}
        {node.summary && (
          <p className="mt-1 text-xs leading-relaxed text-chat-ink-muted">
            {node.summary}
          </p>
        )}
      </div>
    </div>
  );
}

export default function AgentProcessTimeline({
  nodes,
  isProcessing = false,
  className = "",
  onLatestThoughtPresented,
  presentationNodes,
  onProcessSegmentPresented,
}: AgentProcessTimelineProps) {
  const latestThoughtIndex = useMemo(() => {
    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      if (nodes[index].kind === "thought") return index;
    }
    return -1;
  }, [nodes]);
  const latestThought = latestThoughtIndex >= 0 ? nodes[latestThoughtIndex] : null;
  const presentationById = useMemo(
    () => new Map(presentationNodes?.map((node) => [node.id, node])),
    [presentationNodes],
  );
  const presentationManaged = presentationNodes !== undefined;

  if (nodes.length === 0) return null;

  return (
    <div className={`space-y-2.5 ${className}`}>
      {nodes.map((node, index) => {
        if (node.kind === "thought") {
          const presentationNode = presentationById.get(node.id);
          const isActive = presentationManaged
            ? presentationNode?.presentationStatus === "typing" ||
              presentationNode?.presentationStatus === "draining"
            : isProcessing && index === latestThoughtIndex;
          const drain = presentationManaged
            ? presentationNode?.presentationStatus === "draining"
            : false;
          return (
            <ThoughtProcess
              key={node.id}
              content={node.content}
              isStreaming={isActive}
              isLatest={isActive}
              defaultExpanded={isActive}
              className="mb-0"
              animateText={isActive}
              drain={drain}
              onDrainComplete={() => {
                onProcessSegmentPresented?.(node.id);
              }}
              onPresented={
                isActive
                  ? () => {
                      onProcessSegmentPresented?.(node.id);
                      onLatestThoughtPresented?.();
                    }
                  : undefined
              }
            />
          );
        }

        const presentationNode = presentationById.get(node.id);
        if (
          presentationManaged &&
          presentationNode?.presentationStatus === "hidden"
        ) {
          return null;
        }

        return (
          <ToolProcessCard
            key={node.id}
            node={node}
          />
        );
      })}
    </div>
  );
}
