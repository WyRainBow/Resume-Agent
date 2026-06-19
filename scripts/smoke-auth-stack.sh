#!/usr/bin/env bash
set -euo pipefail

WEB_BASE_URL="${WEB_BASE_URL:-http://localhost:3000}"
FASTAPI_BASE_URL="${FASTAPI_BASE_URL:-http://127.0.0.1:9000}"
LEGACY_FRONTEND_ORIGIN="${LEGACY_FRONTEND_ORIGIN:-http://localhost:5173}"
CURL_TIMEOUT_SECONDS="${CURL_TIMEOUT_SECONDS:-8}"
SKIP_BETTER_AUTH_DB_CHECK="${SKIP_BETTER_AUTH_DB_CHECK:-false}"

failures=0

print_header() {
  printf '\n== %s ==\n' "$1"
}

request_status() {
  local url="$1"
  curl \
    --silent \
    --output /dev/null \
    --write-out '%{http_code}' \
    --max-time "$CURL_TIMEOUT_SECONDS" \
    "$url"
}

request_options_status() {
  local url="$1"
  curl \
    --silent \
    --output /dev/null \
    --request OPTIONS \
    --header "Origin: $LEGACY_FRONTEND_ORIGIN" \
    --header "Access-Control-Request-Method: GET" \
    --write-out '%{http_code}' \
    --max-time "$CURL_TIMEOUT_SECONDS" \
    "$url"
}

expect_status() {
  local label="$1"
  local url="$2"
  local expected_csv="$3"
  local status

  if ! status="$(request_status "$url")"; then
    printf 'FAIL %-34s %s -> request failed\n' "$label" "$url"
    failures=$((failures + 1))
    return
  fi

  if [[ ",$expected_csv," == *",$status,"* ]]; then
    printf 'PASS %-34s %s -> %s\n' "$label" "$url" "$status"
  else
    printf 'FAIL %-34s %s -> %s, expected one of [%s]\n' \
      "$label" "$url" "$status" "$expected_csv"
    failures=$((failures + 1))
  fi
}

expect_json_field() {
  local label="$1"
  local url="$2"
  local field="$3"
  local body

  if ! body="$(curl --silent --max-time "$CURL_TIMEOUT_SECONDS" "$url")"; then
    printf 'FAIL %-34s %s -> request failed\n' "$label" "$url"
    failures=$((failures + 1))
    return
  fi

  if printf '%s' "$body" | grep -q "\"$field\""; then
    printf 'PASS %-34s %s -> contains \"%s\"\n' "$label" "$url" "$field"
  else
    printf 'FAIL %-34s %s -> missing JSON field \"%s\"\n' "$label" "$url" "$field"
    failures=$((failures + 1))
  fi
}

expect_options_status() {
  local label="$1"
  local url="$2"
  local expected_csv="$3"
  local status

  if ! status="$(request_options_status "$url")"; then
    printf 'FAIL %-34s %s -> preflight failed\n' "$label" "$url"
    failures=$((failures + 1))
    return
  fi

  if [[ ",$expected_csv," == *",$status,"* ]]; then
    printf 'PASS %-34s %s -> OPTIONS %s\n' "$label" "$url" "$status"
  else
    printf 'FAIL %-34s %s -> OPTIONS %s, expected one of [%s]\n' \
      "$label" "$url" "$status" "$expected_csv"
    failures=$((failures + 1))
  fi
}

is_truthy() {
  local value
  value="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  [[ "$value" == "1" || "$value" == "true" || "$value" == "yes" || "$value" == "on" ]]
}

print_header "Auth Stack Smoke"
printf 'WEB_BASE_URL=%s\n' "$WEB_BASE_URL"
printf 'FASTAPI_BASE_URL=%s\n' "$FASTAPI_BASE_URL"
printf 'LEGACY_FRONTEND_ORIGIN=%s\n' "$LEGACY_FRONTEND_ORIGIN"

print_header "Next.js"
expect_status "web home" "$WEB_BASE_URL/" "200,307,308"
expect_status "betterauth get-session" "$WEB_BASE_URL/api/auth/get-session" "200,401"

print_header "FastAPI"
expect_status "fastapi health" "$FASTAPI_BASE_URL/api/health" "200"
expect_status "betterauth health" "$FASTAPI_BASE_URL/api/auth/better/health" "200"
expect_json_field \
  "betterauth entitlement table" \
  "$FASTAPI_BASE_URL/api/auth/better/health" \
  "entitlement_table_ready"

print_header "BetterAuth Database"
if is_truthy "$SKIP_BETTER_AUTH_DB_CHECK"; then
  printf 'SKIP BetterAuth database readiness check\n'
else
  if (cd web && npm run --silent check:auth-db); then
    printf 'PASS BetterAuth database readiness\n'
  else
    printf 'FAIL BetterAuth database readiness\n'
    failures=$((failures + 1))
  fi
fi

print_header "Next -> FastAPI Proxy"
expect_options_status "proxy cors preflight" "$WEB_BASE_URL/api/fastapi/proxy/health" "204"
expect_status "proxy health" "$WEB_BASE_URL/api/fastapi/proxy/health" "200"
expect_options_status "account cors preflight" "$WEB_BASE_URL/api/fastapi/account" "204"
expect_status "account requires login" "$WEB_BASE_URL/api/fastapi/account" "401"

if [[ "$failures" -gt 0 ]]; then
  printf '\nSmoke check failed with %s issue(s).\n' "$failures"
  exit 1
fi

printf '\nSmoke check passed.\n'
