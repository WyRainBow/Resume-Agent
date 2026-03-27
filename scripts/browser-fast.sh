#!/usr/bin/env bash

set -euo pipefail

ROOT="/Users/wy770/Resume-Agent"
STATE_DIR="${ROOT}/.browser-fast"
ENV_FILE="${STATE_DIR}/domshell.env"
HARNESS_DIR="${ROOT}/tools/CLI-Anything/browser/agent-harness"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Run bash ${ROOT}/scripts/browser-fast-start.sh first." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "${ENV_FILE}"

cd "${HARNESS_DIR}"
exec uv run --with click --with prompt-toolkit --with mcp \
  python3 -m cli_anything.browser --daemon "$@"
