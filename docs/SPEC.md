# AgentSurface Specification

## Purpose

AgentSurface adds a trustworthy agent-facing interface layer to an existing website repository without replacing or rebuilding the human-facing website. It helps agents understand what the site offers, find the specific public product or content that fits a user's request, and hand that exact destination to the user's agentic application so the user can continue in the real website experience.

The website remains authoritative for its content, product data, routes, availability, pricing, and actions. AgentSurface inspects what the website actually implements, models verified facts and capabilities, generates machine-readable discovery and selection surfaces, and validates those surfaces against their sources. It must report unknowns rather than fabricate data or functionality.

## Problem statement

Large websites make users and agents browse, filter, open, and compare many pages to find one relevant item. A text mirror alone may make pages easier to read, but it still leaves an agent window-shopping through the whole catalogue and may return a summary instead of bringing the user to the item itself.

AgentSurface must support a shorter path:

```text
user need → targeted search over verified site data → relevant item(s)
          → open the selected first-party page in the user's agentic application
```

The agent should do the repetitive discovery and explain its match. The user should be able to inspect and use the actual website page in the agentic environment they are already using, including an embedded or companion browser where that host supports one. A plain external link is a fallback when the host cannot provide that experience.

## Product outcomes

1. An agent can discover what a site offers and how to search it without traversing every product page.
2. An agent can turn a user's natural-language need into bounded, structured filters over source-backed catalog data.
3. Results contain enough verified facts and provenance to explain why they match and identify uncertainty or stale data.
4. The user can open a selected canonical item page inside the agentic application they are using and receive the real first-party website experience.
5. Site owners can adopt these surfaces incrementally without replacing the website or silently exposing private data or unsafe actions.

## Design goals

- Framework- and model-provider-agnostic core.
- Source-derived over inferred; uncertainty remains explicit.
- Fast, bounded product/content discovery instead of exhaustive browsing.
- Provenance and freshness for generated claims and dynamic data.
- A direct, verifiable path from result to canonical first-party experience.
- Host-mediated presentation: the site declares destinations; the agent host controls where they open.
- Reproducible generation, drift detection, and safe incremental adoption.
- Read-only discovery separated from state-changing transactions.
- No false claims about capabilities, privacy, availability, or host support.

## Non-goals

AgentSurface is not:

- a CMS or website builder;
- a crawler-first search engine for the public internet;
- an autonomous browser agent or a replacement for the user's agent host;
- a substitute for an authoritative inventory, product, or content API;
- a product recommender that invents user preferences or undocumented ranking rules;
- a system that mirrors the complete interactive site into a stripped-down agent UI;
- a mechanism to expose authenticated, private, or otherwise unsafe content;
- a checkout, booking, lead-capture, or other transactional system;
- a mechanism for a website to force navigation, open a window, or choose a host surface without the user's agentic application mediating the handoff.

## Terminology

### Human surface
The existing website experience intended for people.

### Repo operating surface
Instructions that help coding agents safely understand and modify the website repository.

### Agent-readable surface
Machine-readable representations of public website content, such as Markdown mirrors, manifests, and catalog records.

### Discovery surface
Metadata or endpoints that tell agents what agent-readable surfaces and supported capabilities exist.

### Agent-operable capability
A verified interface an agent can invoke. Read-only search and item retrieval are operable in the sense that an agent invokes them, but they do not mutate state. Transactional actions are a separate, higher-risk class and are out of scope for product discovery.

### Agentic application / host
The application in which the user is interacting with an agent. It may provide an embedded browser, web view, desktop panel, mobile surface, or only the ability to open a link externally.

### Experience handoff
A request for the user's agentic application to open a canonical first-party website destination in a host-supported browsing surface. The host, not the website, decides how to present it and retains user control.

### Canonical Site Model (CSM)
The typed machine-readable source of truth AgentSurface produces from repository inspection. All generated outputs derive from this model or explicitly configured authoritative sources.

### Product/catalog entity
A source-backed public item that a user may seek, compare, or open. This includes physical products, vehicles, services, offers, inventory units, and other catalog items when the source website identifies them as such.

## Experience principles

### Find first, browse less

The agent-facing selection layer exists to find a small, relevant set of items quickly. It should support search, filters, sorting, and bounded pagination using site-supported fields and operations. It should not require enumerating the whole catalogue or fetching every detail page.

### Keep the selection layer lightweight

The public agent-readable representation should include only the fields needed to discover and assess a candidate, explain the match, and route to the canonical page. It may be a stripped-down data interface, but it is not intended to reproduce the website's full user interface. The website remains the rich product experience.

### Open the real page in the user's environment

After the agent identifies an item, it should be able to ask the host to display the item's canonical first-party page inside the current agentic application when that host offers such a surface. The page opened must be the website's real experience, not merely an agent-generated text summary or a copied card. The handoff should target the exact item page, preserve useful context when the site supports it, and keep the user in the agentic environment.

The website cannot guarantee a particular host UI. Host adapters implement the handoff. If an embedded or in-app surface is unavailable, the host may offer an ordinary browser fallback and must identify that fallback honestly.

### Explain match and limits

The agent should present a concise reason for each result, using verified fields and the user's stated criteria. It must distinguish exact matches from partial matches, omit unsupported inferences, and make missing, stale, location-dependent, or seller-supplied values visible.

## Canonical Site Model

The CSM is typed JSON or YAML. Markdown must not be the sole internal source of truth. The model includes site metadata, routes, content and product entities, discovery surfaces, capabilities, constraints, provenance, and freshness semantics.

Illustrative shape:

```json
{
  "version": "0.2",
  "site": { "name": "Example", "framework": "astro", "canonicalOrigin": "https://example.com" },
  "routes": [],
  "entities": [],
  "catalogs": [],
  "capabilities": [],
  "handoff": {},
  "constraints": [],
  "provenance": []
}
```

### Route record

Each route should be able to carry:

- path and canonical URL, if known;
- public/private classification and content type;
- source file(s) or authoritative source mapping;
- agent-readable alternate, if generated;
- whether the route is a canonical experience destination for an entity;
- provenance, confidence, and validation status.

### Product/catalog entity record

Each record should be able to carry:

- stable source identifier and entity type;
- display name and concise public description;
- source-backed attributes and their units/types;
- source-backed searchable/filterable/sortable fields;
- canonical item-page URL or a verified route template plus identifier;
- public availability/status when the source provides it;
- price and currency when provided, including the price kind (for example, MSRP, advertised price, starting price) and material conditions when known;
- applicable market, location, or locale constraints;
- observed/updated time or a documented freshness policy for dynamic fields;
- provenance per field or field group, confidence, and unknowns.

The model must not present a teaser, starting, financing, or location-specific price as a complete out-the-door price. It must not convert missing data into a negative claim (for example, missing safety-history data does not mean accident-free).

### Catalog record

A catalog record describes a coherent set of entities and the authoritative read interface for discovering them. It should identify:

- entity type and public scope;
- the backing source implementation or API contract;
- supported query text, filters, sorting, pagination, and detail retrieval;
- supported fields and operators with units and enumerations;
- defaults and limits, including maximum result count;
- required locale or market context and whether location is optional, coarse, or required;
- availability and freshness semantics;
- canonical page resolution rules;
- authentication requirements and side effects;
- provenance and confidence for every declared operation and field.

AgentSurface may describe or adapt an existing verified read interface. It must not invent a search endpoint or scrape hidden/private data and claim it is an authoritative catalog API. Where only static content exists, it may generate a bounded static index and label its scope and update time.

### Capability record

Every capability must include:

- name and user-facing purpose;
- readable, read-only-operable, or state-changing classification;
- backing implementation or contract;
- authentication requirements;
- side effects and data transmitted;
- input/output schema and constraints;
- provenance, confidence, and validation status.

No capability may be generated from copy alone. Discovery, search, and item retrieval are read-only operations. Checkout, quote requests, lead forms, account changes, reservations, purchases, and similar actions are state-changing and are not enabled by the catalog-search surface.

### Handoff record

A handoff record describes destinations and how the host can resolve them, including:

- canonical origin and allowed destination routes;
- entity-to-page URL resolution, when verified;
- optional opaque page reference when direct URLs cannot be safely derived;
- whether the destination is public, login-gated, or unknown;
- optional context that may be attached (selected item ID, locale, or search criteria), with clear privacy rules;
- provenance and validation for the destination mapping.

Only same-site canonical public destinations may be generated by default. External destinations require explicit source-backed configuration and must be identified as external.

## Inspection hierarchy

Prefer authoritative structured sources before heuristic inference:

1. Existing AgentSurface config/model.
2. Framework route definitions and content collections.
3. OpenAPI or typed API contracts.
4. Product/catalog APIs or CMS schemas with explicit public/read scopes.
5. JSON-LD / schema.org.
6. Sitemaps and robots.txt.
7. Source files and rendered/static HTML.
8. Heuristic inference.

If information comes from heuristic inference, mark it as such. Heuristics may suggest fields or routes for owner review but cannot establish live availability, permissions, transactional behavior, or an agent-operable capability.

## Public agent-readable outputs

Depending on framework and content type, AgentSurface may generate:

- `/page.md` or equivalent content alternates;
- machine-readable route indexes;
- product/entity manifests;
- a lightweight catalog manifest and search contract;
- structured detail representations for specific items;
- freshness and provenance metadata.

Outputs preserve useful semantic structure while omitting presentation-only noise. They should support targeted selection without forcing agents to traverse every page. They should avoid duplicating large or rapidly changing datasets when a verified live read interface already exists.

Generated data must include canonical links back to the corresponding first-party item experience. A machine-readable result without a valid destination is incomplete for a public catalog entity.

## Discovery outputs

AgentSurface may generate or configure:

- `/llms.txt` as a discovery index for readable content;
- a site-level structured manifest for routes, catalogs, and supported read operations;
- `<link rel="alternate">` metadata or equivalent HTTP discovery;
- optional read-only tool descriptors, including an MCP projection where justified;
- clear host handoff metadata that identifies canonical first-party destinations.

Discovery must point only to existing, validated outputs. Readable content and callable read-only query operations must be distinguishable from state-changing actions. A discovery index must not look like an invitation to invoke transactional actions.

### Projection into `llms.txt`

`llms.txt` is a discovery index for agent-readable content. It must not be treated as an action menu. A capability may appear there only when it has source-derived backing, is public and unauthenticated, has no side effects, and has a real validated representation. Use headings that distinguish structured data from actions.

## Product discovery and matching

### Search behavior

The catalog interface should accept a bounded, typed query and return a bounded result set. It may include:

- user query text when supported by the source;
- exact typed filters and value ranges;
- sorting using declared fields;
- pagination or continuation tokens;
- optional locale/market context;
- optional location only when the user supplied it or the host has explicitly authorized its use and transmission.

The interface must expose supported fields/operators instead of requiring agents to guess. It must not require location or other personal data when the source can search without it. It must not silently infer precise location from unrelated context.

### Matching behavior

The site owns the authoritative data and any server-side ranking it exposes. AgentSurface may expose verified filters and ranking metadata, but it does not prescribe a universal recommender or invent ranking rules. The agent may interpret natural-language needs into supported filters and rank the returned candidates for the user, provided it:

- ties each match reason to a returned field and the user's stated criterion;
- marks partial matches and missing information;
- does not claim a result is the best overall unless the comparison set and ranking basis support that claim;
- respects result bounds and returns a useful shortlist rather than dumping the catalog;
- can retrieve exact item details before presenting material claims.

### Result contract

Each search result should carry, where available:

- stable entity ID and type;
- display name and small selection summary;
- matching attributes with values and units;
- price amount, currency, price kind, and conditions;
- public availability and its freshness information;
- market/location applicability;
- canonical first-party item destination;
- source/provenance references and warnings for missing or stale data.

An agent should be able to cite the site and open the exact result from this contract without first visiting unrelated listing pages.

### Dynamic data and reliability

Price, inventory, availability, and other dynamic fields must follow a declared freshness policy. Search results should carry a source timestamp, response time, or explicit freshness class such as live, periodically updated, or static snapshot. If the source cannot establish freshness, report it as unknown. AgentSurface validation should detect schema and route drift; runtime integrations should surface service errors, partial results, and stale-data conditions rather than silently returning cached or fabricated values.

## User experience handoff

### Contract

The agent-facing result identifies the canonical first-party destination. The agent requests an open operation from its host using that destination or a verified opaque page reference. The host chooses an available surface and presents the real first-party page in the user's current agentic application whenever possible.

The host contract should be platform-neutral and adaptable to desktop, mobile, and web agent environments. At minimum it needs:

- a canonical destination or verifiable page reference;
- a requested presentation preference (current agent surface preferred; external browser allowed as fallback);
- optional non-sensitive context necessary to resolve or restore the item page;
- the resolved outcome (embedded/current app, companion app, external browser, denied, or unsupported);
- a user-visible error/fallback path.

This spec does not mandate one host API or MCP schema. Concrete host adapters may map the contract to their supported browser or navigation API. The agent must not claim that an embedded experience is available until the host confirms that presentation outcome.

### Preserve the actual website experience

When the host supports an embedded or in-app browser, it opens the canonical website URL in that surface and allows the first-party site to render its actual experience. It should not replace the selected page with a generated mirror. The host should preserve normal browser protections, site origin/security boundaries, and user-controlled navigation. Site authentication remains governed by the website and host; AgentSurface does not bypass login or permissions.

Search context may be carried only when the website supports it and it does not disclose sensitive user data. Item identity is preferred over copying the full natural-language conversation into a URL. URLs and handoff references must not contain credentials, private user attributes, or hidden tracking payloads.

### Fallbacks

If the host has no embedded experience, the agent can present a direct canonical link for the host to open externally. If no canonical page can be verified, it returns the result with a clear inability-to-open status and does not fabricate a URL. If the destination requires sign-in or user permission, the host handles its standard user-controlled flow.

## Agent-facing interaction flow

1. Discover the site's manifest and supported catalogs.
2. Map the user's request to supported fields, asking only for criteria that materially affect the search.
3. Call a read-only catalog search with bounded filters and a result limit.
4. Retrieve detail for promising candidates when needed.
5. Present a concise shortlist with source-backed match reasons, prices/conditions, freshness, and uncertainties.
6. When the user selects or asks to inspect a candidate, request host handoff to that candidate's canonical page.
7. Confirm the actual presentation outcome; if in-app opening is unavailable, offer the validated external-link fallback.

The agent must not contact a seller, submit user details, save a lead, request a quote, book, purchase, or otherwise commit the user through this workflow.

## Repo operating outputs

AgentSurface may generate a repo-local operating contract from a universal template plus repo-specific facts. Prefer one authoritative contract with thin platform-specific entry points. Do not create divergent copies of the same rules.

## Existing file preservation and ownership

AgentSurface must detect existing files such as `AGENTS.md`, `CLAUDE.md`, `OPERATE.md`, `.github/copilot-instructions.md`, and `llms.txt`. Human-owned files must not be silently overwritten. Generated artifacts include ownership metadata where formats permit, and generation is idempotent. Default to preserving unknown files and reporting conflicts.

## Provenance and validation

Every generated claim should retain a path to supporting evidence. Unknown provenance lowers confidence or prevents generation.

Minimum validation includes:

- route parity and canonical URL resolution;
- content fidelity and structured field fidelity;
- catalog schema/field/operator validity against the backing source;
- search and detail result shape and declared bounds;
- freshness metadata presence and accurate unknown states;
- entity-to-canonical-page parity, including no broken or cross-origin destinations by default;
- discovery integrity;
- capability truthfulness and read-only/state-changing classification;
- handoff destination safety and resolution;
- drift detection and ownership safety.

Validation reports must be structured and machine-readable as well as understandable to a person. A passing build-time validation does not claim that a third-party host supports an embedded browser or that dynamic inventory is currently available.

## CLI contract

Initial and planned commands:

```bash
agentsurface init
agentsurface inspect
agentsurface generate
agentsurface validate
agentsurface diff
```

- `init` creates minimal config without changing website behavior.
- `inspect` analyzes the repo and updates the CSM.
- `generate` produces selected, configured outputs from the CSM.
- `validate` checks generated outputs, data contracts, provenance, routes, and ownership.
- `diff` shows proposed output/model changes before mutation.

## Configuration

Proposed path: `.agentsurface/config.yaml`.

Configuration should support:

- include/exclude route and entity rules;
- output locations and generated formats;
- framework adapter selection;
- source mappings for catalog data and canonical item routes;
- field allowlists, field semantics, units, and public/private classification;
- query bounds, supported operators, and freshness policy;
- locale/market and optional location policy;
- handoff route resolution and allowed canonical origins;
- repo operating files, discovery metadata, and ownership policy;
- explicit owner overrides where source facts are ambiguous.

Overrides correct ambiguity and constrain exposure; they must not become an uncontrolled shadow CMS or invent unsupported service behavior.

## Adapter and integration contracts

Framework adapters expose verified repo facts. Catalog adapters bind the CSM to an existing authoritative public read source or a clearly scoped static index. Host adapters implement the presentation request in the agentic application. These are separate extension boundaries:

- framework adapters discover routes, content, source mappings, and safe injection points;
- catalog adapters normalize typed search/detail operations and freshness;
- output adapters generate Markdown, manifests, `llms.txt`, and optional protocol/tool projections;
- host adapters receive a validated destination and open it in a supported user-facing surface.

The core stays provider-neutral. MCP is one possible projection, not the canonical internal model or the only supported host integration. Adapters must not claim support for operations the backing site or host cannot verify.

## CI and ecosystem

CI should inspect and validate generated outputs, report drift, and fail on configured truth/safety violations. It should not silently regenerate and commit outputs by default. Structured reports support pull-request checks and other tooling. Schema.org/JSON-LD and OpenAPI should be reused when authoritative; richer entity extraction must retain provenance.

## Security, privacy, and safety

- Never mirror secrets, environment files, or private user data.
- Authenticated/private routes are excluded by default.
- Do not infer permissions or capabilities from UI copy.
- Allowlist public fields and canonical origins; reject unsafe or ambiguous URL construction.
- Read-only search does not submit user information or mutate site state.
- Location is optional unless the verified source requires it; use the least precise user-authorized value that can answer the query.
- Do not transmit sensitive or precise user data in search requests or handoff URLs without explicit authorization for the specific data and destination.
- Never place credentials, session tokens, or sensitive criteria in generated public artifacts, logs, or URLs.
- External side effects require explicit capability definitions and are outside the product-discovery workflow.
- Host navigation is user-controlled and must not bypass browser security, authentication, or permission prompts.

## Delivery phases and success criteria

The roadmap may sequence implementation, but this spec defines the intended product boundary across phases.

### Foundation: trustworthy generated surfaces

Success means a coding agent can inspect a supported repo, produce a provenance-preserving model, generate useful readable/discovery outputs, preserve human-owned files, and detect obvious drift.

### Repeatability and ecosystem

Success means the CLI supports repeatable config overrides, structured reports, multiple adapters, and dogfooding on structurally different sites. CI can detect stale or false output, and manifests can reuse authoritative schemas.

### Product discovery

Success means a user request can be mapped to supported catalog filters; the agent can search a bounded, authoritative result set, retrieve detail, explain match reasons and limits, and resolve the selected result to its canonical first-party page. Fields, price semantics, availability, location policy, and freshness are explicit and validated.

### Agentic experience handoff

Success means a host adapter can open a selected canonical item page in the current agentic application on supported desktop/mobile environments, report which surface actually opened, and provide a safe external fallback when in-app presentation is unavailable. The page is the real first-party website experience, not only a mirrored summary.

### Optional verified actions

Any future state-changing capabilities require a separate explicit design covering authorization, confirmation, data transmission, side effects, errors, and recovery. They are not required to fulfill product search and page handoff.

## Dogfooding and evaluation

Dogfooding must include both a content-heavy site and a catalogue with dynamic product data when available. Record:

- whether an agent can discover a catalog without broad page browsing;
- result quality and unsupported-field behavior;
- query count/response size compared with page-by-page browsing;
- source, freshness, and price/availability semantics;
- canonical URL resolution and broken-link rate;
- handoff outcomes by host and device class;
- whether users can inspect the real page inside their agentic environment;
- fallback behavior when the host cannot embed a page;
- privacy, auth, and ownership failures.

An agentification score is deferred until these tasks have repeatable empirical benchmarks. Scores must distinguish readability, discovery, product search, data reliability, and host handoff rather than collapsing them into a single claim.

## Future extensions

Only after dogfooding validates the core:

- broader framework and catalog adapters;
- JSON-LD/OpenAPI reuse;
- optional MCP/tool generation for verified read-only operations;
- richer entity relationships and comparison support;
- host-specific handoff adapters while keeping the core contract neutral;
- optional state-changing capabilities under a separate safety design;
- empirical capability reporting and agentification benchmarks.
