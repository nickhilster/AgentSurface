# Local Dynamic Catalogue Demo — 2026-10-20

Status: interaction-shape validation only. This is not the real dynamic-site dogfood milestone.

Target: `examples/dynamic-catalog-site/`, a new local Node.js HTTP demo created for this run.

Data source: `examples/dynamic-catalog-site/data/catalog.json`, a 12-record fictional vehicle snapshot. It is re-read from disk on every HTTP request so edits to the source are visible on the next request. No dealer feed, website repository, external API, or real inventory was used.

## What this run demonstrates

- Query-time filtering over the server's current local JSON source.
- A bounded shortlist of up to five matching records.
- Exact item routes at `/vehicles/{slug}` from each search result.
- Honest disclosure for unsupported filters, advertised-price semantics, fixture timestamp, and fictional data.
- Escaping of query/source text and omission of a private fixture memo from public HTML.
- A normal HTML search page and exact detail page, with no API integration or client-side search dependency.

Example request:

```text
/discover?bodyType=SUV&drivetrain=AWD&maxPrice=38000&minYear=2022
```

## Limits

- The data is invented and static between file edits; per-request reload demonstrates the data path but does not make it live inventory.
- No existing website repository or owner-controlled server-side source was integrated.
- No real-world price, availability, freshness, location, privacy, scale, or ranking claim was validated.
- No mobile or desktop agentic host opened the exact item page. Canonical links are local demo routes only.
- Therefore, the roadmap checkbox “Prove the workflow on a dynamic catalogue using its existing server-side data path” remains open.

## Validation evidence

- `npm test -- examples/dynamic-catalog-site/discovery.test.ts` was attempted as a focused command; the root test script intentionally selects `src examples`, so it ran the full suite: 151 tests passed in 23 files.
- The tests cover per-request source reload, supported filters and exact result links, result-limit clamping, unsupported-filter and private-field handling, exact detail and 404 behavior, HTML escaping, and fictional-snapshot labeling.

## Follow-up for real-site dogfood

Use a site owner-authorized repository with a dynamic catalogue, identify and review its existing server-side source, map only source-supported user criteria, compare bounded discovery with page-by-page browsing, and verify exact item routes in a supported desktop/mobile host. Record source freshness and price/availability meanings before considering that milestone complete.
