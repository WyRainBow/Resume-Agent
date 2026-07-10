import { useState } from "react";
import { Mail } from "lucide-react";
import { AgentSpecialCard } from "@/components/agent-chat/AgentSpecialCard";

export interface SendEmailConfirmStructuredData {
  type: "send_resume_email_confirm";
  to_email: string;
  subject: string;
  message: string;
  resume_name: string;
}

interface SendEmailConfirmCardProps {
  items: SendEmailConfirmStructuredData[];
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="w-12 shrink-0 text-chat-ink-muted">{label}</span>
      <span className="min-w-0 flex-1 break-words text-chat-ink dark:text-slate-100">{value}</span>
    </div>
  );
}

/** 单张卡片自己跟踪是否已被点过，点过之后按钮禁用，避免重复触发确认/取消。 */
function ConfirmCard({
  item,
  onConfirm,
  onCancel,
}: {
  item: SendEmailConfirmStructuredData;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [resolved, setResolved] = useState<"confirm" | "cancel" | null>(null);

  return (
    <AgentSpecialCard
      variant="accent"
      icon={<Mail className="h-4 w-4" />}
      title="确认发送邮件"
      subtitle={`发给 ${item.to_email}`}
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={resolved !== null}
            onClick={() => {
              setResolved("cancel");
              onCancel();
            }}
            className="h-8 rounded-none border-2 border-black px-3 text-sm font-semibold text-chat-ink-muted transition-all hover:bg-chat-canvas disabled:cursor-not-allowed disabled:opacity-40 dark:border-white dark:hover:bg-slate-800"
          >
            {resolved === "cancel" ? "已取消" : "取消"}
          </button>
          <button
            type="button"
            disabled={resolved !== null}
            onClick={() => {
              setResolved("confirm");
              onConfirm();
            }}
            className="h-8 rounded-none border-2 border-black bg-chat-accent px-3 text-sm font-semibold text-white shadow-[2px_2px_0px_0px_#000000] transition-all hover:bg-chat-accent-deep hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white dark:shadow-[2px_2px_0px_0px_#ffffff]"
          >
            {resolved === "confirm" ? "已确认" : "确认发送"}
          </button>
        </div>
      }
    >
      <div className="space-y-1.5">
        <Row label="收件人" value={item.to_email} />
        <Row label="主题" value={item.subject} />
        <Row label="附件" value={`《${item.resume_name}的简历》PDF`} />
        <Row label="留言" value={item.message} />
      </div>
    </AgentSpecialCard>
  );
}

export default function SendEmailConfirmCard({
  items,
  onConfirm,
  onCancel,
  className = "",
}: SendEmailConfirmCardProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {items.map((item, index) => (
        <ConfirmCard
          key={`send-email-confirm-${index}`}
          item={item}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      ))}
    </div>
  );
}
