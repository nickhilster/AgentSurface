# Roadmap

AgentSurface's primary milestone is transforming a website repository into a site-native discovery experience that ordinary web-capable agents can use. Earlier catalog-provider and host-handoff work remains useful optional infrastructure; it does not define or block the core repo-to-site outcome.

## Next — Repo-to-site transformation

Goal: a coding agent can use AgentSurface in a website repository to identify its existing source, implement a bounded discovery page, and verify links to exact first-party item pages. The static fixture now demonstrates that workflow; a dynamic catalogue remains unproven.

- [x] Confirm the repo-to-site product direction and detailed acceptance criteria
- [x] Add a portable, agent-neutral coding workflow
- [x] Build a small static catalogue reference site backed by its own source data
- [x] Dogfood the workflow and verify exact item links on the static reference site
- [x] Add a local dynamic-catalogue demonstration fixture (interaction-shape validation only)
- [ ] Prove the workflow on a dynamic catalogue using its existing server-side data path
- [ ] Add reusable automation only where static and dynamic dogfood show the same need
- [ ] Measure discovery calls/pages, response size, exact-link accuracy, and result fidelity against page-by-page browsing

## Existing foundations

The following completed work is supporting infrastructure for the repo-to-site milestone:

- [x] Inspect Next.js App Router and Vite/static repositories
- [x] Build a provenance-backed Canonical Site Model
- [x] Generate Markdown, `llms.txt`, manifests, and safe owned outputs
- [x] Validate route parity, ownership, and generated-output drift
- [x] Model product entities, freshness, and canonical item destinations
- [x] Add optional static JSON-LD and configured OpenAPI catalog providers
- [x] Add optional MCP catalog tools
- [x] Define and test the host-neutral pending handoff contract

## Optional extension — Runtime catalog interfaces

The runtime catalog provider path remains available for sites or agent hosts that want it. It is not required when the website repository contains a usable source and the site can render a normal discovery page.

- [ ] Improve provenance/freshness checks for optional catalog providers
- [ ] Dogfood a real dynamic catalog when an owner-authorized repository/source is available
- [ ] Expand OpenAPI, JSON-LD, or MCP support only when dogfood evidence justifies it

## Optional extension — Host-specific presentation

The website supplies exact canonical item URLs. The user's agentic application controls whether those links open embedded, in a companion surface, or externally.

- [ ] Implement host adapters only for named apps with documented supported extension points
- [ ] Report actual presentation outcomes and fallback behavior
- [ ] Demonstrate supported desktop/mobile hosts before making platform claims

## Explicitly out of scope

- Broad framework support before adapters are reliable
- Autonomous production deployment
- Automatic exposure of authenticated/private routes
- Vendor-specific dependencies in the core
- Inventing catalog data sources, endpoints, ranking logic, or transaction capabilities
- Replacing the website's real item pages with an agent-only storefront
- A single agentification score before repeatable empirical benchmarks
