/**
 * 运行时确认卡(type=approval_request):requires_approval 工具挂起后的用户界面。
 * 收件人/主题/正文可编辑——用户改完点「确认发送」,改后的值随批准请求提交,
 * 发出的就是改后版本;取消则丢弃挂起。结果同步返回,直接更新卡片状态。
 */
import { useEffect, useState } from "react";
import { BookMarked, Loader2, Mail, Paperclip, Sparkles, Trash2, X } from "lucide-react";
import { AgentSpecialCard } from "@/components/agent-chat/AgentSpecialCard";
import type { StructuredCardProps } from "@/components/agent-chat/StructuredCardRegistry";
import { getApiBaseUrl } from "@/lib/runtimeEnv";
import { BETTER_AUTH_TOKEN } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";

interface ApprovalPayload {
  approval_id: string;
  tool_name: string;
  args: Record<string, unknown>;
  editable_fields: string[];
  attachment_label?: string;
}

type CardStatus = "pending" | "submitting" | "done" | "cancelled" | "error";

function buildAuthHeaders(token: string | null): Record<string, string> {
  if (!token || token === BETTER_AUTH_TOKEN) return {};
  return { Authorization: `Bearer ${token}` };
}

const inputClass =
  "w-full rounded-none border border-black bg-white px-2 py-1.5 text-sm text-chat-ink outline-none focus:border-chat-accent-deep disabled:opacity-60 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100";

const POLISH_PRESETS = ["更正式", "更简洁", "更热情", "补充细节"];

interface EmailTemplateItem {
  id: number | string;
  name: string;
  content: string;
}

/** 正文模板浮窗:预置岗位模板 + 我的模板一键套用({name} 自动替换为简历主人姓名),
 * 也可把当前正文存为模板。套用后可继续手改或 AI 润色微调。 */
function TemplatePopover({
  token,
  currentText,
  resumeName,
  onApply,
  onClose,
}: {
  token: string | null;
  currentText: string;
  resumeName: string;
  onApply: (text: string) => void;
  onClose: () => void;
}) {
  const [presets, setPresets] = useState<EmailTemplateItem[]>([]);
  const [mine, setMine] = useState<EmailTemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [busy, setBusy] = useState(false);

  const headers = { "Content-Type": "application/json", ...buildAuthHeaders(token ?? "") };

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(`${getApiBaseUrl()}/api/email/templates`, { headers });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setError(json.detail || "读取模板失败");
        return;
      }
      setPresets(json.presets || []);
      setMine(json.templates || []);
    } catch {
      setError("网络异常,请重试。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = (tpl: EmailTemplateItem) => {
    onApply(tpl.content.replaceAll("{name}", resumeName || "同学"));
    onClose();
  };

  const saveCurrent = async () => {
    if (!saveName.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const resp = await fetch(`${getApiBaseUrl()}/api/email/templates`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: saveName.trim(), content: currentText }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setError(json.detail || "保存失败");
        return;
      }
      setSaveOpen(false);
      setSaveName("");
      await refresh();
    } catch {
      setError("网络异常,请重试。");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number | string) => {
    try {
      await fetch(`${getApiBaseUrl()}/api/email/templates/${id}`, { method: "DELETE", headers });
      await refresh();
    } catch {
      setError("删除失败,请重试。");
    }
  };

  const row = (tpl: EmailTemplateItem, deletable: boolean) => (
    <div key={tpl.id} className="group flex items-center gap-1">
      <button
        type="button"
        onClick={() => apply(tpl)}
        title={tpl.content.slice(0, 120)}
        className="min-w-0 flex-1 truncate rounded-none border border-black px-2 py-1.5 text-left text-xs text-chat-ink transition-colors hover:bg-chat-user-bubble dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {tpl.name}
      </button>
      {deletable && (
        <button
          type="button"
          onClick={() => void remove(tpl.id)}
          aria-label={`删除模板 ${tpl.name}`}
          className="shrink-0 p-1 text-chat-ink-muted/50 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <div className="absolute right-0 top-7 z-20 w-72 rounded-none border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_#000000] dark:border-white dark:bg-slate-900 dark:shadow-[3px_3px_0px_0px_#ffffff]">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs font-bold text-chat-ink dark:text-slate-100">
          <BookMarked className="size-3.5 text-chat-accent" />
          正文模板
        </span>
        <button type="button" onClick={onClose} aria-label="关闭模板" className="p-0.5 text-chat-ink-muted hover:text-chat-ink">
          <X className="size-3.5" />
        </button>
      </div>

      {loading ? (
        <p className="py-2 text-xs text-chat-ink-muted">加载中…</p>
      ) : (
        <div className="max-h-64 space-y-2 overflow-auto">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase text-chat-ink-muted/70">预置</p>
            <div className="grid grid-cols-2 gap-1.5">
              {presets.map((tpl) => row(tpl, false))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase text-chat-ink-muted/70">我的模板</p>
            {mine.length === 0 ? (
              <p className="text-[11px] text-chat-ink-muted/70">还没有,可把当前正文存为模板</p>
            ) : (
              <div className="space-y-1">{mine.map((tpl) => row(tpl, true))}</div>
            )}
          </div>
        </div>
      )}

      <div className="mt-2 border-t border-black/20 pt-2 dark:border-slate-700">
        {saveOpen ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={saveName}
              autoFocus
              disabled={busy}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void saveCurrent();
                }
              }}
              placeholder="模板名,如:我的默认"
              className="h-8 min-w-0 flex-1 rounded-none border border-black bg-white px-2 text-xs outline-none focus:border-chat-accent-deep dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              type="button"
              disabled={busy || !saveName.trim()}
              onClick={() => void saveCurrent()}
              className="h-8 shrink-0 rounded-none border border-black bg-chat-accent px-2.5 text-xs font-semibold text-white hover:bg-chat-accent-deep disabled:opacity-50 dark:border-white"
            >
              {busy ? <Loader2 className="size-3 animate-spin" /> : "保存"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setSaveOpen(true)}
            className="w-full rounded-none border border-dashed border-black/50 py-1.5 text-xs text-chat-ink-muted transition-colors hover:border-black hover:text-chat-ink dark:border-slate-600 dark:hover:border-slate-400 dark:hover:text-slate-200"
          >
            + 把当前正文存为模板
          </button>
        )}
      </div>
      {error && <p className="mt-1.5 text-[11px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

/** 正文的 AI 润色浮窗:快捷指令或自由输入 → 调润色端点 → 结果替换正文(可继续手改) */
function PolishPopover({
  token,
  currentText,
  onPolished,
  onClose,
}: {
  token: string | null;
  currentText: string;
  onPolished: (text: string) => void;
  onClose: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (inst: string) => {
    if (!inst.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const resp = await fetch(`${getApiBaseUrl()}/api/agent/approval/polish`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildAuthHeaders(token ?? "") },
        body: JSON.stringify({ text: currentText, instruction: inst.trim() }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || !json.ok) {
        setError(json.detail || json.message || "润色失败,请重试。");
        return;
      }
      onPolished(String(json.text));
      onClose();
    } catch {
      setError("网络异常,请重试。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute right-0 top-7 z-20 w-72 rounded-none border-2 border-black bg-white p-3 shadow-[3px_3px_0px_0px_#000000] dark:border-white dark:bg-slate-900 dark:shadow-[3px_3px_0px_0px_#ffffff]">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs font-bold text-chat-ink dark:text-slate-100">
          <Sparkles className="size-3.5 text-chat-accent" />
          AI 润色正文
        </span>
        <button type="button" onClick={onClose} aria-label="关闭润色" className="p-0.5 text-chat-ink-muted hover:text-chat-ink">
          <X className="size-3.5" />
        </button>
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {POLISH_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={busy}
            onClick={() => run(preset)}
            className="rounded-none border border-black px-2 py-1 text-xs text-chat-ink transition-colors hover:bg-chat-user-bubble disabled:opacity-50 dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {preset}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={instruction}
          disabled={busy}
          autoFocus
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void run(instruction);
            }
          }}
          placeholder="或输入要求,如:再提一下项目经历"
          className="h-8 min-w-0 flex-1 rounded-none border border-black bg-white px-2 text-xs outline-none focus:border-chat-accent-deep dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
        />
        <button
          type="button"
          disabled={busy || !instruction.trim()}
          onClick={() => run(instruction)}
          className="flex h-8 shrink-0 items-center gap-1 rounded-none border border-black bg-chat-accent px-2.5 text-xs font-semibold text-white hover:bg-chat-accent-deep disabled:opacity-50 dark:border-white"
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3" />}
          润色
        </button>
      </div>
      {busy && <p className="mt-1.5 text-[11px] text-chat-ink-muted">正在改写,几秒钟…</p>}
      {error && <p className="mt-1.5 text-[11px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

export default function ApprovalCard({ data }: StructuredCardProps) {
  const { token } = useAuth();
  const payload = (data.payload ?? {}) as unknown as ApprovalPayload;
  const args = payload.args ?? {};

  const [toEmail, setToEmail] = useState(String(args.to_email ?? ""));
  const [subject, setSubject] = useState(String(args.subject ?? ""));
  const [body, setBody] = useState(String(args.body ?? ""));
  const [status, setStatus] = useState<CardStatus>("pending");
  const [resultMessage, setResultMessage] = useState("");
  const [polishOpen, setPolishOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  const disabled = status !== "pending" && status !== "error";

  const post = async (action: "approve" | "cancel") => {
    setStatus("submitting");
    try {
      const resp = await fetch(`${getApiBaseUrl()}/api/agent/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...buildAuthHeaders(token) },
        body: JSON.stringify({
          approval_id: payload.approval_id,
          action,
          params:
            action === "approve"
              ? { to_email: toEmail.trim(), subject: subject.trim(), body }
              : undefined,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setStatus("error");
        setResultMessage(json.detail || "操作失败,请重试。");
        return;
      }
      if (!json.ok) {
        setStatus("error");
        setResultMessage(json.message || "执行失败,请重试。");
        return;
      }
      setStatus(action === "approve" ? "done" : "cancelled");
      setResultMessage(json.message || "");
    } catch {
      setStatus("error");
      setResultMessage("网络异常,请重试。");
    }
  };

  return (
    <AgentSpecialCard
      variant="accent"
      icon={<Mail className="h-4 w-4" />}
      title="确认发送邮件"
      subtitle="确认前可直接修改收件人、主题和正文"
      footer={
        status === "done" ? (
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{resultMessage || "✅ 已发送。"}</p>
        ) : status === "cancelled" ? (
          <p className="text-sm text-chat-ink-muted">已取消发送。</p>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 flex-1 truncate text-xs text-red-600 dark:text-red-400">
              {status === "error" ? resultMessage : ""}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={status === "submitting"}
                onClick={() => post("cancel")}
                className="h-8 rounded-none border-2 border-black px-3 text-sm font-semibold text-chat-ink-muted transition-all hover:bg-chat-canvas disabled:cursor-not-allowed disabled:opacity-40 dark:border-white dark:hover:bg-slate-800"
              >
                取消
              </button>
              <button
                type="button"
                disabled={status === "submitting" || !toEmail.trim() || !body.trim()}
                onClick={() => post("approve")}
                className="flex h-8 items-center gap-1.5 rounded-none border-2 border-black bg-chat-accent px-3 text-sm font-semibold text-white shadow-[2px_2px_0px_0px_#000000] transition-all hover:bg-chat-accent-deep hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white dark:shadow-[2px_2px_0px_0px_#ffffff]"
              >
                {status === "submitting" && <Loader2 className="size-3.5 animate-spin" />}
                确认发送
              </button>
            </div>
          </div>
        )
      }
    >
      <div className="space-y-2.5">
        <div>
          <label className="mb-1 block text-xs font-semibold text-chat-ink-muted">收件人</label>
          <input
            type="email"
            value={toEmail}
            disabled={disabled}
            onChange={(e) => setToEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-chat-ink-muted">主题</label>
          <input
            type="text"
            value={subject}
            disabled={disabled}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="留空则使用默认主题"
            className={inputClass}
          />
        </div>
        <div className="relative">
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-semibold text-chat-ink-muted">正文(优化说明与建议)</label>
            {!disabled && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setTemplateOpen((v) => !v);
                    setPolishOpen(false);
                  }}
                  className="flex items-center gap-1 rounded-none border border-black px-1.5 py-0.5 text-[11px] font-semibold text-chat-ink transition-colors hover:bg-chat-user-bubble dark:border-slate-500 dark:text-slate-200 dark:hover:bg-slate-800"
                  title="套用常用正文模板(运营/产品/会计/开发或自存)"
                >
                  <BookMarked className="size-3" />
                  模板
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPolishOpen((v) => !v);
                    setTemplateOpen(false);
                  }}
                  className="flex items-center gap-1 rounded-none border border-black px-1.5 py-0.5 text-[11px] font-semibold text-chat-accent-deep transition-colors hover:bg-chat-user-bubble dark:border-slate-500 dark:text-blue-300 dark:hover:bg-slate-800"
                  title="让 AI 按你的要求改写正文"
                >
                  <Sparkles className="size-3" />
                  AI 润色
                </button>
              </div>
            )}
          </div>
          {templateOpen && !disabled && (
            <TemplatePopover
              token={token}
              currentText={body}
              resumeName={String((payload as unknown as Record<string, unknown>).resume_name ?? "")}
              onApply={setBody}
              onClose={() => setTemplateOpen(false)}
            />
          )}
          {polishOpen && !disabled && (
            <PolishPopover
              token={token}
              currentText={body}
              onPolished={setBody}
              onClose={() => setPolishOpen(false)}
            />
          )}
          <textarea
            value={body}
            disabled={disabled}
            onChange={(e) => setBody(e.target.value)}
            rows={7}
            className={`${inputClass} resize-y leading-relaxed`}
          />
        </div>
        {payload.attachment_label && (
          <div className="flex items-center gap-1.5 text-xs text-chat-ink-muted">
            <Paperclip className="size-3.5" />
            附件:{payload.attachment_label}
          </div>
        )}
      </div>
    </AgentSpecialCard>
  );
}
