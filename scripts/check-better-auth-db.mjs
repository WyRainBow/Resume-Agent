#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(new URL("..", import.meta.url).pathname);
const requireFromWeb = createRequire(resolve(root, "web/package.json"));
const { Pool } = requireFromWeb("pg");
const { getAuthTables } = await import(
  pathToFileURL(requireFromWeb.resolve("@better-auth/core/db")).href
);

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const env = {};
  const source = readFileSync(path, "utf8");
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
  return env;
}

function stripPythonDriver(url) {
  return url
    .replace("postgresql+psycopg2://", "postgresql://")
    .replace("postgresql+psycopg://", "postgresql://")
    .replace("postgres+psycopg://", "postgres://");
}

function getDatabaseUrl() {
  const rootEnv = readEnvFile(resolve(root, ".env"));
  const webEnv = readEnvFile(resolve(root, "web/.env.local"));
  const raw =
    process.env.BETTER_AUTH_DATABASE_URL ||
    webEnv.BETTER_AUTH_DATABASE_URL ||
    process.env.POSTGRESQL_URL ||
    rootEnv.POSTGRESQL_URL ||
    process.env.DATABASE_URL ||
    rootEnv.DATABASE_URL ||
    "";

  return stripPythonDriver(raw.trim());
}

function getSslConfig(connectionString) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error(
      "BetterAuth database URL is not a valid Node/Postgres URL. Check percent-encoding for username/password.",
    );
  }
  const sslOverride = String(process.env.BETTER_AUTH_DATABASE_SSL || "")
    .trim()
    .toLowerCase();
  const sslMode = url.searchParams.get("sslmode")?.toLowerCase() || "";

  if (["0", "false", "no", "off"].includes(sslOverride) || sslMode === "disable") {
    return { explicit: true, ssl: false };
  }

  if (
    ["1", "true", "yes", "on"].includes(sslOverride) ||
    ["require", "prefer", "verify-ca", "verify-full", "no-verify"].includes(sslMode)
  ) {
    return {
      explicit: true,
      ssl: { rejectUnauthorized: sslMode === "verify-full" },
    };
  }

  return { explicit: false, ssl: false };
}

function getPoolOptions(connectionString, ssl) {
  const options = {
    connectionString,
    max: 1,
    idleTimeoutMillis: 1_000,
    connectionTimeoutMillis: 5_000,
  };

  if (ssl) {
    options.ssl = ssl;
  }

  return options;
}

function getExpectedSchema() {
  const tables = getAuthTables({
    emailAndPassword: { enabled: true },
    plugins: [],
  });

  return Object.entries(tables).map(([, table]) => ({
    tableName: table.modelName,
    columns: [
      "id",
      ...Object.entries(table.fields).map(([fieldName, field]) => field.fieldName || fieldName),
    ].filter((column, index, columns) => columns.indexOf(column) === index),
  }));
}

const databaseUrl = getDatabaseUrl();
if (!databaseUrl) {
  console.error("FAIL BetterAuth database URL is not configured");
  process.exit(1);
}

async function runReadinessCheck(connectionString, ssl) {
  const pool = new Pool(getPoolOptions(connectionString, ssl));
  let failures = 0;
  try {
    const schemaResult = await pool.query("select current_schema() as schema");
    const schema = schemaResult.rows[0]?.schema || "public";
    console.log(`checking BetterAuth tables in schema: ${schema}`);

    for (const expected of getExpectedSchema()) {
      const tableResult = await pool.query(
        `
          select column_name
          from information_schema.columns
          where table_schema = $1 and table_name = $2
        `,
        [schema, expected.tableName],
      );

      if (tableResult.rowCount === 0) {
        console.error(`FAIL missing table: ${expected.tableName}`);
        failures += 1;
        continue;
      }

      const existingColumns = new Set(tableResult.rows.map((row) => row.column_name));
      const missingColumns = expected.columns.filter((column) => !existingColumns.has(column));
      if (missingColumns.length > 0) {
        console.error(
          `FAIL ${expected.tableName} missing columns: ${missingColumns.join(", ")}`,
        );
        failures += 1;
        continue;
      }

      console.log(`PASS ${expected.tableName}`);
    }
  } finally {
    await pool.end().catch(() => {});
  }
  return failures;
}

const sslConfig = getSslConfig(databaseUrl);
let failures = 0;

try {
  failures = await runReadinessCheck(databaseUrl, sslConfig.ssl);
} catch (error) {
  const firstMessage = error instanceof Error ? error.message : String(error);
  if (!sslConfig.explicit) {
    console.log("initial database connection failed; retrying with SSL enabled");
    try {
      failures = await runReadinessCheck(databaseUrl, { rejectUnauthorized: false });
    } catch (retryError) {
      const retryMessage =
        retryError instanceof Error ? retryError.message : String(retryError);
      console.error("FAIL BetterAuth database readiness check failed");
      console.error(`no-ssl: ${firstMessage}`);
      console.error(`ssl: ${retryMessage}`);
      failures += 1;
    }
  } else {
    console.error(`FAIL BetterAuth database readiness check failed: ${firstMessage}`);
    failures += 1;
  }
}

if (failures > 0) {
  console.error(`BetterAuth database check failed with ${failures} issue(s)`);
  process.exit(1);
}

console.log("BetterAuth database check passed");
