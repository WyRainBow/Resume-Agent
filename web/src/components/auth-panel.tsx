"use client";

import { useEffect, useState, useTransition } from "react";
import { signIn, useSession } from "@/lib/auth-client";
import { buildAccountCallbackUrl } from "@/lib/return-to";
import { getFastApiBaseUrl } from "@/lib/fastapi";

type Mode = "signin" | "signup";

type AuthPanelProps = {
  returnTo?: string;
};

/** 官方 Google 四色 "G" 标识，用于登录按钮。 */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.28 1.48-1.13 2.73-2.4 3.58v2.97h3.88c2.27-2.09 3.57-5.17 3.57-8.79z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.94-2.91l-3.88-2.97c-1.08.72-2.46 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.32A7.2 7.2 0 0 1 4.89 12c0-.81.14-1.6.38-2.32V6.59H1.29A11.98 11.98 0 0 0 0 12c0 1.94.47 3.77 1.29 5.41l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.59l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

type LegacyTokenResponse = {
  access_token: string;
  token_type: string;
  user: { id: number; username: string; email?: string | null; role?: string | null };
};

export function AuthPanel({ returnTo = "" }: AuthPanelProps) {
  const { data: session, isPending } = useSession();
  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, startTransition] = useTransition();

  // 登录后立即跳回应用（OAuth 已由服务端重定向兜底，这里覆盖账号/密码登录场景）。
  useEffect(() => {
    if (!session?.user?.id || !returnTo) {
      return;
    }

    window.location.assign(returnTo);
  }, [session?.user?.id, returnTo]);

  /**
   * 账号/密码登录注册 —— 调用 FastAPI Legacy JWT 接口。
   * 登录成功后把 token 拼到回跳 URL 上，Vite 端 AuthContext.init() 从 URL 取出后写入 localStorage。
   */
  const submitLegacy = () => {
    setMessage("");
    if (password.length < 4) {
      setMessage("密码长度至少 4 位。");
      return;
    }
    startTransition(async () => {
      const endpoint = mode === "signin" ? "/api/auth/login" : "/api/auth/register";
      try {
        const response = await fetch(`${getFastApiBaseUrl()}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          setMessage(
            typeof errData.detail === "string"
              ? errData.detail
              : "操作失败，请重试。",
          );
          return;
        }

        const data = (await response.json()) as LegacyTokenResponse;

        // 把 Legacy JWT token 拼到回跳 URL，Vite 端读取后写入 localStorage 并清理地址栏。
        const target = new URL(returnTo || window.location.origin);
        target.searchParams.set("legacy_token", data.access_token);
        target.searchParams.set("legacy_user", JSON.stringify(data.user));
        window.location.assign(target.toString());
      } catch {
        setMessage("网络错误，请重试。");
      }
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
    return (
      <section className="auth-card login-card login-pending">
        <span className="login-spinner" aria-hidden />
        <p className="muted">正在检查登录状态…</p>
      </section>
    );
  }

  // 已登录（通常是 Google OAuth 刚成功）：显示跳转态，由上面的 effect 跳回应用。
  if (session) {
    return (
      <section className="auth-card login-card login-pending">
        <span className="login-spinner" aria-hidden />
        <p className="muted">正在进入…</p>
      </section>
    );
  }

  return (
    <section className="auth-card login-card">
      <div className="login-brand">
        <span className="login-logo">RA</span>
        <span className="login-wordmark">Resume.AI</span>
      </div>

      <div className="login-head">
        <h2>{mode === "signin" ? "登录 Resume.AI" : "创建你的账户"}</h2>
        <p className="muted">
          {mode === "signin"
            ? "登录以继续创建你的简历"
            : "注册后即可用 AI 一键生成简历"}
        </p>
      </div>

      <button className="google-button" onClick={submitGoogle} disabled={isSubmitting}>
        <GoogleIcon />
        使用 Google 继续
      </button>

      <div className="divider">或使用账号</div>

      <label>
        账号
        <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="请输入账号" />
      </label>

      <label>
        密码
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="至少 4 位字符"
          type="password"
        />
      </label>

      <button className="primary-button" onClick={submitLegacy} disabled={isSubmitting || !username || !password}>
        {isSubmitting ? "处理中..." : mode === "signin" ? "登录" : "创建账户"}
      </button>

      <button className="link-button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
        {mode === "signin" ? "还没有账户？注册" : "已有账户？登录"}
      </button>

      {message ? <p className="status-message">{message}</p> : null}
    </section>
  );
}