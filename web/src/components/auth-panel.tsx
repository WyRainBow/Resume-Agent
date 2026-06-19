"use client";

import { useEffect, useState, useTransition } from "react";
import { clearBearerToken, signIn, signOut, signUp, useSession } from "@/lib/auth-client";
import type { AccountEntitlement } from "@/lib/fastapi-types";
import { buildAccountCallbackUrl } from "@/lib/return-to";

type Mode = "signin" | "signup";

type AuthPanelProps = {
  returnTo?: string;
};

function formatPlanLabel(plan: string) {
  if (plan === "free") return "免费版";
  if (plan === "pro") return "专业版";
  return plan;
}

function formatSubscriptionStatus(status: string) {
  if (status === "free") return "免费";
  if (status === "active") return "生效中";
  if (status === "canceled") return "已取消";
  if (status === "past_due") return "待付款";
  return status;
}

export function AuthPanel({ returnTo = "" }: AuthPanelProps) {
  const { data: session, isPending } = useSession();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [account, setAccount] = useState<AccountEntitlement | null>(null);
  const [accountStatus, setAccountStatus] = useState("等待登录。");
  const [isSubmitting, startTransition] = useTransition();

  useEffect(() => {
    if (!session?.user?.id || !returnTo) {
      return;
    }

    window.location.assign(returnTo);
  }, [session?.user?.id, returnTo]);

  useEffect(() => {
    if (!session?.user?.id) {
      return;
    }

    let isActive = true;

    const loadAccount = async () => {
      setAccountStatus("正在加载账户权益...");
      try {
        const response = await fetch("/api/fastapi/account", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`账户接口返回 ${response.status}`);

        const data = (await response.json()) as AccountEntitlement;
        if (isActive) {
          setAccount(data);
          setAccountStatus("权益信息已加载。");
        }
      } catch (error) {
        if (!isActive) return;
        setAccountStatus(
          error instanceof Error
            ? `权益信息加载失败：${error.message}`
            : "权益信息加载失败。",
        );
      }
    };

    void loadAccount();

    return () => {
      isActive = false;
    };
  }, [session?.user?.id]);

  const submitEmail = () => {
    setMessage("");
    startTransition(async () => {
      const result =
        mode === "signin"
          ? await signIn.email({ email, password })
          : await signUp.email({ email, password, name: name || email });

      if (result.error) {
        setMessage(result.error.message || "登录失败，请重试。");
        return;
      }

      setMessage(mode === "signin" ? "登录成功。" : "账户已创建。");
    });
  };

  const submitGoogle = () => {
    setMessage("");
    startTransition(async () => {
      const result = await signIn.social({
        provider: "google",
        callbackURL: buildAccountCallbackUrl(returnTo),
      });

      if (result.error) {
        setMessage(result.error.message || "Google 登录失败，请重试。");
      }
    });
  };

  if (isPending) {
    return <div className="auth-card">正在检查登录状态...</div>;
  }

  if (session) {
    const entitlement = account?.entitlement;
    const workspaceUrl = returnTo || "http://localhost:5173/workspace";

    return (
      <section className="account-shell">
        <section className="auth-card account-profile-card">
          <div className="account-profile-header">
            {session.user.image ? (
              <img
                alt={session.user.name || session.user.email}
                className="account-avatar"
                src={session.user.image}
              />
            ) : (
              <div className="account-avatar account-avatar-fallback">
                {(session.user.name || session.user.email || "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div>
              <p className="eyebrow">个人资料</p>
              <h2>{session.user.name || session.user.email}</h2>
              <p className="muted">{session.user.email}</p>
            </div>
          </div>
          <div className="account-grid compact">
            <span>用户 ID</span>
            <strong>{session.user.id}</strong>
          </div>
        </section>

        <section className="auth-card">
          <p className="eyebrow">套餐</p>
          <h2>{formatPlanLabel(entitlement?.plan || "free")}</h2>
          <p className="muted">
            订阅状态：
            {entitlement
              ? formatSubscriptionStatus(entitlement.subscription_status)
              : accountStatus}
          </p>
          <div className="account-grid">
            <span>剩余额度</span>
            <strong>{entitlement ? entitlement.credits : "—"}</strong>
            <span>今日用量</span>
            <strong>{entitlement ? entitlement.daily_usage_count : "—"}</strong>
            <span>周期截止</span>
            <strong>{entitlement?.current_period_end || "未订阅"}</strong>
          </div>
        </section>

        <section className="auth-card">
          <p className="eyebrow">用量</p>
          <h2>简历操作</h2>
          <p className="muted">
            开通计费后，额度与每日用量将用于限制 PDF 导出、AI 改写和简历评分等功能。
          </p>
          <div className="usage-meter">
            <div className="usage-meter-label">
              <span>今日</span>
              <strong>{entitlement ? entitlement.daily_usage_count : 0}</strong>
            </div>
            <div className="usage-meter-track">
              <div
                className="usage-meter-fill"
                style={{ width: `${Math.min((entitlement?.daily_usage_count || 0) * 10, 100)}%` }}
              />
            </div>
          </div>
        </section>

        <section className="auth-card">
          <p className="eyebrow">账单</p>
          <h2>支付中心</h2>
          <p className="muted">
            Stripe 结账与客户门户将在这里接入。支付相关 ID 仅在服务端保存，账单功能上线后可见。
          </p>
          <div className="account-grid">
            <span>客户 ID</span>
            <strong>{entitlement?.provider_customer_id || "未绑定"}</strong>
            <span>订阅 ID</span>
            <strong>{entitlement?.provider_subscription_id || "未绑定"}</strong>
          </div>
        </section>

        <section className="auth-card account-actions">
          <a className="primary-button continue-link" href={workspaceUrl}>
            进入工作台
          </a>
          <button
            className="secondary-button"
            onClick={() =>
              void signOut({
                fetchOptions: {
                  onSuccess: () => {
                    clearBearerToken();
                    location.reload();
                  },
                },
              })
            }
          >
            退出登录
          </button>
        </section>
      </section>
    );
  }

  return (
    <section className="auth-card">
      <div>
        <p className="eyebrow">登录</p>
        <h2>{mode === "signin" ? "登录 Resume Agent" : "创建你的账户"}</h2>
        <p className="muted">
          Google 登录是海外用户的主要入口，邮箱登录保留用于本地测试。
        </p>
      </div>

      <button className="google-button" onClick={submitGoogle} disabled={isSubmitting}>
        使用 Google 继续
      </button>

      <div className="divider">或使用邮箱</div>

      {mode === "signup" ? (
        <label>
          昵称
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：张三" />
        </label>
      ) : null}

      <label>
        邮箱
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
      </label>

      <label>
        密码
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="至少 8 位字符"
          type="password"
        />
      </label>

      <button className="primary-button" onClick={submitEmail} disabled={isSubmitting || !email || !password}>
        {isSubmitting ? "处理中..." : mode === "signin" ? "登录" : "创建账户"}
      </button>

      <button className="link-button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
        {mode === "signin" ? "还没有账户？" : "已有账户？"}
      </button>

      {message ? <p className="status-message">{message}</p> : null}
    </section>
  );
}