import React from "react";

interface AgentSpecialCardProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  variant?: "default" | "accent" | "success" | "muted";
  onClick?: () => void;
  className?: string;
}

const variantStyles = {
  default: {
    shell: "border-chat-border/80 bg-chat-surface",
    header: "border-chat-border/60 bg-chat-canvas/60",
    title: "text-chat-ink",
    subtitle: "text-chat-ink-muted",
  },
  accent: {
    shell: "border-chat-accent/30 bg-chat-surface",
    header: "border-chat-accent/20 bg-chat-canvas/80",
    title: "text-chat-accent-deep",
    subtitle: "text-chat-ink-muted",
  },
  success: {
    shell: "border-blue-200/80 bg-chat-surface",
    header: "border-blue-100 bg-blue-50/50",
    title: "text-blue-800",
    subtitle: "text-blue-700/80",
  },
  muted: {
    shell: "border-chat-border/60 bg-chat-canvas/40",
    header: "border-chat-border/40 bg-chat-canvas/30",
    title: "text-chat-ink-muted",
    subtitle: "text-chat-ink-muted/80",
  },
} as const;

export function AgentSpecialCard({
  icon,
  title,
  subtitle,
  badge,
  children,
  footer,
  variant = "default",
  onClick,
  className = "",
}: AgentSpecialCardProps) {
  const styles = variantStyles[variant];
  const interactive = Boolean(onClick);

  return (
    <div
      className={`overflow-hidden rounded-xl border shadow-sm ${styles.shell} ${
        interactive ? "cursor-pointer transition-all hover:shadow-md hover:border-chat-accent/40" : ""
      } ${className}`}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <div
        className={`flex items-center justify-between gap-3 border-b px-4 py-2.5 ${styles.header}`}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && <span className="shrink-0 text-chat-accent">{icon}</span>}
          <div className="min-w-0">
            <div className={`truncate text-sm font-semibold ${styles.title}`}>{title}</div>
            {subtitle && (
              <div className={`truncate text-xs ${styles.subtitle}`}>{subtitle}</div>
            )}
          </div>
        </div>
        {badge}
      </div>

      <div className="p-4">{children}</div>

      {footer && (
        <div className="border-t border-chat-border/60 bg-chat-canvas/40 px-4 py-3">
          {footer}
        </div>
      )}
    </div>
  );
}
