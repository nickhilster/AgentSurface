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
