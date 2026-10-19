# AgentSurface Specification

This file summarizes AgentSurface's product contract. The detailed repo-to-site design, acceptance criteria, current gaps, and proposed defaults live in [the 2026-10-19 product design](superpowers/specs/2026-10-19-repo-to-agent-surface-design.md).

## Purpose

AgentSurface helps a coding agent use a website's source repository to implement a first-party, agent-friendly discovery experience in that website. The website developer supplies the repository and AgentSurface to their coding agent; the agent inspects the site, finds its existing content or inventory source, adapts the website, and verifies that the deployed surface can return relevant results with exact item-page links.

The primary deliverable is a reviewable change in the target website repository. The CLI, instructions, canonical model, framework adapters, generators, validators, and optional protocol integrations help produce and maintain that change.

## Product outcome

For an agent using ordinary web access, a short route through a large catalogue should be possible:

```text
user need → one site-native discovery surface → bounded relevant candidates
          → exact canonical item URL → real first-party item page
```

The agent should not need to traverse broad categories and unrelated product pages to identify an exact item. The user opens the selected item's normal website page in their agentic application. The host controls whether that page appears embedded or externally.

## Non-negotiable principles

- Website code and data are the implementation context; reuse the site's existing architecture and authoritative source.
- A separate public API/OpenAPI contract is not a prerequisite when the repository contains a usable source.
- The baseline runtime surface is ordinary web content and navigation: accessible HTML, URLs, forms, and exact first-party links.
- Every item result must identify the exact canonical detail page when the source supports one; a category or generic search URL is not equivalent.
- AgentSurface and the coding agent must not invent fields, routes, availability, freshness, permissions, or ranking logic.
- Preserve the site's human experience, security boundaries, and owner-controlled files.
- Discovery is bounded, source-backed, and read-only. Transactions and user-data submission are out of scope.
- Host-specific in-app browsing support is outside the site's control; use a normal canonical link and report host outcomes honestly.
- MCP, OpenAPI adapters, static JSON-LD indexes, manifests, and host adapters are optional integrations, not prerequisites for the core outcome.

## Core workflow

1. Inspect the target repository, its framework, data source, public fields, routes, authentication boundaries, and validation commands.
2. Determine the correct site-native discovery implementation for the catalogue's size and architecture.
3. Implement a bounded discovery page or equivalent ordinary-web surface backed by the existing source.
4. Return a small set of source-backed candidates with stable identities and exact canonical item links.
5. Verify data mapping, freshness claims, URL resolution, privacy boundaries, and site regressions.
6. Report the diff, evidence, limitations, and any owner decisions still needed.

If the repository does not reveal a trustworthy source or exact item route, report the gap instead of fabricating an endpoint or presenting a category link as exact-item resolution.

## Current implementation status

The TypeScript CLI currently inspects Next.js App Router and Vite/static repositories, builds a provenance-backed Canonical Site Model, generates selected discovery outputs, validates generated-file ownership and drift, and supports optional static JSON-LD/OpenAPI catalog providers and MCP tools. It also validates canonical destinations and defines a host-neutral pending handoff contract.

These are useful foundations. They do not yet constitute the complete repo-to-site transformation workflow in the detailed design. Product claims and roadmap status must preserve this distinction.

## Reference documents

- [Detailed product design and acceptance criteria](superpowers/specs/2026-10-19-repo-to-agent-surface-design.md)
- [Architecture](ARCHITECTURE.md)
- [Roadmap](../ROADMAP.md)
- [Dogfooding protocol](DOGFOODING.md)
