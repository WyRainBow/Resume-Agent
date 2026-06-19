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
  if (plan === "free") return "Free";
  if (plan === "pro") return "Pro";
  return plan;
}

export function AuthPanel({ returnTo = "" }: AuthPanelProps) {
  const { data: session, isPending } = useSession();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [account, setAccount] = useState<AccountEntitlement | null>(null);
  const [accountStatus, setAccountStatus] = useState("Waiting for sign-in.");
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
      setAccountStatus("Loading account entitlements...");
      try {
        const response = await fetch("/api/fastapi/account", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`Account proxy responded with ${response.status}`);

        const data = (await response.json()) as AccountEntitlement;
        if (isActive) {
          setAccount(data);
          setAccountStatus("Entitlements loaded from FastAPI.");
        }
      } catch (error) {
        if (!isActive) return;
        setAccountStatus(
          error instanceof Error
            ? `FastAPI handoff pending: ${error.message}`
            : "FastAPI handoff pending.",
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
        setMessage(result.error.message || "Authentication failed.");
        return;
      }

      setMessage(mode === "signin" ? "Signed in." : "Account created.");
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
        setMessage(result.error.message || "Google sign-in failed.");
      }
    });
  };

  if (isPending) {
    return <div className="auth-card">Checking session...</div>;
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
              <p className="eyebrow">Profile</p>
              <h2>{session.user.name || session.user.email}</h2>
              <p className="muted">{session.user.email}</p>
            </div>
          </div>
          <div className="account-grid compact">
            <span>User ID</span>
            <strong>{session.user.id}</strong>
          </div>
        </section>

        <section className="auth-card">
          <p className="eyebrow">Plan</p>
          <h2>{formatPlanLabel(entitlement?.plan || "free")}</h2>
          <p className="muted">
            Subscription status: {entitlement?.subscription_status || accountStatus}
          </p>
          <div className="account-grid">
            <span>Credits</span>
            <strong>{entitlement ? entitlement.credits : "—"}</strong>
            <span>Daily usage</span>
            <strong>{entitlement ? entitlement.daily_usage_count : "—"}</strong>
            <span>Period end</span>
            <strong>{entitlement?.current_period_end || "Not subscribed"}</strong>
          </div>
        </section>

        <section className="auth-card">
          <p className="eyebrow">Usage</p>
          <h2>Resume actions</h2>
          <p className="muted">
            Credits and daily usage will gate PDF export, AI rewrite, and scoring once billing is enabled.
          </p>
          <div className="usage-meter">
            <div className="usage-meter-label">
              <span>Today</span>
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
          <p className="eyebrow">Billing</p>
          <h2>Payment portal</h2>
          <p className="muted">
            Stripe checkout and customer portal will land here. Provider IDs stay server-side until billing ships.
          </p>
          <div className="account-grid">
            <span>Customer ID</span>
            <strong>{entitlement?.provider_customer_id || "Not linked"}</strong>
            <span>Subscription ID</span>
            <strong>{entitlement?.provider_subscription_id || "Not linked"}</strong>
          </div>
        </section>

        <section className="auth-card account-actions">
          <a className="primary-button continue-link" href={workspaceUrl}>
            Open workspace
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
            Sign out
          </button>
        </section>
      </section>
    );
  }

  return (
    <section className="auth-card">
      <div>
        <p className="eyebrow">Authentication foundation</p>
        <h2>{mode === "signin" ? "Sign in to Resume Agent" : "Create your account"}</h2>
        <p className="muted">
          Google login is the primary entry for overseas users. Email is kept as a fallback for local testing.
        </p>
      </div>

      <button className="google-button" onClick={submitGoogle} disabled={isSubmitting}>
        Continue with Google
      </button>

      <div className="divider">or use email</div>

      {mode === "signup" ? (
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ada Lovelace" />
        </label>
      ) : null}

      <label>
        Email
        <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
      </label>

      <label>
        Password
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 8 characters"
          type="password"
        />
      </label>

      <button className="primary-button" onClick={submitEmail} disabled={isSubmitting || !email || !password}>
        {isSubmitting ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
      </button>

      <button className="link-button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
        {mode === "signin" ? "Need an account?" : "Already have an account?"}
      </button>

      {message ? <p className="status-message">{message}</p> : null}
    </section>
  );
}