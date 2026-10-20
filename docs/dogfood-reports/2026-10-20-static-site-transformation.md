# Static Site Transformation Dogfood

**Date:** 2026-10-20  
**Target:** `examples/static-catalog-site/` in this AgentSurface repository  
**Scope:** Static fixture only; no production site or live inventory was available.

## Repository inspection

I followed [`AGENT_SURFACE.md`](../../AGENT_SURFACE.md) against the static example. The target is plain HTML, CSS, JavaScript, and JSON; it has no framework manifest, backend, or separate repository instructions. The authoritative public fixture source is [`catalog.json`](../../examples/static-catalog-site/catalog.json). It contains five explicitly public sample vehicle records, stable stock IDs, matching display fields, CAD sample prices, and canonical paths. No private record is published in this file.

The website's exact item routes are represented by the `canonicalPath` values and the matching `products/<slug>/index.html` pages. Each detail page carries the same `data-product-id`, listing ID, vehicle fields, and canonical metadata as its catalogue entry. The static source is deliberately small and does not establish dynamic inventory behavior.

## Changes and browser flow

The example now has a normal home page, a labeled GET search form at `discover.html`, and five first-party detail pages. The form supports keyword, make, and maximum CAD price. The client also supports an optional model filter and bounded result limit for direct query URLs. Results default to three, cap at five, exclude non-public or invalid-route records, and link directly to the matching detail page. Unsupported query keys are reported while supported filters still apply. A blank budget is treated as no price filter; malformed non-empty budgets return no results with a validation notice. Text and attribute values are escaped before result markup is inserted.

Representative exact routes:

- `/products/stock-104-rav4-xle/` → `stock-104`, 2021 Toyota RAV4 XLE, sample price $32,900 CAD
- `/products/stock-205-crv-exl/` → `stock-205`, 2022 Honda CR-V EX-L, sample price $35,400 CAD

All five result routes are recorded in [`discovery.test.ts`](../../examples/static-catalog-site/discovery.test.ts), which verifies that every catalogue record maps to an existing detail page carrying the same identity and canonical path. The page visibly labels the inventory and prices as illustrative, not live.

## AgentSurface CLI dogfood

The documented workflow was attempted with the local built CLI:

1. `inspect` first reported that the target had no AgentSurface config. Following the guide, `init --name "Northstar Motors"` created a config using the verified sample name; no hostname was invented.
2. `inspect` completed but reported framework `unknown`, zero routes, zero capabilities, and one adapter unknown. This is consistent with a plain static fixture that has no matching adapter. The guide correctly directs the agent to verify the model against source rather than treat the empty model as product data.
3. `generate` required a running `--server`; with the local static server it completed and generated zero pages plus `public/llms.txt`. It did not generate the vehicle discovery page. That page was implemented from the source catalogue and ordinary browser conventions as the guide specifies.
4. `validate --server http://127.0.0.1:8765` reported six passes, zero failures, and one unchecked capability-truthfulness record. It checked AgentSurface's generated artifact and model contracts, not the example's item search results or route-to-ID correspondence; the fixture test and direct HTTP checks cover those separately.

These results match the guide's stated CLI limits: AgentSurface helps inspect and validate, but does not yet create a tailored site-native catalogue search experience. No guide change was needed because the instructions to verify the source manually and report exact item routes were followable.

## Verification and limits

- `npm test -- examples/static-catalog-site/discovery.test.ts` — 11 tests passed.
- `npm test` — 144 tests passed across 22 files.
- `npm run build` — passed.
- `npm run typecheck` — passed.
- `git diff --check` — passed.
- Served the example with Python's standard static HTTP server; home, discovery, catalogue JSON, and all five product routes returned HTTP 200. Each product response exposed the expected product ID.
- Opened the GET discovery page in the in-app browser with `?q=rav4&make=&maxPrice=` and confirmed one RAV4 result; opened it with `?q=&make=&maxPrice=` and confirmed the bounded three-result default.
- Route-to-record identity and canonical metadata were checked by the fixture tests.

The records are static examples, not current vehicles for sale. There is no feed synchronization, freshness guarantee, seller contact, booking, checkout, or real inventory privacy policy to validate. A dynamic website would need to reuse and verify its own authoritative server-side source, permissions, freshness, and canonical route mapping. This dogfood does not demonstrate framework coverage or any agent host's embedded-browser behavior.
