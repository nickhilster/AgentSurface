# AgentSurface Catalog Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an agent find a small, relevant shortlist from a site's verified product catalog through bounded read-only search, without window-shopping across product pages.

**Architecture:** Extend the versioned Canonical Site Model with products and catalog contracts. Bind only to an explicitly configured authoritative public read source, project a compact discovery manifest, and expose optional MCP search/detail tools as an adapter over the same provider-neutral catalog interface.

**Tech Stack:** TypeScript, Node.js ESM, Vitest, existing js-yaml; optional MCP projection uses the official @modelcontextprotocol/server SDK behind a separate module, with a compatibility review before pinning its version.

**Spec:** docs/SPEC.md, especially “Product discovery and matching,” “Canonical Site Model,” “Public agent-readable outputs,” “Security, privacy, and safety,” and “Delivery phases and success criteria.” Depends on docs/superpowers/plans/2026-10-19-agent-surface-foundation.md for config validation and structured reports.

## Global Constraints

- “The website remains authoritative for its content, product data, routes, availability, pricing, and actions.”
- “The agent-facing selection layer exists to find a small, relevant set of items quickly.”
- “AgentSurface may describe or adapt an existing verified read interface. It must not invent a search endpoint or scrape hidden/private data and claim it is an authoritative catalog API.”
- “Only public content should be mirrored automatically by default.”
- “A machine-readable result without a valid destination is incomplete for a public catalog entity.”
- “Read-only search does not submit user information or mutate site state.”
- “Location is optional unless the verified source requires it; use the least precise user-authorized value that can answer the query.”
- “Never place credentials, session tokens, or sensitive criteria in generated public artifacts, logs, or URLs.”

## Review Focus

- An unsupported filter is rejected or reported, never silently ignored; pin with src/catalog/catalog.test.ts::rejectsUnsupportedFilter.
- A missing price or availability value stays unknown; pin with src/catalog/catalog.test.ts::preservesUnknownDynamicFields.
- A result without a validated canonical URL is withheld from eligible results; pin with src/catalog/catalog.test.ts::rejectsUnresolvableDestination.
- Search is bounded regardless of agent-provided limit; pin with src/catalog/catalog.test.ts::clampsResultLimit.
- Location is absent unless explicitly supplied and allowed by config; pin with src/catalog/catalog.test.ts::doesNotInferOrTransmitLocation.

---

### Task 1: Add versioned catalog and product model types

**Files:**
- Modify: src/types/model.ts
- Modify: src/lib/modelVersion.ts
- Modify: src/lib/modelVersion.test.ts
- Modify: src/commands/inspect.ts
- Create: src/commands/inspect.test.ts
- Modify: docs/ARCHITECTURE.md

**Interfaces:**
- Produces: ProductRecord, CatalogField, CatalogRecord, FreshnessRecord, and CatalogSourceRef in src/types/model.ts.
- CanonicalSiteModel.version advances from 0.1 to 0.2; the model adds catalogs: CatalogRecord[] and product entities carry stable IDs, typed attributes, price semantics, availability, locale/market scope, canonical page destination, and provenance.
- Source-backed Schema.org Product/Offer fields can populate static entity records; JSON-LD alone never implies live search, current availability, or public access.
- Readers reject version 0.1 with the existing actionable “run inspect” path; migration is by re-inspection, not guessed field backfill.

- [ ] Add failing tests named acceptsCurrentModelVersion02, rejectsPreviousModelVersion01, inspectWritesEmptyCatalogListWhenNoneConfigured, mapsSchemaOrgProductFieldsWithProvenance, and doesNotTreatJsonLdOfferAsLiveAvailability.
- [ ] Confirm model-version tests fail for the expected old literal version.
- [ ] Implement the v0.2 model contract and update every serialization/read site that assumes only routes/entities/capabilities/constraints.
- [ ] Run npm test -- src/lib/modelVersion.test.ts src/commands/inspect.test.ts and npm run typecheck; expected: pass.
- [ ] Commit the versioned catalog model change.

### Task 2: Add explicit catalog configuration and allowlists

**Files:**
- Modify: src/types/config.ts
- Modify: src/config.ts
- Modify: src/config.test.ts
- Modify: src/commands/init.ts
- Modify: docs/SPEC.md only for decisions left open by a real source contract

**Interfaces:**
- Produces: CatalogConfig with id, entityKind, source, searchOperation, detailOperation, fieldAllowlist, canonicalRoute, maxResults, freshness, and optional marketPolicy.
- loadConfig(repoRoot) validates the owner declaration and rejects unrecognized fields/operators or unsafe output/destination configuration with a field-path error.
- Existing config remains valid when catalogs is omitted.

- [ ] Add failing tests configAllowsExplicitPublicCatalog, configRejectsMissingSourceContract, configRejectsPrivateOrUnallowlistedFields, and legacyConfigStillLoads.
- [ ] Confirm the new validation cases fail against the current config loader.
- [ ] Implement defaults only for non-sensitive optional settings; never infer public scope, source operations, or location policy.
- [ ] Run npm test -- src/config.test.ts and npm run typecheck; expected: pass.
- [ ] Commit explicit catalog config and allowlist validation.

### Task 3: Define the provider-neutral catalog search interface

**Files:**
- Create: src/catalog/types.ts
- Create: src/catalog/catalog.ts
- Create: src/catalog/catalog.test.ts
- Modify: src/types/model.ts only to align shared serializable record types

**Interfaces:**
- Produces: CatalogSearchInput { query?: string; filters?: CatalogFilter[]; sort?: CatalogSort; limit: number; cursor?: string; market?: string }.
- Produces: CatalogSearchResponse { items: CatalogItemSummary[]; nextCursor: string | null; freshness: FreshnessRecord }.
- Produces: CatalogProvider.search(input): Promise<CatalogSearchResponse> and CatalogProvider.getById(id): Promise<CatalogItemDetail | null>.
- Supported scalar/range filters, fields, operators, result bounds, currencies, and units derive from each CatalogRecord; no free-form filter object reaches the source unvalidated.

- [ ] Add failing tests rejectsUnsupportedFilter, clampsResultLimit, preservesUnknownDynamicFields, doesNotInferOrTransmitLocation, and rejectsUnresolvableDestination.
- [ ] Confirm each failure case is observable before implementation.
- [ ] Implement a provider-neutral validator/normalizer that bounds queries, validates fields and operators, preserves unknowns, and validates same-origin canonical destinations.
- [ ] Run npm test -- src/catalog/catalog.test.ts and npm run typecheck; expected: pass.
- [ ] Commit the provider-neutral catalog contract.

### Task 4: Bind to an explicitly declared read source

**Files:**
- Create: src/catalog/providers/openApiCatalogProvider.ts
- Create: src/catalog/providers/openApiCatalogProvider.test.ts
- Create: src/lib/openApi.ts only if parsing is reusable
- Modify: src/commands/inspect.ts
- Modify: docs/DOGFOODING.md

**Interfaces:**
- Produces: inspectCatalogs(repoRoot, config): Promise<CatalogRecord[]> and a provider binding for source-declared GET/search and detail operations.
- Operation mapping comes from an explicit OpenAPI contract or owner config; operation IDs, parameters, response fields, auth, and side effects are validated before a live catalog is accepted.
- Schema.org/JSON-LD is reused for static entity metadata only; live search requires a separate verified read operation.
- Initial support is public read operations only. Unsupported OpenAPI features become model unknowns and validation report records.

- [ ] Add fixture tests mapsDeclaredSearchOperation, mapsDeclaredDetailOperation, rejectsMutationOperation, rejectsAuthRequiredOperation, reportsUnsupportedResponseSchema, mapsSchemaOrgProductFieldsWithProvenance, and labelsJsonLdCatalogAsStatic.
- [ ] Run the focused provider tests and confirm unsupported/unsafe fixtures fail closed.
- [ ] Implement OpenAPI/config binding with no arbitrary endpoint synthesis and no request body for the initial search adapter.
- [ ] Run focused tests, npm test, and npm run typecheck; expected: pass.
- [ ] Commit the verified source binding.

### Task 5: Generate compact discovery manifest and optional MCP tools

**Files:**
- Create: src/commands/catalogManifest.ts
- Create: src/commands/catalogManifest.test.ts
- Create: src/mcp/server.ts
- Create: src/mcp/server.test.ts
- Modify: src/cli/index.ts
- Modify: package.json and package-lock.json for an isolated MCP adapter dependency/bin
- Modify: docs/ARCHITECTURE.md and README.md

**Interfaces:**
- Generates public/.well-known/agentsurface.json (respecting configured public output dir) with version, catalog descriptor, supported fields/operators/bounds, data freshness policy, provenance policy, and canonical item-page resolution.
- Optional agentsurface-mcp exposes read-only search_catalog and get_catalog_item tools over CatalogProvider; source data and CSM core stay independent of MCP.
- MCP tool inputs have bounded schemas; tool annotations and descriptions explicitly state read-only behavior. stdout is reserved for protocol traffic.

- [ ] Add failing tests manifestListsOnlyAllowlistedCatalogFields, manifestHasCanonicalDestinationRule, mcpSearchIsBoundedReadOnly, mcpGetItemReturnsProvenance, and mcpDoesNotExposeTransactions.
- [ ] Confirm a test MCP client sees only the two catalog tools and receives structured output.
- [ ] Verify the official SDK package/version and its TypeScript requirement before installing; keep it isolated from core imports. Current official package docs: https://github.com/modelcontextprotocol/typescript-sdk/tree/main/packages/server and https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/get-started/first-server.md.
- [ ] Implement and test manifest ownership, path safety, tool schemas, source-call mapping, and stdout/stderr separation.
- [ ] Run npm test, npm run build, and npm run typecheck; expected: pass.
- [ ] Commit the manifest and optional MCP projection.

### Task 6: Dogfood product discovery against a dynamic catalog

**Files:**
- Modify: docs/DOGFOODING.md
- Add: dated report under docs/dogfood-reports/
- Modify: ROADMAP.md

- [ ] Use a real catalogue whose public search and detail contracts are owner-confirmed; record model/config mapping and source freshness behavior.
- [ ] Run representative natural-language needs through the agent tool flow and compare query count, result bytes, match fidelity, and time-to-shortlist with page-by-page browsing.
- [ ] Verify price semantics, availability timestamps, unknown fields, market scope, and canonical routes against source pages.
- [ ] Record unsupported criteria, source failures, host-independent link outcomes, and every unchecked validator result.
- [ ] Update roadmap checkboxes only after the acceptance criteria are evidenced in the report.
- [ ] Commit the dated dogfood report and roadmap updates.
