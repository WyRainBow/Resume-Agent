# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Layout: single-context

```
/
├── CONTEXT.md          (not created yet)
├── docs/adr/           (not created yet)
└── frontend/, backend/
```

Resume-Agent is treated as a single-context repo — one `CONTEXT.md` + `docs/adr/` at the root, even though it has separate `frontend/` and `backend/` trees.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, if it exists.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in.

Neither exists yet. **Proceed silently** — don't flag their absence, don't suggest creating them upfront. `/domain-modeling` (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

Note: this repo already has its own `knowledge-base/` for specs, plans, and reviews (see root `CLAUDE.md` §0). `CONTEXT.md` / `docs/adr/` are a different, narrower thing — ubiquitous-language glossary and architectural decision records — not a replacement for `knowledge-base/`.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md` once it exists. Don't drift to synonyms the glossary explicitly avoids.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding.
