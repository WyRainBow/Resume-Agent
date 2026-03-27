#!/usr/bin/env bash

set -euo pipefail

ROOT="/Users/wy770/Resume-Agent"
STATE_DIR="${ROOT}/.browser-fast"
PID_FILE="${STATE_DIR}/domshell.pid"

if [[ ! -f "${PID_FILE}" ]]; then
  echo "DOMShell is not running"
  exit 0
fi

PID="$(cat "${PID_FILE}")"
if kill -0 "${PID}" 2>/dev/null; then
  kill "${PID}"
  echo "Stopped DOMShell pid ${PID}"
else
  echo "Stale pid file for ${PID}"
fi

rm -f "${PID_FILE}"
