import Link from "next/link";
import { AuthPanel } from "@/components/auth-panel";
import { getDefaultReturnTo } from "@/lib/return-to";

export default function Home() {
  return (
    <main className="shell">
      <nav className="topbar">
        <Link href="/" className="brand">
          Resume Agent
        </Link>
        <div className="nav-actions">
          <Link href="/account" className="nav-link">
            Account
          </Link>
          <a href="http://localhost:5173/workspace" className="nav-link">
            Workspace
          </a>
        </div>
      </nav>

      <section className="hero">
        <div>
          <p className="eyebrow">Next.js authentication layer</p>
          <h1>Login becomes the start of plans, credits, and billing.</h1>
          <p>
            This new web app keeps FastAPI focused on resume intelligence while BetterAuth owns sessions, Google login,
            and the future user center.
          </p>
        </div>
        <AuthPanel returnTo={getDefaultReturnTo()} />
      </section>

      <section className="system-map">
        <div>
          <span>01</span>
          <h2>Next.js</h2>
          <p>Commercial shell, account center, pricing pages, and BetterAuth routes.</p>
        </div>
        <div>
          <span>02</span>
          <h2>BetterAuth</h2>
          <p>Google OAuth, email fallback, sessions, bearer tokens, and user-owned data.</p>
        </div>
        <div>
          <span>03</span>
          <h2>FastAPI</h2>
          <p>Existing AI, PDF, Agent, admin, and resume APIs continue to run on port 9000.</p>
        </div>
      </section>
    </main>
  );
}
