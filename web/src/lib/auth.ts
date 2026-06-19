import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { bearer } from "better-auth/plugins";
import { Pool } from "pg";
import { getAuthDatabaseUrl } from "@/lib/database-url";

const databaseUrl = getAuthDatabaseUrl();

const globalForAuth = globalThis as unknown as {
  authPgPool?: Pool;
};

const pool =
  globalForAuth.authPgPool ??
  new Pool({
    connectionString: databaseUrl || undefined,
    max: Number(process.env.BETTER_AUTH_DB_POOL_SIZE || "10"),
    idleTimeoutMillis: 30_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForAuth.authPgPool = pool;
}

export const auth = betterAuth({
  appName: "Resume Agent",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret:
    process.env.BETTER_AUTH_SECRET ||
    "development-only-change-me-before-production-32-chars",
  database: pool,
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID || "",
      clientSecret:
        process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },
  plugins: [
    bearer(),
    // Keep this last so server actions and route handlers can forward Set-Cookie.
    nextCookies(),
  ],
});

export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;
