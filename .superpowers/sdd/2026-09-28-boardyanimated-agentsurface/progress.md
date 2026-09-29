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

- Follow-up regression from BoardyAnimated preview: drift checks now fetch each route's canonical path (including its trailing slash) while comparing generated Markdown paths in normalized form. Focused validator tests pass (11/11); live local validation passed with 4 Markdown routes and 15 discovery links.

### Task 3: Dogfood AgentSurface on BoardyAnimated — complete

- Inspected 15 source-derived routes: seven static routes and eight explicit React routes; no query-string or development routes entered the model.
- Generated 4 static Markdown mirrors, `llms.txt`, and a 15-route JSON manifest. All three soft-gated pages have no Markdown body; React routes are HTML-only.
- Manifest source files exist; route requirements for Meet context and microphone permission are source-derived. Repeated generation remained byte-stable across six public outputs.
- The first Vite dev-server pass served an SPA shell at nested static paths. The production-style preview served actual static HTML; final route validation passed (4 generated, 15 discovery links).
- All 15 manifest targets returned HTTP 200. `llms.txt` served as `text/plain`, the manifest as `application/json`, Markdown as `text/markdown`.
- Dogfood report: `docs/dogfood-reports/2026-09-28-boardyanimated.md`.
- Target generated layer committed as `fed1f01`.

### Task 4: Align Boardy4Age guidance and channel presentation — complete

- Page, README, and `AGENT_PROTOCOL.md` now make connected email a direct-send prerequisite only; copy-ready email remains an equal route.
- Current progress and LinkedIn profile are required before drafting; missing information prompts one concise question. The page has one sensitive-information warning linking to the protocol.
- The page and protocol preserve user initiation and the two-mode distinction. The collapsed copy instructions still list Boardy's visible channels and link the live picker.
- Channel snapshot is dated September 28, 2026: iMessage, WhatsApp, X, LinkedIn, Email. Local accessible brand marks are paired with text labels; email uses a neutral icon.
- README/protocol committed in Boardy4Age as `c18bee9`; page and local assets committed as `6ae1c58`.

### Task 5: Build and verify local delivery — complete

- AgentSurface: 60 Vitest tests passed, typecheck and TypeScript build passed.
- BoardyAnimated: Vite production build passed; keyboard Space opened the collapsed agent instructions; mobile viewport (390px) used two columns with no horizontal overflow; all logos loaded.
- A reversible source probe caused drift validation to report stale `/4age/agents/`; after source restoration and rebuild, validation passed.
- Final local smoke verified all 15 manifest target URLs plus `/llms.txt` and `/agentsurface/routes.json`. No production deploy was performed.

## Final self-review

- Re-read the implementation diff and checked route, manifest, generated-output, README, protocol, and page wording against the approved spec.
- Kept the unrelated `docs/boardy-agents-page-comparison.md` and `.playwright-mcp/` untouched.
- Rulings: canonical trailing slash retained for static HTML URLs; generated Markdown paths normalize route slashes. Human-gated pages remain discoverable as HTML but have no public Markdown body. Current channel claims are dated and link to the live picker.
- Deferred minors: React experiences remain HTML-only until a deterministic text boundary exists; LinkedIn logo was retrieved from the Simple Icons latest endpoint where the pinned v16 path returned 404; Apple mark shown with iMessage is Apple's brand mark, not a dedicated Messages app icon. CLI hardening notes remain a separate workstream.
