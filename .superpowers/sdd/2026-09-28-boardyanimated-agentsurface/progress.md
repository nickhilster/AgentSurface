# Progress: BoardyAnimated AgentSurface implementation

Plan: `docs/superpowers/plans/2026-09-28-boardyanimated-agentsurface.md`

## Tasks

- [ ] Task 1: Discover Vite and static/React routes
- [ ] Task 2: Generate public route manifest and static Markdown
- [ ] Task 3: Dogfood AgentSurface on BoardyAnimated
- [ ] Task 4: Align Boardy4Age guidance and channel presentation
- [ ] Task 5: Build and verify local delivery

## Decisions and rulings

- Implementing in isolated `codex/boardyanimated-agentsurface` worktree based on the existing AgentSurface `main` tip, which was already three local commits ahead of `origin/main`.
- Preserve `C:\dev\BoardyAnimated-boardy4age-agents\docs\boardy-agents-page-comparison.md` and `C:\dev\boardy4age\.playwright-mcp\`.
- No production deployment or remote push is included.

## Deferred minors

- None yet.

### Task 1: Discover Vite and static/React routes — complete

- Added `ViteStaticAdapter` with Vite evidence detection, static `public/**/index.html` discovery, explicit `src/App.tsx` pathname branches, static-file precedence, and soft-gate suppression.
- Static route paths preserve their trailing slash; duplicate comparison normalizes it. Test and development query modes are not enumerated.
- Added adapter tests; the initial red run failed because the adapter module was missing. Focused tests pass (5/5), complete AgentSurface suite passes (51/51), and typecheck passes.
- `npm ci` installed lockfile-pinned dependencies in this fresh worktree; npm reported 5 existing dependency advisories, not introduced by source edits.

### Task 2: Generate public route manifest and static Markdown — complete

- Added optional `output.markdownDir`; targets without it retain the existing `.agentsurface/generated/pages` behavior.
- Public mode generates Markdown under the configured directory, `llms.txt` links generated Markdown or canonical HTML, and `public/agentsurface/routes.json` carries ownership metadata, titles/path fallbacks, HTML/Markdown URLs, surface type, source files, and source-verified requirements.
- Human-gated pages are skipped before fetching rendered content. Ownership checks protect the route manifest and Markdown files.
- Validator checks public manifest shape, route parity, ownership, source paths, Markdown targets, and preview reachability for HTML-only routes.
- Red runs failed for the absent public Markdown and validator manifest behavior. Targeted suite passes (32/32), full suite and build run below.
