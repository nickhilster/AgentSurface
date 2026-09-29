# BoardyAnimated AgentSurface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a trustworthy Vite/static agent-readable layer to BoardyAnimated and align the Boardy4Age personal-agent guidance with the verified Boardy workflow.

**Architecture:** Add a deterministic Vite/static adapter to AgentSurface, extend the canonical model and generator for public route discovery and static Markdown delivery, then dogfood it against BoardyAnimated. Update only the `/4age/agents/` human-facing channel treatment and its linked Boardy4Age README/protocol language; do not change other page designs.

**Tech Stack:** TypeScript, Node.js, Vitest (AgentSurface), React/Vite static site, HTML, Markdown, native browser preview.

**Spec:** `C:\dev\AgentSurface\docs\superpowers\specs\2026-09-28-boardyanimated-agentsurface-design.md`

## Global Constraints

- Do not invent routes, actions, APIs, auth rules, or capabilities.
- Generated output must be reproducible, source-derived, and safe to regenerate.
- Human-owned files must not be overwritten without explicit ownership rules.
- Public Markdown must omit human-gated page content and pages without verified content boundaries.
- Boardy4Age is user-initiated; do not add Boardy's proactive-memory trigger.
- Primary email connection is required for direct sending; copy-ready email remains an equal path.
- Require useful current progress and a LinkedIn profile before a draft is ready; warn against sharing sensitive details.
- The picker observed on 2026-09-28 displayed iMessage, WhatsApp, X, LinkedIn, and Email; link to the picker for current options.
- Add local brand marks only for named services, keep text labels, and use neutral icons for generic channels.
- Preserve unrelated local work, including `C:\dev\boardy4age\.playwright-mcp\`.
- Do not deploy to production in this plan.

## Review Focus

- A gated static page must never be mirrored just because its HTML contains a `<main>` element.
- A React route must not be fabricated from arbitrary navigation links or query-string test modes.
- Manifest entries without Markdown must link to their canonical HTML route and state their surface type.
- A user without connected email must still be able to prepare a copy-ready message.
- The live picker’s channel list must be dated and must not imply unavailable options.

---

### Task 1: Discover Vite and static/React routes

**Files:**
- Create: `C:\dev\AgentSurface\src\adapters\viteStatic.ts`
- Create: `C:\dev\AgentSurface\src\adapters\viteStatic.test.ts`
- Modify: `C:\dev\AgentSurface\src\commands\inspect.ts`

**Interfaces:**
- Implement `FrameworkAdapter.detect(repo)` and `FrameworkAdapter.inspectRoutes(repo)`.
- Use Vite config plus package metadata as detection evidence.
- Discover `public/**/index.html` pages and explicit route branches in `src/App.tsx` only.
- Populate route provenance with the exact config, HTML, or source file that proves each route.
- Mark static pages using the shared soft gate as `human-gated`, with no content boundary.
- Exclude query-string modes and `/.figma/make/kit.html`.

- [x] Add tests for Vite detection, a static public route, an explicit React route, a soft-gated route, duplicate route precedence, and capture/development exclusions.
- [x] Run `npm test -- src/adapters/viteStatic.test.ts` and confirm the new tests fail for missing adapter behavior.
- [x] Implement the adapter and register it in `runInspect` without changing Next.js adapter behavior.
- [x] Rerun the focused test and `npm test`; both must pass.

### Task 2: Generate public route manifest and static Markdown

**Files:**
- Modify: `C:\dev\AgentSurface\src\types\model.ts`
- Modify: `C:\dev\AgentSurface\src\types\config.ts`
- Modify: `C:\dev\AgentSurface\src\config.ts`
- Modify: `C:\dev\AgentSurface\src\commands\generate.ts`
- Modify: `C:\dev\AgentSurface\src\commands\validate.ts`
- Modify: corresponding `generate.test.ts`, `validate.test.ts`, and config tests

**Interfaces:**
- Add a configurable public Markdown output directory while preserving the current internal generated-page default for existing targets.
- Project `.agentsurface/model/routes.json` into `public/agentsurface/routes.json` with `path`, deterministic title or path fallback, HTML URL, nullable Markdown URL, `surfaceType`, `sourceFiles`, and verified requirements.
- Write Markdown pages under the configured `public/agentsurface/pages/` directory.
- Include every intended public route in `llms.txt`; point to Markdown when generated, otherwise to HTML.
- Validate route parity, manifest shape, output ownership, and every local discovery target.

- [x] Add generator/validator tests for Markdown URL mapping, HTML-only routes, human-gated routes, missing assets, and refusal to overwrite an unowned manifest.
- [x] Run the affected Vitest files and confirm the new cases fail before implementation.
- [x] Implement output paths, route manifest projection, and validation.
- [x] Run focused tests, then the complete AgentSurface Vitest suite; all must pass.

### Task 3: Dogfood AgentSurface on BoardyAnimated

**Files:**
- Create: `C:\dev\BoardyAnimated-boardy4age-agents\.agentsurface\config.yaml`
- Generated: `C:\dev\BoardyAnimated-boardy4age-agents\.agentsurface\model\*`
- Generated: `C:\dev\BoardyAnimated-boardy4age-agents\public\llms.txt`
- Generated: `C:\dev\BoardyAnimated-boardy4age-agents\public\agentsurface\routes.json`
- Generated: `C:\dev\BoardyAnimated-boardy4age-agents\public\agentsurface\pages\*.md`

**Interfaces:**
- Configure site name and `boardyanimated.vercel.app` hostname.
- Use `public` as the public output root and `public/agentsurface/pages` for Markdown.
- Start the Vite dev server and pass its base URL to AgentSurface generation and validation.

- [ ] Inspect the generated model and confirm route inventory against static HTML and `src/App.tsx`; correct only deterministic adapter/config issues.
- [ ] Generate outputs and confirm gated pages have no Markdown body, React-only pages use HTML URLs, and all outputs carry AgentSurface ownership metadata.
- [ ] Run AgentSurface validation and resolve every route, discovery, ownership, or drift error.

### Task 4: Align Boardy4Age guidance and channel presentation

**Files:**
- Modify: `C:\dev\BoardyAnimated-boardy4age-agents\public\4age\agents\index.html`
- Modify: `C:\dev\BoardyAnimated-boardy4age-agents\public\4age\agents\agents.css`
- Add locally sourced brand assets under `C:\dev\BoardyAnimated-boardy4age-agents\public\assets\svg\` as needed
- Modify: `C:\dev\boardy4age\README.md` after fast-forwarding `master` to `origin/master`
- Modify: `C:\dev\boardy4age\AGENT_PROTOCOL.md` after fast-forwarding `master` to `origin/master`

**Interfaces:**
- Copy-ready email is available whether or not a sending account is connected; connection is required only for direct sending.
- Before finalizing the draft, confirm the user's useful current progress and LinkedIn profile; ask one concise follow-up for whichever is missing.
- Add one concise sensitive-information warning on the page and link to `AGENT_PROTOCOL.md`.
- Retain explicit user approval of the exact message and the user-initiated trigger.
- Show the dated picker list observed on 2026-09-28: iMessage, WhatsApp, X, LinkedIn, Email. Keep a link to the live picker.
- Pair each named service logo with visible text; use neutral accessible icons for generic email/text/phone options.

- [ ] Update the page, README, and protocol so they agree on connected-email and copy-ready paths, required brief information, privacy warning, and the user-initiated boundary.
- [ ] Add accessible local service marks to the channel cards while retaining all text labels and responsive layout.
- [ ] Preserve the collapsed agent-instructions section and the existing two-mode explanation.
- [ ] Confirm `.playwright-mcp/` remains untracked and untouched after the fast-forward and edits.

### Task 5: Build and verify local delivery

**Files:**
- No new source files; validate generated outputs and affected page.

- [ ] Run `npm run build` in `C:\dev\AgentSurface` and `C:\dev\BoardyAnimated-boardy4age-agents`.
- [ ] Run Vite preview and request `/llms.txt`, `/agentsurface/routes.json`, each generated Markdown URL, and the HTML route for every HTML-only manifest entry.
- [ ] Confirm response status/content types, manifest-to-file parity, visible text labels, keyboard focus, and mobile channel-card wrapping.
- [ ] Review Git status in all three repositories; ensure `.playwright-mcp/` and unrelated changes remain untouched.


