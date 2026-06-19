#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
WEB_ENV="$ROOT_DIR/web/.env.local"
ROOT_ENV="$ROOT_DIR/.env"
AUTH_ENV_REQUIRE_GOOGLE="${AUTH_ENV_REQUIRE_GOOGLE:-false}"

missing=0
warnings=0

is_truthy() {
  local value
  value="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  [[ "$value" == "1" || "$value" == "true" || "$value" == "yes" || "$value" == "on" ]]
}

read_var() {
  local file="$1"
  local name="$2"
  if [[ ! -f "$file" ]]; then
    return 0
  fi
  grep -E "^[[:space:]]*${name}=" "$file" 2>/dev/null \
    | tail -n 1 \
    | sed -E "s/^[[:space:]]*${name}=//" \
    | sed -E 's/^["'\'']//; s/["'\'']$//' \
    || true
}

is_placeholder() {
  local value="$1"
  [[ -z "$value" || "$value" == replace-* || "$value" == *"password@localhost"* ]]
}

check_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "missing file: ${file#$ROOT_DIR/}"
    missing=1
  fi
}

check_var() {
  local file="$1"
  local name="$2"
  if [[ ! -f "$file" ]] || ! grep -Eq "^[[:space:]]*${name}=" "$file"; then
    echo "missing ${name} in ${file#$ROOT_DIR/}"
    missing=1
    return
  fi

  local value
  value="$(read_var "$file" "$name")"
  if is_placeholder "$value"; then
    echo "placeholder or empty ${name} in ${file#$ROOT_DIR/}"
    missing=1
  fi
}

warn_optional_var() {
  local file="$1"
  local name="$2"
  if [[ ! -f "$file" ]] || ! grep -Eq "^[[:space:]]*${name}=" "$file"; then
    echo "warning: missing optional ${name} in ${file#$ROOT_DIR/}"
    warnings=$((warnings + 1))
    return
  fi

  local value
  value="$(read_var "$file" "$name")"
  if is_placeholder "$value"; then
    echo "warning: placeholder or empty optional ${name} in ${file#$ROOT_DIR/}"
    warnings=$((warnings + 1))
  fi
}

check_file "$WEB_ENV"
check_file "$ROOT_ENV"

check_var "$WEB_ENV" "BETTER_AUTH_URL"
check_var "$WEB_ENV" "BETTER_AUTH_SECRET"
check_var "$WEB_ENV" "BETTER_AUTH_DATABASE_URL"
check_var "$WEB_ENV" "FASTAPI_INTERNAL_AUTH_SECRET"
check_var "$WEB_ENV" "FASTAPI_INTERNAL_BASE_URL"

if is_truthy "$AUTH_ENV_REQUIRE_GOOGLE"; then
  check_var "$WEB_ENV" "AUTH_GOOGLE_ID"
  check_var "$WEB_ENV" "AUTH_GOOGLE_SECRET"
else
  warn_optional_var "$WEB_ENV" "AUTH_GOOGLE_ID"
  warn_optional_var "$WEB_ENV" "AUTH_GOOGLE_SECRET"
fi

check_var "$ROOT_ENV" "BETTER_AUTH_INTERNAL_URL"
check_var "$ROOT_ENV" "FASTAPI_INTERNAL_AUTH_SECRET"

web_internal_secret="$(read_var "$WEB_ENV" "FASTAPI_INTERNAL_AUTH_SECRET")"
root_internal_secret="$(read_var "$ROOT_ENV" "FASTAPI_INTERNAL_AUTH_SECRET")"
if [[ -n "$web_internal_secret" && -n "$root_internal_secret" && "$web_internal_secret" != "$root_internal_secret" ]]; then
  echo "FASTAPI_INTERNAL_AUTH_SECRET differs between web/.env.local and .env"
  missing=1
fi

if [[ "$missing" -ne 0 ]]; then
  echo "auth stack env check failed"
  exit 1
fi

if [[ "$warnings" -gt 0 ]]; then
  echo "auth stack env check passed with ${warnings} warning(s)"
  echo "set AUTH_ENV_REQUIRE_GOOGLE=true to make Google OAuth keys mandatory"
else
  echo "auth stack env check passed"
fi
