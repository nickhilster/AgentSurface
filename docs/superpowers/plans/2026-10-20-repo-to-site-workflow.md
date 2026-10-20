# Repo-to-Site Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first working AgentSurface repo-to-site workflow: portable instructions for a coding agent plus a small static website example whose discovery page returns source-backed results with exact item links.

**Architecture:** Keep AgentSurface's current TypeScript CLI as the deterministic inspection and validation layer. Add an agent-neutral workflow guide that tells a coding agent how to use repository evidence and make site-native changes. Prove the workflow with a small static catalogue example backed by its own source data; keep the discovery page ordinary accessible HTML and use the site's existing canonical item pages. Treat OpenAPI, MCP, and host adapters as optional integrations.

**Tech Stack:** Existing TypeScript/Node.js ESM, Vitest, plain HTML/CSS/JavaScript for the static example. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-19-repo-to-agent-surface-design.md`, `docs/SPEC.md`.

## Global Constraints

- “A separate public API/OpenAPI contract is not a prerequisite when the repository contains a usable source.”
- “The baseline runtime surface is ordinary web content and navigation: accessible HTML, URLs, forms, and exact first-party links.”
- “Every item result must identify the exact canonical detail page when the source supports one; a category or generic search URL is not equivalent.”
- “Never invent routes, actions, APIs, entities, auth rules, capabilities, or data sources.”
- “Preserve the human-facing website and owner-controlled files.”
- “Discovery is bounded, source-backed, and read-only. Transactions and user-data submission are out of scope.”
- “A default dogfood run uses a fixture repository until a real website repository is explicitly available and authorized for changes.”

## Review Focus

- A fixture record with a missing or malformed canonical item URL is not linked to a category/search URL; pin with an invalid-destination test.
- Search criteria unsupported by the fixture source are ignored or reported, never treated as a successful match; pin with an unsupported-filter test.
- An empty query and no filters do not dump the full catalogue; pin with a bounded-result test.
- Private or non-public fixture records never appear in public discovery; pin with an eligibility test.
- Query input is rendered as text and cannot inject HTML into results; pin with an escaping test.

---

### Task 1: Add the portable coding-agent workflow

**Files:**
- Create: `AGENT_SURFACE.md`
- Modify: `README.md`
- Modify: `ROADMAP.md`
- Modify: `OPERATE.md` only if workflow instructions need a stable source link

**Interfaces:**
- Produces: a vendor-neutral, repo-root workflow document a coding agent can follow to inspect, plan, implement, and verify a site-native agent discovery surface.
- The guide directs the agent to use existing repository data and routes, use `agentsurface inspect`/`validate` where available, make reviewable changes, and report exact item-link evidence and unknowns.
- The guide must not require a public API contract, MCP server, or host adapter when repository data access and ordinary web links suffice.

- [x] Review the current CLI commands and target workflow described in the spec; write the guide with the exact current commands and honest implementation status.
- [x] Update README and roadmap to make repo-to-site transformation the first product milestone and mark provider/MCP/host integrations optional.
- [x] Check every guide command and linked file against the repository; run `git diff --check`.
- [x] Commit as `docs: add repo-to-site agent workflow`.

### Task 2: Build a small static catalogue reference site

**Files:**
- Create: `examples/static-catalog-site/index.html`
- Create: `examples/static-catalog-site/catalog.json`
- Create: `examples/static-catalog-site/discover.html`
- Create: `examples/static-catalog-site/discovery.js`
- Create: `examples/static-catalog-site/products/<item-id>/index.html` for fixture items
- Create: `examples/static-catalog-site/styles.css`
- Create: `examples/static-catalog-site/discovery.test.ts`

**Interfaces:**
- Consumes: the example's `catalog.json` as the authoritative source for public fixture products and their canonical routes.
- Produces: a static, human-readable discovery page that searches a bounded set from the local catalogue and links each result to its exact product detail page.
- Each catalogue entry has stable `id`, `name`, public searchable attributes, `public` status, and `canonicalPath`; item detail pages expose matching identity and canonical metadata.
- `discovery.js` exports pure helpers for filtering, limiting, canonical-link selection, and safe text rendering so they can be tested without a browser.

- [x] Add failing tests for `filtersBySupportedQueryAndFields`, `excludesNonPublicItems`, `capsUnfilteredResults`, `usesExactCanonicalItemLinks`, `rejectsMalformedCanonicalPath`, `reportsUnsupportedFilters`, and `escapesQueryText`.
- [x] Run the focused fixture tests and confirm each fails for the intended missing behavior.
- [x] Implement the smallest accessible HTML/JS/CSS static site using the source catalogue; use ordinary URLs and exact item routes, with no new runtime dependency.
- [x] Run the focused tests and `npm test`; expected: all pass and links match fixture records.
- [x] Commit as `feat: add static catalog discovery example`.

### Task 3: Dogfood the portable workflow on the example site

**Files:**
- Modify: `AGENT_SURFACE.md` only if the example exposes a real workflow gap
- Create: `docs/dogfood-reports/2026-10-20-static-site-transformation.md`

**Interfaces:**
- Consumes: Task 1 workflow and Task 2 reference site.
- Produces: an evidence-based report documenting repository inspection, source identification, implementation choices, ordinary browser flow, exact item route checks, privacy/freshness claims, verification, and remaining gaps.
- The report must distinguish this static fixture from real dynamic inventory and real-host support.

- [x] Follow `AGENT_SURFACE.md` step by step against the example repository and record any instructions that cannot be followed as written.
- [x] Verify the example can be served as static files and that each result link resolves to the intended product page.
- [x] Record tests/build/route checks and the limits of the static catalogue.
- [x] Run `git diff --check` and review the report against actual evidence.
- [x] Commit as `docs: record static repo-to-site dogfood`.

### Task 4: Verify the complete first vertical slice

**Files:**
- Modify: `ROADMAP.md` only for milestones actually demonstrated
- Modify: `docs/SPEC.md` only if the dogfood establishes a needed contract clarification

**Interfaces:**
- Consumes: the portable workflow, example site, and dogfood report.
- Produces: a truthful roadmap status and a clean, verified branch; no claim of dynamic catalogue or real agent-host support.

- [x] Run `npm test`, `npm run build`, and `npm run typecheck`; expected: pass.
- [x] Run `git diff --check`; expected: pass.
- [x] Review the working tree and final report; mark only fixture-proven milestones complete.
- [x] Commit any final roadmap/spec correction as `docs: align roadmap with static dogfood evidence`.

## Execution Notes

- Implement this plan inline in the current isolated worktree unless the owner requests a different execution mode.
- The static example is the first vertical slice, not evidence that dynamic catalogues or every framework are supported.
- Real website dogfooding requires a separate, owner-authorized repository. A production deploy is not part of this plan.
