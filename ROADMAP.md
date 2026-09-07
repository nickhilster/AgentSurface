# Roadmap

## v0.1 — Prove the pattern

- [ ] Select first non-agentified website repo
- [ ] Define minimal `.agentsurface/config.yaml`
- [ ] Define Canonical Site Model schema
- [ ] Implement framework detection
- [ ] Implement one real framework adapter
- [ ] Inspect routes and public content
- [ ] Preserve provenance
- [ ] Generate selected Markdown alternates
- [ ] Generate `llms.txt`
- [ ] Add discovery metadata
- [ ] Validate route parity
- [ ] Validate content fidelity
- [ ] Validate discovery integrity
- [ ] Detect stale generated output
- [ ] Protect human-owned files
- [ ] Publish first dogfood report

## v0.2 — Make it repeatable

- [ ] Add `init`, `inspect`, `generate`, `validate`, `diff` CLI commands
- [ ] Make generation idempotent
- [ ] Add config overrides
- [ ] Add generated-file ownership metadata
- [ ] Add structured validation reports
- [ ] Add second framework adapter
- [ ] Dogfood on a second structurally different site

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
