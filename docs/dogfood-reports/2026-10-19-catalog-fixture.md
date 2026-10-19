# Catalog Discovery Dogfood — 2026-10-19

**Status:** Fixture-based contract shakeout only. This is not the v0.4 real-catalogue exit report because no owner-confirmed live catalog contract was available in the project workspace.

## Scope

Exercised the flow through an in-memory MCP client, the same provider-neutral catalog validator, and the OpenAPI-bound provider. The fixture declared a public HTTPS server, unauthenticated GET search/detail operations, a text query parameter, a typed numeric price field, a result limit, and a canonical item route. Fetch was stubbed; no external catalog endpoint was called.

Example need: “a steel product below 10 in the fixture's price units.” The supported mapping was `query=steel` and `price lte 10`. Three fixture items were available; one matched.

## Measurements

| Flow | Source calls | Source response bytes | Result |
|---|---:|---:|---|
| Bounded search, then retrieve selected item | 2 (1 search + 1 detail) | 110 | One shortlist item; MCP structured shortlist was 323 bytes |
| Synthetic page-by-page baseline: read all three detail pages | 3 detail calls | 124 | Three candidates read |

These measurements count only tiny synthetic JSON bodies. The page-by-page row is a calculated fixture baseline, not an actual browser session. They do not include HTTP, MCP, or model-token overhead and do not establish a useful real-world savings. Time-to-shortlist was not measured.

The fixture flow returned the selected item’s canonical path `/parts/1`, typed price field, and source provenance. Separate provider tests confirm that missing price stays `null` and that JSON-LD availability freshness remains `unknown`. The owner-configured static index reports `static` catalog freshness.

## Gaps and unchecked outcomes

- No live catalog source or owner-confirmed API contract was available. The dynamic provider was tested against a fixture only.
- A public page does not itself establish the site’s owner approval or authoritative API contract. The previously discussed [Nissan Canada CPO inventory page](https://www.nissan.ca/shopping-tools/search-inventory/certified-pre-owned) presents inventory filters and a postal-code/location choice, but this dogfood did not verify a public OpenAPI contract or receive Nissan/dealer authorization to bind one.
- Dynamic sort mapping is intentionally unsupported. The fixture did not test real API pagination, price currency semantics, live availability, response freshness, or source failure behavior.
- No host adapter was used. The canonical path was returned; opening the real site inside a desktop or mobile agentic application remains a v0.5 task.
- No real page-by-page browsing baseline, time comparison, or production response-byte comparison was run.

## Exit decision

Fixture flow: passed. Static-index guardrails: passed. Real dynamic-catalog dogfood: **not evidenced**. Do not mark the v0.4 dogfood milestone complete until a real source owner confirms the public search/detail contract and the listed price, availability, market, freshness, route, and host outcomes are checked against it.

To continue this final dogfood, provide an owner-confirmed catalog source (site and public OpenAPI/contract location) and permission to exercise its read-only operations. Location-dependent tests should use a coarse market value only when the source contract requires it and the user authorizes it.
