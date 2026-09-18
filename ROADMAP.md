# Roadmap

## v0.1 — Prove the pattern

- [x] Select first non-agentified website repo (teambotics-website main site)
- [x] Define minimal `.agentsurface/config.yaml`
- [x] Define Canonical Site Model schema
- [x] Implement framework detection (Next.js App Router, confidence-scored)
- [x] Implement one real framework adapter (Next.js App Router)
- [x] Inspect routes and public content (41 routes, 25 API capabilities)
- [x] Preserve provenance (every classification carries a provenance record with
      source file, method, and confidence)
- [x] Generate selected Markdown alternates (18 public-static routes with a confirmed
      content boundary; dynamic routes and boundary-less routes explicitly deferred,
      not faked)
- [x] Generate `llms.txt`
- [x] Add discovery metadata (`llms.txt` only — per-page `rel="alternate"` link
      injection is explicitly deferred, see dogfood report)
- [x] Validate route parity
- [x] Validate content fidelity (drift check against live rendered content)
- [x] Validate discovery integrity
- [x] Detect stale generated output (proven with a real, deliberate source change —
      see dogfood report)
- [x] Protect human-owned files (ownership header + refuse-to-overwrite check)
- [x] Publish first dogfood report (`docs/dogfood-reports/2026-09-18-teambotics-website.md`)

## v0.2 — Make it repeatable

- [x] Add `init`, `inspect`, `generate`, `validate` CLI commands (`diff` not yet
      implemented — not needed to complete this dogfood run; still open below)
- [x] Make generation idempotent (verified: two runs, byte-identical output)
- [ ] Add config overrides (basic config exists; per-route overrides like a
      content-boundary selector are proposed but not implemented — see dogfood report)
- [x] Add generated-file ownership metadata
- [ ] Add structured validation reports (current output is human-readable console
      text, not a structured JSON/machine-readable report)
- [ ] Add second framework adapter
- [ ] Dogfood on a second structurally different site (portfolio-website — planned as
      a separate follow-up pass, not started)

## v0.3 — CI and ecosystem

- [ ] GitHub Actions validation workflow
- [ ] PR drift checks
- [ ] Adapter/plugin contract
- [ ] JSON manifest output
- [ ] Schema.org / JSON-LD reuse
- [ ] Better content/entity extraction

## Later — Operability where justified

Only after readable/discovery surfaces are stable:

- [ ] Detect explicit OpenAPI contracts
- [ ] Model authenticated actions and constraints
- [ ] Generate agent-operable manifests/tools only from verified backing implementations
- [ ] Explore MCP generation
- [ ] Add action-level safety and side-effect semantics

## Explicitly deferred

- Agentification scores before we have empirical benchmarks
- Broad framework support before the first adapter is reliable
- Autonomous deployment
- Automatic exposure of authenticated/private routes
- Vendor-specific core dependencies
