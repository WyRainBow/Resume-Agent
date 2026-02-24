# Agent Repo Extraction (implemented scaffold)

This repository now includes a split-target scaffold at:

- `/Users/wy770/Resume-Agent/resume-agent-core`

## What has been implemented

1. New standalone target workspace
- `resume-agent-core/packages/agent-backend`
- `resume-agent-core/packages/agent-web-sdk`
- `resume-agent-core/packages/agent-shared-types`

2. Shared contract types
- SSE event type
- unified error payload type
- structured tool result base types

3. Backend standalone entry
- `resume-agent-core/packages/agent-backend/app/main.py`
- dedicated auth module (`app/auth.py`)
- compatibility + route mode resolver for existing monolith agent routes
  - `AGENT_BACKEND_ROUTE_MODE=transitional|native`
  - runtime inspect: `GET /api/agent/route-mode`

4. Frontend SDK initial surface
- runtime config contract
- callback contract
- `AgentChatShell` MVP (send + SSE stream + session recovery + structured callbacks)

5. Export automation script
- `/Users/wy770/Resume-Agent/scripts/export_agent_core.sh`
- snapshots backend and frontend core modules into `resume-agent-core`

## How to refresh extracted snapshot

```bash
cd /Users/wy770/Resume-Agent
./scripts/export_agent_core.sh
```

## Remaining implementation steps

1. Complete native backend dependency decoupling (`backend.*` imports -> local package modules).
2. Add automated contract/integration tests for stream + history endpoints.
3. Publish `@resume-agent/shared-types` then `@resume-agent/web-sdk` to internal registry.
4. Route main app `/api/agent/*` to standalone service via gateway with 10/50/100% canary.
