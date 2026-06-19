import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth-panel";
import { auth } from "@/lib/auth";
import { sanitizeReturnTo } from "@/lib/return-to";

export const metadata: Metadata = {
  title: "用户中心 · Resume Agent",
  description: "管理登录状态、套餐、额度与订阅信息",
};

type AccountPageProps = {
  searchParams: Promise<{
    returnTo?: string | string[];
  }>;
};

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const params = await searchParams;
  const returnTo = sanitizeReturnTo(params.returnTo);
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
          首页
        </Link>
      </nav>
      <section className="hero compact">
        <p className="eyebrow">用户中心</p>
        <h1>{session ? "账户与权益中心" : "请先登录"}</h1>
        <p>
          在这里管理登录状态、套餐、额度、订阅状态，以及未来的账单入口。
        </p>
      </section>
      <AuthPanel returnTo={returnTo} />
    </main>
  );
}