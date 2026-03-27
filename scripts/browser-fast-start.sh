#!/usr/bin/env bash

set -euo pipefail

ROOT="/Users/wy770/Resume-Agent"
STATE_DIR="${ROOT}/.browser-fast"
LOG_FILE="${STATE_DIR}/domshell.log"
PID_FILE="${STATE_DIR}/domshell.pid"
ENV_FILE="${STATE_DIR}/domshell.env"

mkdir -p "${STATE_DIR}"

TOKEN=""
if [[ -f "${ENV_FILE}" ]]; then
  TOKEN="$(sed -n 's/^export DOMSHELL_TOKEN=//p' "${ENV_FILE}" | tail -n 1)"
fi

if [[ -z "${TOKEN}" ]]; then
  TOKEN="$(openssl rand -hex 24)"
fi

PORT_PID="$(lsof -ti tcp:9876 || true)"
if [[ -n "${PORT_PID}" ]] && [[ ! -f "${PID_FILE}" ]]; then
  echo "Port 9876 is already in use by pid ${PORT_PID}. Stop that DOMShell process first." >&2
  exit 1
fi

if [[ -f "${PID_FILE}" ]]; then
  EXISTING_PID="$(cat "${PID_FILE}")"
  if kill -0 "${EXISTING_PID}" 2>/dev/null; then
    echo "DOMShell already running with pid ${EXISTING_PID}"
  else
    rm -f "${PID_FILE}"
  fi
fi

if [[ ! -f "${PID_FILE}" ]]; then
  nohup npx @apireno/domshell --allow-write --no-confirm --token "${TOKEN}" >"${LOG_FILE}" 2>&1 &
  echo "$!" >"${PID_FILE}"
fi

for _ in $(seq 1 60); do
  if lsof -ti tcp:9876 >/dev/null 2>&1 && lsof -ti tcp:3001 >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! lsof -ti tcp:9876 >/dev/null 2>&1 || ! lsof -ti tcp:3001 >/dev/null 2>&1; then
  if grep -q "Port 9876 is already in use" "${LOG_FILE}" 2>/dev/null; then
    rm -f "${PID_FILE}"
    echo "DOMShell failed to start because port 9876 is already in use." >&2
    exit 1
  fi
  echo "DOMShell failed to start cleanly. Check ${LOG_FILE}" >&2
  exit 1
fi

cat >"${ENV_FILE}" <<EOF
export DOMSHELL_TOKEN=${TOKEN}
EOF

echo "DOMShell token saved to ${ENV_FILE}"
echo "Use this token in DOMShell Options > MCP Bridge:"
echo "${TOKEN}"
echo "Next command:"
echo "bash ${ROOT}/scripts/browser-fast.sh session status"
