import { headers } from "next/headers";
import Link from "next/link";
import { AuthPanel } from "@/components/auth-panel";
import { auth } from "@/lib/auth";
import { resolveReturnTo } from "@/lib/return-to";

type AccountPageProps = {
  searchParams: Promise<{
    returnTo?: string | string[];
  }>;
};

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const params = await searchParams;
  const returnTo = resolveReturnTo(params.returnTo);
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  return (
    <main className="shell">
      <nav className="topbar">
        <Link href="/" className="brand">
          Resume Agent
        </Link>
        <Link href="/" className="nav-link">
          Home
        </Link>
      </nav>
      <section className="hero compact">
        <p className="eyebrow">User center</p>
        <h1>{session ? "Account and entitlement hub" : "Sign in first"}</h1>
        <p>
          This page is the first Next.js-owned surface for sessions, plans, credits, subscription status, and the future
          billing portal.
        </p>
      </section>
      <AuthPanel returnTo={returnTo} />
    </main>
  );
}
