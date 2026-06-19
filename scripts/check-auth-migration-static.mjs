#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);

const checks = [
  {
    file: "web/src/lib/cors.ts",
    patterns: [
      /http:\/\/localhost:5173/,
      /Access-Control-Allow-Credentials/,
      /Access-Control-Allow-Origin/,
      /AUTH_PROXY_ALLOWED_ORIGINS/,
    ],
  },
  {
    file: "web/src/app/api/fastapi/account/route.ts",
    patterns: [/export function OPTIONS/, /corsPreflight/, /withCors/],
  },
  {
    file: "web/src/app/api/fastapi/proxy/[...path]/route.ts",
    patterns: [/export const OPTIONS/, /corsPreflight/, /withCors/],
  },
  {
    file: "frontend/src/lib/configureAuthWebRequests.ts",
    patterns: [
      /axios\.interceptors\.request\.use/,
      /requestUrl\.origin === authWebOrigin/,
      /credentials: init\.credentials \|\| 'include'/,
    ],
    forbidden: [/axios\.defaults\.withCredentials\s*=\s*true/],
  },
  {
    file: "frontend/src/main.tsx",
    patterns: [/configureAuthWebRequests\(\)/],
  },
  {
    file: "web/package.json",
    patterns: [
      /"bootstrap:auth-env": "bash \.\.\/scripts\/bootstrap-auth-env\.sh"/,
      /"check:auth-env": "bash \.\.\/scripts\/check-auth-stack-env\.sh"/,
      /"check:auth-db": "node \.\.\/scripts\/check-better-auth-db\.mjs"/,
      /"migrate:auth-db": "bash \.\.\/scripts\/migrate-better-auth-db\.sh"/,
    ],
  },
  {
    file: "scripts/migrate-better-auth-db.sh",
    patterns: [/AUTH_DB_MIGRATE_CONFIRM/, /npm run auth:migrate/, /npm run check:auth-db/],
  },
  {
    file: "scripts/check-better-auth-db.mjs",
    patterns: [/getAuthTables/, /information_schema\.columns/, /BetterAuth database check/],
  },
  {
    file: "scripts/bootstrap-auth-env.sh",
    patterns: [/--write-root-env/, /BETTER_AUTH_DATABASE_URL/, /FASTAPI_INTERNAL_AUTH_SECRET/],
  },
  {
    file: "scripts/smoke-auth-stack.sh",
    patterns: [
      /LEGACY_FRONTEND_ORIGIN/,
      /SKIP_BETTER_AUTH_DB_CHECK/,
      /npm run --silent check:auth-db/,
      /request_options_status/,
      /proxy cors preflight/,
    ],
  },
];

let failures = 0;

for (const check of checks) {
  const path = resolve(root, check.file);
  const source = readFileSync(path, "utf8");

  for (const pattern of check.patterns || []) {
    if (!pattern.test(source)) {
      console.error(`FAIL ${check.file}: missing ${pattern}`);
      failures += 1;
    }
  }

  for (const pattern of check.forbidden || []) {
    if (pattern.test(source)) {
      console.error(`FAIL ${check.file}: forbidden ${pattern}`);
      failures += 1;
    }
  }
}

if (failures > 0) {
  console.error(`auth migration static check failed with ${failures} issue(s)`);
  process.exit(1);
}

console.log("auth migration static check passed");
