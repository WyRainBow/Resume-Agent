# Next.js BetterAuth Auth Layer Plan

## Goal

Add a Next.js web application that owns authentication and commercial user surfaces while keeping the existing FastAPI backend as the core business API.

## Architecture

- `web/` is the new Next.js App Router application.
- BetterAuth is mounted at `web/src/app/api/auth/[...all]/route.ts`.
- BetterAuth stores users, sessions, accounts, and verification records in PostgreSQL.
- FastAPI remains responsible for resume generation, PDF, Agent, admin, and data APIs.
- The existing `frontend/` Vite workspace stays in place until its complex pages are migrated intentionally.

## Phase 1: Auth Shell

- Create `web/`.
- Add BetterAuth with Google OAuth and email/password fallback.
- Add a basic account page that proves session read/write works.
- Document local environment variables.

## Phase 2: FastAPI Handoff

- Add a FastAPI dependency that accepts BetterAuth-issued bearer tokens or trusted session context from the Next.js layer.
- Use `web/src/lib/fastapi.ts` for new Next-owned calls into FastAPI so Authorization behavior stays centralized.
- Configure FastAPI with `BETTER_AUTH_INTERNAL_URL=http://localhost:3000` locally so it can validate bearer tokens through BetterAuth.
- Configure both FastAPI and `web/` with the same `FASTAPI_INTERNAL_AUTH_SECRET` so Next.js can forward trusted server-side user context.
- The initial probe endpoint is `GET /api/auth/better/me`.
- The backend diagnostic endpoint is `GET /api/auth/better/health`; it reports non-secret readiness booleans and entitlement table availability.
- Keep the old JWT dependency temporarily for current Vite pages.
- Move new protected APIs to the BetterAuth dependency first.

## Phase 3: Commercial User Model

- Add app-owned entitlement tables or fields:
  - `plan`
  - `credits`
  - `daily_usage_count`
  - `last_usage_reset_at`
  - `subscription_status`
  - `provider_customer_id`
  - `provider_subscription_id`
- Surface those values on `/account`.
- Backend table: `better_auth_entitlements`.
- Migration: `backend/alembic/versions/015_add_better_auth_entitlements.py`.
- Protected account endpoint: `GET /api/auth/better/account`.
- Next account UI reads this endpoint through `web/src/lib/fastapi.ts`.
- Browser account UI now prefers the same-origin Next proxy `GET /api/fastapi/account`, which reads the BetterAuth cookie session and forwards trusted internal headers to FastAPI.

## Phase 4: Migration Decisions

- Keep `Workspace`, `AgentChat`, and PDF tooling in Vite until auth and billing are stable.
- Migrate simpler surfaces first: landing, settings, dashboard.
- Retire `backend/routes/auth.py` only after all clients no longer depend on the old JWT token.
- Vite login page and modal can hand off to Next.js by setting `VITE_AUTH_WEB_URL=http://localhost:3000`.
- Leave `VITE_AUTH_WEB_URL` empty to keep the old FastAPI JWT login as a fallback during migration.
- Vite can route API calls through Next.js by setting `VITE_API_VIA_AUTH_WEB=true`; Next then forwards public requests anonymously and signed-in requests with trusted BetterAuth user headers.
- Next.js allows controlled CORS for legacy Vite origins through `AUTH_PROXY_ALLOWED_ORIGINS`.
- When `VITE_AUTH_WEB_URL` is set, the Vite app configures axios and fetch with `credentials: include` so BetterAuth cookies can reach the Next.js proxy.

## Local Commands

```bash
cd web
npm run dev
```

```bash
python -m uvicorn backend.main:app --host 127.0.0.1 --port 9000
```

Check local auth env keys without printing secret values:

```bash
bash scripts/check-auth-stack-env.sh
```

The checker rejects empty values, placeholder values, and mismatched `FASTAPI_INTERNAL_AUTH_SECRET` values between `web/.env.local` and the backend root `.env`.

Local checks treat missing Google OAuth keys as warnings so email/password can unblock development. Production readiness should enforce Google OAuth:

```bash
AUTH_ENV_REQUIRE_GOOGLE=true bash scripts/check-auth-stack-env.sh
```

Bootstrap local auth env files without printing secret values:

```bash
cd web
npm run bootstrap:auth-env
```

To append missing backend handoff keys to the root `.env`, use:

```bash
bash scripts/bootstrap-auth-env.sh --write-root-env
```

Check auth migration invariants without starting services:

```bash
cd web
npm run check:auth-migration
```

Check BetterAuth database readiness without printing the database URL:

```bash
cd web
npm run check:auth-db
```

Apply BetterAuth database migrations only after confirming the target database:

```bash
AUTH_DB_MIGRATE_CONFIRM=true npm run migrate:auth-db
```

Start only the Next.js auth shell from the repository root:

```bash
bash scripts/dev-auth-web.sh
```

After FastAPI and Next.js are both running, smoke test the local chain:

```bash
bash scripts/smoke-auth-stack.sh
```

Expected unauthenticated results:

- `GET /` on Next.js returns `200`, `307`, or `308`.
- `GET /api/auth/get-session` on Next.js returns `200` or `401`.
- `GET /api/health` on FastAPI returns `200`.
- `GET /api/auth/better/health` on FastAPI returns `200` and includes `entitlement_table_ready`.
- `npm run check:auth-db` from `web/` passes unless `SKIP_BETTER_AUTH_DB_CHECK=true` is set.
- `OPTIONS /api/fastapi/proxy/health` through Next.js returns `204` for the allowed legacy origin.
- `GET /api/fastapi/proxy/health` through Next.js returns `200`.
- `OPTIONS /api/fastapi/account` through Next.js returns `204` for the allowed legacy origin.
- `GET /api/fastapi/account` through Next.js returns `401` until a BetterAuth session exists.

## BetterAuth Database Setup

Generate or apply BetterAuth tables from `web/` after `.env.local` is configured:

```bash
npx auth@latest generate
```

or, for the built-in database adapter:

```bash
npx auth@latest migrate
```

Do not run BetterAuth or Alembic migrations against a remote database until the target database has been confirmed.

After BetterAuth migrations are applied, `npm run check:auth-db` should pass for the configured database.
