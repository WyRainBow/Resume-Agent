# AGENTS.md

## Project Overview
- Resume-Agent monorepo with `frontend/` and `backend/`
- Backend is FastAPI served from `backend/main.py`
- Frontend is React + TypeScript + Vite in `frontend/`

## Knowledge Base
- Design specs and plans: `knowledge-base/` (committed, version controlled)
  - Specs: `knowledge-base/specs/YYYY-MM-DD-<topic>-design.md`
  - Plans: `knowledge-base/plans/YYYY-MM-DD-<feature>.md`
- `knowledge/` is local-only and ignored by Git (legacy)
- All architectural decisions, design docs, and operation records go in `knowledge-base/`

## Architecture Notes
- Backend agent (`backend/agent/`) was merged back from `resume-agent-core` on 2026-03-23
  - No separate agent service on port 9100; agent runs in-process with main backend
  - `AGENT_BACKEND_BASE_URL` is commented out in `.env`
- Active design: natural language resume refactor (see `knowledge-base/specs/2026-03-23-nl-resume-refactor-design.md`)
- Active plan: `knowledge-base/plans/2026-03-24-nl-resume-refactor.md`

## Setup
- Backend dependencies: `uv pip install -r requirements.txt`
- Frontend dependencies: `cd frontend && npm install`

## Run
- Backend: `python -m uvicorn backend.main:app --host 127.0.0.1 --port 9000`
- Frontend: `cd frontend && npm run dev`

## Testing
- Frontend verification: `cd frontend && npm run build`
- Backend verification: run targeted checks first; use `pytest` when tests exist or are added

## Conventions
- Prefer minimal diffs
- Do not modify unrelated files
- Read existing files and follow existing patterns before editing
- Preserve user changes already present in the worktree
- Do not move or rename files unless the user asked for it

## Repository Notes
- Main app API runs on port `9000`
- Root `README.md` is ignored in this repository; do not rely on Git status alone to judge doc changes
- `docs/` is not the primary knowledge storage location for local project notes
