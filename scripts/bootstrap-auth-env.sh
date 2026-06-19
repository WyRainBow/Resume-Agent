#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
WEB_ENV="$ROOT_DIR/web/.env.local"
ROOT_ENV="$ROOT_DIR/.env"
WRITE_ROOT_ENV=false
FORCE=false

usage() {
  cat <<'EOF'
Usage: bash scripts/bootstrap-auth-env.sh [--write-root-env] [--force]

Creates or updates web/.env.local for local Next.js + BetterAuth development.
It never prints secret values.

Options:
  --write-root-env  Append missing BetterAuth handoff keys to the root .env.
  --force           Replace managed keys in web/.env.local.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --write-root-env)
      WRITE_ROOT_ENV=true
      ;;
    --force)
      FORCE=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "unknown option: $1"
      usage
      exit 1
      ;;
  esac
  shift
done

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

strip_python_driver() {
  local raw="$1"
  local python_bin=""

  if [[ -x "$ROOT_DIR/.venv/bin/python" ]]; then
    python_bin="$ROOT_DIR/.venv/bin/python"
  elif command -v python >/dev/null 2>&1; then
    python_bin="python"
  fi

  if [[ -n "$raw" && -n "$python_bin" ]]; then
    ROOT_DIR="$ROOT_DIR" "$python_bin" - "$raw" <<'PY' 2>/dev/null && return
import os
import sys
try:
    root_dir = os.environ.get("ROOT_DIR", "")
    if root_dir and root_dir not in sys.path:
        sys.path.insert(0, root_dir)
    from sqlalchemy.engine import make_url
    from urllib.parse import quote, urlencode
    try:
        from backend.database import engine
        url = engine.url
    except Exception:
        url = make_url(sys.argv[1])
    driver = "postgres" if url.drivername.startswith("postgres+") else "postgresql"
    username = quote(url.username or "", safe="")
    password = quote(url.password or "", safe="")
    auth = ""
    if username:
        auth = username
        if password:
            auth += f":{password}"
        auth += "@"
    host = url.host or ""
    if ":" in host and not host.startswith("["):
        host = f"[{host}]"
    port = f":{url.port}" if url.port else ""
    database = f"/{quote(url.database or '', safe='/')}" if url.database else ""
    query = f"?{urlencode(dict(url.query))}" if url.query else ""
    print(f"{driver}://{auth}{host}{port}{database}{query}")
except Exception:
    raise SystemExit(1)
PY
  fi

  printf '%s' "$raw" \
    | sed 's#^postgresql+psycopg2://#postgresql://#' \
    | sed 's#^postgresql+psycopg://#postgresql://#' \
    | sed 's#^postgres+psycopg://#postgres://#'
}

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 32
    return
  fi

  if command -v node >/dev/null 2>&1; then
    node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("base64"))'
    return
  fi

  echo "missing openssl or node for secret generation" >&2
  exit 1
}

set_env_var() {
  local file="$1"
  local name="$2"
  local value="$3"

  mkdir -p "$(dirname "$file")"
  touch "$file"

  if grep -Eq "^[[:space:]]*${name}=" "$file"; then
    if [[ "$FORCE" == "true" ]]; then
      local tmp_file
      tmp_file="$(mktemp)"
      while IFS= read -r line || [[ -n "$line" ]]; do
        if [[ "$line" =~ ^[[:space:]]*${name}= ]]; then
          printf '%s=%s\n' "$name" "$value" >> "$tmp_file"
        else
          printf '%s\n' "$line" >> "$tmp_file"
        fi
      done < "$file"
      mv "$tmp_file" "$file"
      echo "updated ${name} in ${file#$ROOT_DIR/}"
    else
      echo "kept existing ${name} in ${file#$ROOT_DIR/}"
    fi
  else
    printf '%s=%s\n' "$name" "$value" >> "$file"
    echo "added ${name} to ${file#$ROOT_DIR/}"
  fi
}

root_db_url="$(read_var "$ROOT_ENV" "POSTGRESQL_URL")"
if [[ -z "$root_db_url" ]]; then
  root_db_url="$(read_var "$ROOT_ENV" "DATABASE_URL")"
fi

web_db_url="$(read_var "$WEB_ENV" "BETTER_AUTH_DATABASE_URL")"
if [[ "$FORCE" == "true" && -n "$root_db_url" ]]; then
  web_db_url="$(strip_python_driver "$root_db_url")"
elif [[ -z "$web_db_url" ]]; then
  web_db_url="$(strip_python_driver "$root_db_url")"
fi

if [[ -z "$web_db_url" ]]; then
  echo "warning: no POSTGRESQL_URL or DATABASE_URL found in root .env"
  echo "warning: BETTER_AUTH_DATABASE_URL will need to be filled manually"
  web_db_url="postgresql://resume_user:password@localhost:5432/resume_db"
fi

internal_secret="$(read_var "$ROOT_ENV" "FASTAPI_INTERNAL_AUTH_SECRET")"
if [[ -z "$internal_secret" ]]; then
  internal_secret="$(read_var "$WEB_ENV" "FASTAPI_INTERNAL_AUTH_SECRET")"
fi
if [[ -z "$internal_secret" || "$internal_secret" == replace-* ]]; then
  internal_secret="$(generate_secret)"
fi

better_auth_secret="$(read_var "$WEB_ENV" "BETTER_AUTH_SECRET")"
if [[ -z "$better_auth_secret" || "$better_auth_secret" == replace-* ]]; then
  better_auth_secret="$(generate_secret)"
fi

set_env_var "$WEB_ENV" "BETTER_AUTH_URL" "http://localhost:3000"
set_env_var "$WEB_ENV" "BETTER_AUTH_SECRET" "$better_auth_secret"
set_env_var "$WEB_ENV" "BETTER_AUTH_DATABASE_URL" "$web_db_url"
set_env_var "$WEB_ENV" "AUTH_GOOGLE_ID" "$(read_var "$WEB_ENV" "AUTH_GOOGLE_ID")"
set_env_var "$WEB_ENV" "AUTH_GOOGLE_SECRET" "$(read_var "$WEB_ENV" "AUTH_GOOGLE_SECRET")"
set_env_var "$WEB_ENV" "NEXT_PUBLIC_FASTAPI_BASE_URL" "http://127.0.0.1:9000"
set_env_var "$WEB_ENV" "FASTAPI_INTERNAL_BASE_URL" "http://127.0.0.1:9000"
set_env_var "$WEB_ENV" "FASTAPI_INTERNAL_AUTH_SECRET" "$internal_secret"
set_env_var "$WEB_ENV" "AUTH_PROXY_ALLOWED_ORIGINS" "http://localhost:5173,http://127.0.0.1:5173"

if [[ "$WRITE_ROOT_ENV" == "true" ]]; then
  set_env_var "$ROOT_ENV" "BETTER_AUTH_INTERNAL_URL" "http://localhost:3000"
  set_env_var "$ROOT_ENV" "FASTAPI_INTERNAL_AUTH_SECRET" "$internal_secret"
else
  echo "skipped root .env update; rerun with --write-root-env to append backend handoff keys"
fi

echo "auth env bootstrap finished"
echo "next: bash scripts/check-auth-stack-env.sh"
