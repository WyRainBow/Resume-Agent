---
paths:
  - "frontend/**/*"
---

# Frontend Rules

- Follow existing React, TypeScript, and Vite patterns already present in `frontend/`
- Keep UI changes localized; avoid broad refactors unless explicitly requested
- Prefer verifying frontend work with `cd frontend && npm run build`
- Do not introduce new global styling or structural UI changes without checking nearby patterns first
