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
- Design docs, plans, reviews, and operation records go in `knowledge-base/`
- Exception — domain docs live in place and are committed: root `CONTEXT.md` (glossary), `docs/adr/` (architecture decision records), `docs/agents/` (engineering-skill config). See CLAUDE.md §4.0/§4.4

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

## Deployment
- Deploy = `git push origin main`; a server cron auto-pulls, rebuilds (frontend + web), and restarts pm2.
- **Before pushing to main, update the `CHANGELOG` array in `frontend/src/data/changelog.ts`:**
  - Bump `version` (patch +0.0.1, e.g. `2.4.1` → `2.4.2`; larger features +0.1.0)
  - Set `date` to today, **date only (`YYYY-MM-DD`), never include time**; write `added` / `fixed` as short user-facing Chinese (no tech/ops details)
  - **Multiple deploys on the same day merge into ONE entry** (fold new items into today's entry and raise its version; do not append another entry)
  - Commit the changelog together with the release code, then push
- Users see a「有什么新变化」modal (`ChangelogModal`) on first visit after each version bump.

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
