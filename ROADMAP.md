# Roadmap

This roadmap sequences the product defined in [`docs/SPEC.md`](docs/SPEC.md). AgentSurface is intended to help an agent find a user's relevant item quickly and then hand the exact first-party page to the user's agentic application. The generated selection layer supports that task; the website remains the item experience.

## v0.1 — Prove the pattern

- [x] Select first non-agentified website repo (teambotics-website main site)
- [x] Define minimal `.agentsurface/config.yaml`
- [x] Define Canonical Site Model schema
- [x] Implement framework detection (Next.js App Router, confidence-scored)
- [x] Implement one real framework adapter (Next.js App Router)
- [x] Inspect routes and public content (41 routes, 25 API capabilities)
- [x] Preserve provenance
- [x] Generate selected Markdown alternates
- [x] Generate `llms.txt`
- [x] Validate route parity and content fidelity
- [x] Detect stale generated output
- [x] Protect human-owned files
- [x] Publish first dogfood report

## v0.2 — Make it repeatable

- [x] Add `init`, `inspect`, `generate`, and `validate` CLI commands
- [x] Make generation idempotent
- [x] Add generated-file ownership metadata
- [x] Add validated route classification and content-boundary overrides with owner provenance (catalog source mappings remain in v0.4)
- [x] Add structured validation reports (human-readable and JSON)
- [x] Add second framework adapter
- [x] Dogfood on a second structurally different site

## v0.3 — CI and trustworthy ecosystem surfaces

- [x] Implement `agentsurface diff` for model/output preview before mutation
- [x] Add GitHub Actions validation workflow and PR drift checks
- [ ] Define and document framework, catalog, output, and host adapter contracts
- [ ] Add versioned JSON manifest output for routes, entities, capabilities, and constraints
- [ ] Reuse authoritative Schema.org / JSON-LD data where appropriate
- [ ] Improve content/entity extraction while retaining field-level provenance
- [ ] Test ownership, privacy, route parity, and stale-output checks in CI
- [ ] Dogfood on structurally different content sites and record adapter gaps

## v0.4 — Product discovery

Goal: let an agent search a large site catalogue for the user's stated need without window-shopping through product pages.

- [ ] Extend the Canonical Site Model with product entities, catalogs, typed fields, price semantics, availability, market/location scope, and freshness
- [ ] Define a bounded, typed, read-only catalog search/detail contract
- [ ] Bind catalogs only to verified authoritative read APIs or explicitly scoped static indexes
- [ ] Support declared query text, filters, operators, sorting, pagination, and result limits
- [ ] Generate a lightweight selection manifest with canonical item-page destinations
- [ ] Include data provenance, freshness, unknowns, and price/availability conditions in results
- [ ] Enforce public-field allowlists and optional/location-minimizing search policy
- [ ] Validate field contracts, query bounds, result shape, freshness metadata, and entity-to-route parity
- [ ] Provide an optional protocol projection (including MCP where justified) without making one protocol canonical
- [ ] Dogfood on a real product catalogue with dynamic inventory and compare bounded search with page-by-page browsing

## v0.5 — Agentic experience handoff

Goal: after finding an item, let the user inspect the real first-party page from the agentic application they already use.

- [ ] Specify a host-neutral experience handoff contract for a canonical destination or verified page reference
- [ ] Implement host adapters separately from website/framework adapters
- [ ] Open the real first-party page in the current agentic application's embedded or in-app browser when supported
- [ ] Report the actual presentation outcome; do not claim embedded support from website metadata alone
- [ ] Provide a validated external-browser fallback when the host cannot present the page in-app
- [ ] Preserve item identity and only supported, non-sensitive context through the handoff
- [ ] Validate canonical origin, public-route status, route resolution, and safe URL construction
- [ ] Demonstrate working flows on supported desktop and mobile agentic environments
- [ ] Dogfood handoff from natural-language request through search, shortlist, selection, and in-agent page viewing

## v0.6 — Optional verified operability

- [ ] Model authenticated actions and constraints separately from public read-only discovery
- [ ] Define action-level authorization, confirmation, transmitted-data, side-effect, error, and recovery semantics
- [ ] Generate operable tools only from verified backing implementations and explicit owner policy
- [ ] Explore MCP generation for verified capabilities
- [ ] Keep checkout, lead capture, quote requests, booking, and purchases outside the catalog-search workflow
- [ ] Add safety validation and explicit tests for any state-changing capability before release

## Later — Evidence-based measurement and ecosystem

- [ ] Add richer entity relationships and supported comparison
- [ ] Expand framework/catalog/host adapters based on dogfooding evidence
- [ ] Benchmark discovery time, query count, result size, match fidelity, freshness, and handoff success against page-by-page browsing
- [ ] Consider capability reporting only after empirical benchmarks exist; report readability, discovery, search reliability, and handoff separately

## Explicitly deferred

- Broad framework support before adapters are reliable
- Autonomous deployment
- Automatic exposure of authenticated/private routes
- Vendor-specific core dependencies
- Automatic invention of catalog endpoints, ranking logic, or transaction capabilities
- A full agent-facing replacement UI for the site's product experience
- A single agentification score before repeatable benchmarks
