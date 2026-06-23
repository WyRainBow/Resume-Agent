"use client";

import { useEffect, useState, useTransition } from "react";
import { signIn, signUp, useSession } from "@/lib/auth-client";
import { buildAccountCallbackUrl } from "@/lib/return-to";

type Mode = "signin" | "signup";

type AuthPanelProps = {
  returnTo?: string;
};

/** 官方 Google 四色 “G” 标识，用于登录按钮。 */
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

export function AuthPanel({ returnTo = "" }: AuthPanelProps) {
  const { data: session, isPending } = useSession();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, startTransition] = useTransition();

  // 登录后立即跳回应用（OAuth 已由服务端重定向兜底，这里覆盖客户端邮箱登录场景）。
  useEffect(() => {
    if (!session?.user?.id || !returnTo) {
      return;
    }

    window.location.assign(returnTo);
  }, [session?.user?.id, returnTo]);

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
    return (
      <section className="auth-card login-card login-pending">
        <span className="login-spinner" aria-hidden />
        <p className="muted">正在检查登录状态…</p>
      </section>
    );
  }

  // 已登录（通常是客户端邮箱登录刚成功）：显示跳转态，由上面的 effect 跳回应用。
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
        <h2>{mode === "signin" ? "欢迎回来" : "创建你的账户"}</h2>
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
        {mode === "signin" ? "还没有账户？注册" : "已有账户？登录"}
      </button>

      {message ? <p className="status-message">{message}</p> : null}
    </section>
  );
}