#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
CONFIRM="${AUTH_DB_MIGRATE_CONFIRM:-false}"

is_truthy() {
  local value
  value="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  [[ "$value" == "1" || "$value" == "true" || "$value" == "yes" || "$value" == "on" ]]
}

if ! is_truthy "$CONFIRM"; then
  cat <<'EOF'
Refusing to run BetterAuth database migration without explicit confirmation.

This command writes BetterAuth tables to the configured BETTER_AUTH_DATABASE_URL.
First confirm the target database, then run:

  AUTH_DB_MIGRATE_CONFIRM=true bash scripts/migrate-better-auth-db.sh

EOF
  exit 1
fi

bash "$ROOT_DIR/scripts/check-auth-stack-env.sh"

cd "$ROOT_DIR/web"
npm run auth:migrate
npm run check:auth-db
