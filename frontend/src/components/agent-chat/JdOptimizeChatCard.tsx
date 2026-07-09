import { useRef, useState } from "react";
import { Upload, FileText, Target, Wand2, CheckCircle2, X, Loader2 } from "lucide-react";

/**
 * 对话内「按 JD 优化简历」交互卡（#62）。
 * 第一步：拿到简历（会话已加载则直接用，否则上传 PDF/Word/TXT/图片 或粘贴文本）。
 * 第二步：粘贴目标岗位 JD。
 * 「开始优化」→ 交给上层：简历已进 context 后，带 JD 让 Agent 逐条对齐改写。
 */
export interface JdOptimizeChatCardProps {
  resumeLoaded: boolean;
  resumeName?: string;
  /** 正在导入简历 / 处理中，禁用交互 */
  busy?: boolean;
  onUploadResumeFile: (file: File) => void;
  onPasteResumeText: (text: string) => void;
  onStartOptimize: (jdText: string) => void;
  onDismiss?: () => void;
}

export function JdOptimizeChatCard({
  resumeLoaded,
  resumeName,
  busy = false,
  onUploadResumeFile,
  onPasteResumeText,
  onStartOptimize,
  onDismiss,
}: JdOptimizeChatCardProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [jdText, setJdText] = useState("");

  const canStart = resumeLoaded && jdText.trim().length >= 10 && !busy;

  return (
    <div className="chat-message-enter relative rounded-none border-2 border-black bg-chat-surface p-5 shadow-[3px_3px_0px_0px_#000000] dark:border-white dark:bg-slate-900 dark:shadow-[3px_3px_0px_0px_#ffffff]">
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="关闭"
          className="absolute right-3 top-3 rounded-none p-1 text-chat-ink-muted/60 transition-colors hover:bg-chat-user-bubble hover:text-chat-ink dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <div className="flex items-center gap-2">
        <Target className="h-5 w-5 text-chat-accent" strokeWidth={2.25} />
        <h3 className="text-base font-bold text-chat-ink dark:text-slate-100">按 JD 优化简历</h3>
      </div>
      <p className="mt-1 text-sm text-chat-ink-muted">
        给我你的简历 + 目标岗位 JD，我帮你逐条对齐、重写亮点、补齐匹配关键词。
      </p>

      {/* 第一步：简历 */}
      <div className="mt-4 rounded-none border border-black/70 p-4 dark:border-slate-700/70">
        <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-chat-ink dark:text-slate-200">
          <FileText className="h-4 w-4 text-chat-ink-muted" />
          第一步 · 你的简历
        </div>

        {resumeLoaded ? (
          <div className="flex items-center gap-2 rounded-none border border-emerald-600 bg-emerald-50/60 px-3 py-2.5 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            <span className="text-chat-ink dark:text-slate-100">
              已加载简历{resumeName ? `「${resumeName}」` : ""}，将用它来优化
            </span>
          </div>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-1.5 rounded-none border-2 border-dashed border-black py-6 text-chat-ink-muted transition-colors hover:text-chat-ink disabled:opacity-50 dark:border-slate-600"
            >
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin text-chat-accent" />
              ) : (
                <Upload className="h-5 w-5" />
              )}
              <span className="text-sm font-medium">{busy ? "正在解析简历…" : "点击上传或拖拽文件"}</span>
              <span className="text-xs text-chat-ink-muted/70">支持 PDF、Word、TXT、图片</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.doc,.docx,image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUploadResumeFile(f);
                e.target.value = "";
              }}
            />

            {!pasteOpen ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setPasteOpen(true)}
                className="mt-2 w-full rounded-none border border-black py-2 text-sm font-medium text-chat-ink transition-colors disabled:opacity-50 dark:border-slate-700"
              >
                或直接粘贴简历文本
              </button>
            ) : (
              <div className="mt-2">
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={4}
                  placeholder="把简历内容粘贴进来…"
                  className="w-full resize-none rounded-none border border-black bg-chat-canvas px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-chat-accent/30 dark:border-slate-700 dark:bg-slate-950"
                />
                <button
                  type="button"
                  disabled={busy || pasteText.trim().length < 10}
                  onClick={() => {
                    onPasteResumeText(pasteText.trim());
                    setPasteText("");
                    setPasteOpen(false);
                  }}
                  className="mt-2 w-full rounded-none border border-black bg-chat-accent-deep py-2 text-sm font-medium text-white transition-colors hover:bg-chat-accent-deep/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  解析这段简历
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 第二步：JD */}
      <div className="mt-3 rounded-none border border-black/70 p-4 dark:border-slate-700/70">
        <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-chat-ink dark:text-slate-200">
          <Target className="h-4 w-4 text-chat-ink-muted" />
          第二步 · 目标岗位 JD
        </div>
        <textarea
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          rows={5}
          placeholder="粘贴职位描述（JD）…&#10;例如：岗位职责、任职要求、公司介绍等"
          className="w-full resize-none rounded-none border border-black bg-chat-canvas px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-chat-accent/30 dark:border-slate-700 dark:bg-slate-950"
        />
      </div>

      <button
        type="button"
        disabled={!canStart}
        onClick={() => onStartOptimize(jdText.trim())}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-none border-2 border-black bg-chat-accent-deep py-3 text-sm font-bold text-white shadow-[2px_2px_0px_0px_#000000] transition-all hover:bg-chat-accent-deep/90 hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white dark:shadow-[2px_2px_0px_0px_#ffffff]"
      >
        <Wand2 className="h-4 w-4" />
        开始优化简历
      </button>
      {!resumeLoaded && (
        <p className="mt-2 text-center text-xs text-chat-ink-muted/70">先给我简历，再粘贴 JD，即可开始</p>
      )}
    </div>
  );
}
