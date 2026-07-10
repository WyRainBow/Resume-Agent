/**
 * 运行时确认卡(type=approval_request):requires_approval 工具挂起后的用户界面。
 * 收件人/主题/正文可编辑——用户改完点「确认发送」,改后的值随批准请求提交,
 * 发出的就是改后版本;取消则丢弃挂起。结果同步返回,直接更新卡片状态。
 */
import { useState } from "react";
import { Loader2, Mail, Paperclip } from "lucide-react";
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

export default function ApprovalCard({ data }: StructuredCardProps) {
  const { token } = useAuth();
  const payload = (data.payload ?? {}) as unknown as ApprovalPayload;
  const args = payload.args ?? {};

  const [toEmail, setToEmail] = useState(String(args.to_email ?? ""));
  const [subject, setSubject] = useState(String(args.subject ?? ""));
  const [body, setBody] = useState(String(args.body ?? ""));
  const [status, setStatus] = useState<CardStatus>("pending");
  const [resultMessage, setResultMessage] = useState("");

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
        <div>
          <label className="mb-1 block text-xs font-semibold text-chat-ink-muted">正文(优化说明与建议)</label>
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
