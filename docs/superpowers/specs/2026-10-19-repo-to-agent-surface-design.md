# AgentSurface: Repo-to-Agent-Friendly Website Specification

**Date:** 2026-10-19  
**Status:** Product direction confirmed; implementation details below are proposed defaults for owner review.  
**Audience:** AgentSurface contributors and coding agents working in a target website repository.

## 1. Product definition

AgentSurface is a repo-aware toolchain that helps a coding agent modify an existing website repository so the deployed website is easier for agents to use.

A website owner gives their coding agent access to the website repository and points it to AgentSurface. The coding agent inspects the site, locates how its content or inventory is represented, and implements a first-party discovery surface suited to that codebase. The deployed surface uses ordinary web navigation and returns exact links to the selected content or product page.

The core product is the website change made in the target repository. AgentSurface's CLI, instructions, models, framework adapters, generators, validators, and optional protocol integrations support that work. AgentSurface does not require a retailer or publisher to build a separate vendor API before its site can become agent-friendly.

## 2. Problem and user

### Primary user

A website developer, maintainer, or owner with access to the complete website repository and permission to change it. They use a coding agent that can inspect and edit the repository.

### Job to be done

> When I give my coding agent the website repository and AgentSurface, help it understand the site's existing architecture and implement a maintainable way for ordinary web-capable agents to find the right public item quickly and open its exact first-party page.

### Problem

Agents often reach a broad category or search page when the user asked for one particular item. They may have to browse many pages, reconstruct product facts from presentation markup, and still return a link that does not identify the selected item. This wastes time and context and can leave the user at the wrong point in the site.

### Desired outcome

The website developer adds one site-native discovery experience backed by the site's own data. An agent can use normal web access to search a bounded set of relevant candidates, explain the match from source-backed fields, and provide a canonical URL for the exact selected item. The user opens that URL in their existing agentic application and sees the website's real item page.

## 3. Product principles

1. **The website developer's repository is the implementation context.** Find and reuse the site's existing product/content models, data access, routing, rendering, and validation conventions.
2. **The website owns the adaptation.** AgentSurface helps implement the site-side surface. Agent-specific vendor integrations are optional.
3. **Ordinary web access is the baseline.** The deployed discovery experience must be usable as a web page with standard URLs, links, forms, and readable HTML. Structured metadata can improve extraction but does not replace usable page content.
4. **Exact destinations are part of correctness.** A selected result must resolve to its own canonical detail page, not a category, generic search page, or model-family page when the source identifies an individual listing.
5. **Use the smallest effective surface.** Return the fields needed to find and assess candidates. Leave the full explanation, images, configuration, account flows, and transactions to the site's actual experience.
6. **Reuse authoritative site data.** Do not require a separate public API or OpenAPI contract when the repository has a usable source. Do not invent a data source when it does not.
7. **Fit the site's scale and architecture.** A small static catalogue and a high-volume dynamic inventory need different implementations behind the same user-facing goals.
8. **Preserve the human experience.** Add the discovery surface without replacing or degrading existing site journeys.
9. **Make claims traceable.** Preserve where product fields, freshness, routes, and capabilities came from. Represent missing or unclear facts as unknown.
10. **Keep the user's agent host in control.** AgentSurface supplies ordinary canonical links. The host chooses how to open them; the website cannot promise embedded browsing support.

## 4. Scope

### In scope

- Inspect a target website repository and summarize its framework, public routes, product/content sources, canonical route patterns, auth boundaries, and relevant validation/build commands.
- Determine whether the existing source can support public discovery and exact item resolution.
- Implement or guide implementation of a first-party, agent-usable discovery page or equivalent ordinary-web surface in the target website.
- Use the existing product/content source or a site-native index built from repository data.
- Return a concise, bounded result set with stable identity and exact canonical page links.
- Include source-backed fields and meaningful freshness/availability semantics where the site has that data.
- Validate route resolution, links, field fidelity, privacy boundaries, builds, and regressions using the target repository's conventions.
- Provide a human-readable implementation summary, changed-file list, verification evidence, and unresolved gaps.
- Maintain AgentSurface's existing repo inspection, canonical model, output ownership, drift detection, and reporting capabilities as useful parts of the toolchain.
- Offer optional projections such as Schema.org JSON-LD, a static manifest, OpenAPI adapters, or MCP tools when they provide additional value.

### Out of scope for the core product

- Replacing the target site's full human-facing interface with an agent-only storefront.
- Requiring every site to publish a bespoke external API, OpenAPI document, MCP server, or vendor-specific integration.
- Requiring a special shopping tool for every retailer at runtime.
- Building or controlling the user's agentic application, browser, desktop, or mobile host.
- Claiming that all agent hosts have the same browser capability or will present links in-app.
- Exposing private/authenticated data or bypassing the site's access controls.
- Contacting sellers, submitting leads, requesting quotes, booking, purchasing, or otherwise mutating user/site state as part of discovery.
- Deploying changes automatically as a default behavior.
- Guessing a product source, route, field meaning, freshness guarantee, inventory status, or ranking rule when repository evidence is insufficient.

## 5. Core workflow

```text
Website developer provides repository + AgentSurface to coding agent
        ↓
Inspect architecture, routes, data models, public fields, and verification tools
        ↓
Identify the authoritative in-repository source and exact item route pattern
        ↓
Choose a site-native discovery implementation that fits scale and framework
        ↓
Implement the discovery surface and item links in the website repository
        ↓
Run build, tests, route checks, and AgentSurface validation
        ↓
Review a concise diff and evidence; owner chooses whether to merge/deploy

At runtime:
User need → ordinary web access to the site's discovery page → shortlist
           → exact canonical item URL → real first-party item page in host
```

### Phase A: inspect the repository

The coding agent should inspect enough of the repository to answer:

- Which framework, router, rendering mode, and deployment target does the site use?
- Where do products, inventory units, services, or content entities originate?
- Is the source a static file, content collection, CMS SDK, database model, server-side service, or existing public endpoint?
- Which fields are public, searchable, filterable, and accurate enough to show?
- How does an entity map to its canonical detail route? Is the route unique for a variant or individual inventory unit?
- Which authentication, tenant, market, or location boundaries apply?
- What tests, linting, builds, and local preview commands verify a change?
- Are there existing agent instructions or generated files that must be preserved?

Prefer deterministic source inspection and repository-native tools. Generated summaries are hypotheses until checked against code, schema, tests, or a local running site.

### Phase B: choose the implementation

Use the site's existing data access and routing. Do not add a duplicate catalogue store when the current source can serve the page. Do not introduce a new service or dependency unless it is needed and justified by the repository.

The default is a human-readable HTML discovery page backed by the same source as the site's catalogue. It may be a dedicated route or an existing search route with a small, stable agent-friendly mode. It should use ordinary links and, where practical, GET-based search/filter state so URLs are reproducible and the page works with common browser interaction.

The design may expose structured data such as Schema.org `Product` and `ItemList` on the discovery and item pages. Structured metadata is supplementary: the discovery page must still expose useful names, facts, and exact links as readable HTML. A JSON feed, manifest, OpenAPI description, or MCP projection is optional and should be generated from the same source and kept consistent with the web page.

If the source is missing, ambiguous, or inaccessible, the agent reports the specific gap and proposes the smallest owner decision required. It must not quietly scrape the public site as a substitute for the repository's authoritative data or fabricate a new catalog.

### Phase C: implement and verify

The coding agent works within the target repository's architecture and conventions. It should minimize changes, preserve existing behavior, avoid touching unrelated components, and use the site's standard test/build commands. It should verify the discovery route and representative item links in a local preview when feasible.

The default deliverable is a reviewable working-tree diff. Production deployment, publishing, or external service setup is not implied.

## 6. Site-side discovery surface requirements

### 6.1 Entry and query behavior

- There is a stable, public URL that an agent can visit to discover the catalogue or relevant public content.
- A user/agent can narrow results using supported query terms or filters without opening every detail page.
- Search/filter behavior is bounded: constrain result count, response size, pagination, expensive fields, and query complexity according to the site's architecture.
- Query state should use ordinary URLs or visible web controls where practical. Do not require an undocumented agent-only browser extension.
- Unsupported criteria must not silently become filters. The page or its results should make unsupported/unknown criteria apparent.
- The page should present a useful small shortlist; it should not dump the entire catalogue by default.

### 6.2 Result identity and exact route

Each result should provide, when the source has the data:

- stable entity identifier;
- precise item name/title and type;
- concise summary and relevant public attributes with units;
- exact canonical URL to the item's real first-party detail page;
- price with currency, kind, and material conditions, when present;
- availability/status and its freshness or observation time, when present;
- market/locale/location scope when material;
- enough provenance to distinguish source-backed facts from missing data.

For inventory such as cars, a single vehicle listing is the entity when the site tracks it independently. Make/model category pages and model-year landing pages do not satisfy exact item resolution when an individual stock unit/VIN listing is available.

The canonical destination must be derived from the site's router or source record and tested to resolve to the intended entity. Do not build URLs by concatenating untrusted labels. Do not treat Markdown alternates, category pages, or generic search URLs as item detail destinations.

### 6.3 Freshness and truth

- Static data is labeled static or snapshot; do not imply current inventory.
- Dynamic values carry source-provided update time or a documented cache/freshness policy when available.
- When freshness is unknown, report it as unknown.
- Price kind and conditions must be retained; advertised price is not represented as a total purchase price unless the source says it is.
- Missing values remain missing/unknown and do not become false claims.
- Ranking must be traceable to user criteria or site behavior; do not invent “best” claims.

### 6.4 Security and privacy

- Only public fields and public destinations are exposed by default.
- Existing auth, tenant, seller, and market boundaries remain in effect.
- Search is read-only and does not submit personal data or trigger business actions.
- Search terms and item identity should not leak into third-party systems or persistent URLs beyond what the user expects.
- Never expose secrets, session state, private records, or internal-only routes.
- Generated changes do not weaken CSP, authentication, authorization, or permission checks to make agent access easier.

### 6.5 Human experience and accessibility

- Existing human journeys remain intact.
- The discovery page uses semantic HTML, visible labels, keyboard-operable controls, meaningful headings, and accessible result links.
- A lightweight style may visually align with the site; no full redesign is required.
- Results link to the existing first-party item experience, which remains authoritative for images, configuration, account state, checkout, and transactions.

## 7. Scale and implementation modes

The same behavioral contract applies at different scales; implementation details differ.

| Site shape | Expected site-side implementation | Validation focus |
|---|---|---|
| Small static site or curated catalogue | Build-time index from existing structured content/files and a static or server-rendered discovery page | Index parity, update behavior, correct canonical routes, bounded output |
| Medium content/CMS site | Query the site's current CMS/content API or server-side repository layer and render bounded results | Field mapping, published/public status, pagination, cache freshness |
| Large dynamic inventory/store | Use the existing database/service/search index through current server-side access; render a bounded shortlist and individual listing links | Query plans/bounds, authorization, live freshness, variant/stock-unit identity |
| No clear source or route mapping | Report findings and propose a minimal source/owner decision | No speculative endpoint, data model, or public exposure |

AgentSurface should help choose and implement the smallest sound mode. It should not force one storage system or ask every site owner for a public OpenAPI contract.

## 8. AgentSurface developer workflow and outputs

AgentSurface consists of deterministic tooling plus instructions/workflows for coding agents. Exact packaging is an implementation decision; the current CLI is a starting point, not proof that all repo-editing behavior already exists.

### Existing repository capabilities to retain

- `init`, `inspect`, `generate`, `validate`, and `diff` commands;
- framework inspection for Next.js App Router and Vite/static sites;
- a versioned canonical model with source provenance;
- safe owned-file generation and conflict reporting;
- route and generated-output drift checks;
- product/catalog entity types, static JSON-LD and optional OpenAPI catalog providers;
- canonical destination validation and pending handoff request contracts;
- optional MCP projection for environments that choose it.

### Product capabilities to add or strengthen

- A coding-agent workflow that can inspect a target repository and make a tailored site change, rather than stopping after describing or exporting discovered metadata.
- Repository data-source and item-route mapping sufficient to implement a site-native search/discovery page without a public API contract.
- Safe implementation planning, diff review, and progress summaries for changes in an arbitrary target repository.
- Site-level verification of discovery query behavior and exact item links, preferably through the target repo's local server/test conventions.
- A reusable reference implementation and dogfood cases that cover both small static and larger dynamic catalogues.
- A crisp boundary between AgentSurface-generated code/artifacts and human-owned site code, including update and conflict handling.

### AgentSurface output

For one target repository run, the useful output is:

1. concise findings about source, route, fields, boundaries, and scale;
2. a proposed implementation choice with assumptions stated;
3. a working-tree diff that adds or updates the site-native discovery surface;
4. verification results tied to the target repo;
5. unresolved unknowns, caveats, and any owner decisions still needed.

A canonical model/manifest is valuable when it supports this workflow, but it is not the end-user success criterion by itself.

## 9. Handoff boundary

The site must provide the correct canonical URL. AgentSurface may validate that URL against the site source and route model. The user's agent host decides whether to render it in an embedded panel, companion app, or external browser and reports what actually happened.

The baseline integration is a normal first-party URL rendered as a link. AgentSurface does not need a host-specific adapter for a site to satisfy the primary discovery goal. Host adapters and pending handoff requests are optional improvements for applications with documented integration APIs.

## 10. Non-functional requirements

- **Framework fit:** site changes follow existing framework and code patterns; core AgentSurface logic remains framework-neutral where possible.
- **Maintainability:** use the source of truth and site-owned query paths; no unmanaged duplicate catalog.
- **Performance:** bounded reads and concise results; no full-catalog transfer to answer a narrow query unless the catalog is deliberately small.
- **Reliability:** deterministic generated pieces; explicit fallback/error states; no malformed or stale canonical links.
- **Auditability:** source-to-field and entity-to-route mapping can be reviewed.
- **Reversibility:** changes are a normal diff, avoid destructive migrations, and can be reverted without AgentSurface services.
- **Compatibility:** core discovery works through ordinary browser navigation; optional formats do not become mandatory dependencies.
- **Accessibility:** the site page works for keyboard and assistive technology users.

## 11. Success measures and acceptance criteria

### Repository transformation acceptance

A representative supported website repository passes when:

1. The coding agent identifies the actual product/content source and the exact item route from repository evidence.
2. It implements a first-party discovery page using that source without requiring an independently published OpenAPI/API contract when repository data access is available.
3. The page returns a small bounded result set for supported criteria and exposes the source-backed fields needed to assess each candidate.
4. Every result links to the exact canonical item page, and a local route check or browser check confirms that page belongs to that result.
5. The existing human site builds and its relevant tests still pass; existing routes and owner-controlled files are preserved.
6. Public/private boundaries, freshness, and unknown fields are represented accurately.
7. A reviewer can understand the changed files, assumptions, verification, and known gaps from the agent's summary.

### Runtime discovery evaluation

Compare the implemented surface with page-by-page browsing on representative requests. Record:

- page navigations and data requests needed to produce a shortlist;
- response bytes and agent-visible content/tokens where measurable;
- time to a useful shortlist;
- result recall/precision against explicit user criteria;
- exact-item link accuracy and broken-link rate;
- freshness/price/availability correctness;
- unsupported-criteria and missing-data behavior;
- changes required to adopt and maintain the surface.

The primary quality signal is useful exact candidates with less broad browsing, while preserving truthfulness and the site's real experience. Do not collapse these dimensions into a single agent-friendliness score before repeatable evidence exists.

### Initial dogfood coverage

At minimum, demonstrate:

- one small/static or content-backed site where the source lives in the repo;
- one dynamic catalogue where the repo contains or exposes the site's current internal data access;
- one case where the product source or exact route is unclear and the agent reports the gap rather than inventing a solution.

## 12. Current state and gap from this spec

As of 2026-10-19, AgentSurface is an early TypeScript CLI and optional MCP server. It inspects Next.js App Router and Vite/static sites, stores a canonical model, generates Markdown and discovery outputs, validates ownership/drift, supports static JSON-LD and configured OpenAPI catalog providers, validates canonical product destinations, and exposes optional catalog and pending handoff tools.

The current implementation is useful infrastructure for this specification, but it does not yet deliver the complete repo-to-site transformation workflow. In particular:

- catalog discovery currently centers on configured catalog providers/static indexes rather than coding-agent implementation against the target repo's own data access;
- the CLI does not yet implement the website-side discovery page into arbitrary target repos as a complete guided workflow;
- current fixture dogfood does not establish live dynamic inventory behavior;
- the handoff contract does not implement a real host adapter or prove embedded browsing on any agentic app;
- framework coverage is limited and should be expanded from dogfood evidence rather than advertised universally.

These limits must be reflected in product claims and release notes. Preserve the working model, validation, safe generation, provider adapters, and handoff boundary where they serve the repo-to-site workflow. Reposition optional runtime integrations as optional.

## 13. Release and migration guidance

The next product phase should align the docs and roadmap with this specification, then prove a full repo transformation on a target website before broadening runtime integrations. Prefer one end-to-end reference case over additional protocol breadth.

A safe progression is:

1. Revise AgentSurface's own operating instructions, README, spec, and roadmap so coding agents understand the intended repo-to-site mission.
2. Define the coding-agent workflow contract: inspect, map, plan, implement, verify, and summarize.
3. Build a fixture website repository with a simple source-backed catalogue and exact item routes; have an agent implement the discovery page using ordinary web primitives.
4. Dogfood against one real, owner-authorized repository whose code contains a relevant data source; record where the generic workflow fails.
5. Generalize only abstractions supported by both the fixture and real dogfood; add another data shape or framework when evidence requires it.
6. Keep MCP, OpenAPI and host-specific adapters as optional outputs/integrations and measure whether they improve adoption.

No production deployment, external account access, or site-owner communication is implied by this specification.

## 14. Proposed defaults and open decisions

These are recommendations to make the first implementation plan concrete, not claims the owner has selected them:

- **AgentSurface delivery:** start with agent-neutral instructions plus the existing CLI. The CLI should inspect and verify; the coding agent should handle repo-specific edits that cannot safely be generated generically. Add thin agent-specific entry points only when dogfooding shows a real need.
- **Discovery interface:** start with a normal, accessible HTML page or route with bounded search/filter behavior and exact item links. Add a machine-readable projection from the same data when it is useful.
- **Initial reference sequence:** first prove the end-to-end flow on a small static, source-backed catalogue using an already-supported framework; then prove a dynamic catalogue using its existing server-side data path. This is a sequencing choice, not a limit on the product scope.
- **Mutation boundary:** make site changes as reviewable working-tree edits; do not deploy or silently overwrite owner files. Site implementation code is ordinary site code owned by the website team. AgentSurface should track ownership only for its own generated model/output files and should surface conflicts before regeneration.
- **Dogfood target:** use a fixture repository until a real website repository is explicitly available and authorized for changes.
- **Unsupported repositories:** report what is missing and ask for the smallest meaningful owner decision; do not generate a fake catalog or generic category-only fallback as if exact search were solved.

The implementation plan should settle the exact instruction file format, fixture repository layout, and CLI-to-agent workflow. Revisit the proposed defaults only if target-repository evidence shows they do not fit.
