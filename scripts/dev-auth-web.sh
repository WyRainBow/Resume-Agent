#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -f "$ROOT_DIR/web/.env.local" ]]; then
  echo "web/.env.local is missing. Start with: cp web/.env.example web/.env.local"
  exit 1
fi

echo "Starting Next.js auth shell on http://localhost:3000"
echo "Keep FastAPI running separately on http://127.0.0.1:9000"
cd "$ROOT_DIR/web"
npm run dev
