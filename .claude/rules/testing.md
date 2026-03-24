---
paths:
  - "**/*"
---

# Testing Rules

- Verify changed behavior before claiming completion
- Prefer the smallest relevant check first, then expand if needed
- If a test or build cannot be run, state that explicitly
- Do not claim files are tracked by Git when they are ignored by `.gitignore`
