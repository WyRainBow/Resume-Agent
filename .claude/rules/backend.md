---
paths:
  - "backend/**/*"
---

# Backend Rules

- Follow existing FastAPI structure and import patterns in `backend/`
- Keep route, service, and model changes narrowly scoped to the task
- Prefer targeted verification before broad test runs
- Do not change runtime ports, environment contracts, or API shapes unless the user asked for it
