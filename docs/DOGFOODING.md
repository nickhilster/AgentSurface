# Dogfooding Protocol

The first release should be shaped by a real non-agentified website repository, not by speculative abstractions.

## Goal

Prove that AgentSurface can take one existing website repo and produce a trustworthy agent-facing interface layer with minimal manual intervention.

## Selection criteria for the first target

Choose a site that:

- is already working,
- is public-facing,
- does not already have the full AgentSurface pattern,
- has enough structure to expose useful routes/content,
- is safe to modify,
- has a deploy path we can validate.

Avoid picking the simplest possible static page. The target should reveal real edge cases.

## Dogfood sequence

### 1. Baseline the repo

Record:

- framework/build system
- route structure
- content sources
- structured metadata already present
- existing `AGENTS.md`, `CLAUDE.md`, `OPERATE.md`, `llms.txt`
- auth/private areas
- APIs/actions

### 2. Inspect without modifying

Produce an initial Canonical Site Model and explicitly mark unknowns.

Expected output:

```text
.agentsurface/model/
```

### 3. Review model truthfulness

Manually compare the model against the repo before generation.

Classify every issue as one of:

- parser gap
- framework adapter gap
- ambiguous source
- false inference
- missing provenance
- unsupported capability
- config/owner decision needed

### 4. Generate readable surfaces

Start with the highest-value public routes.

Generate only what can be justified from source.

### 5. Add discovery

Add `llms.txt` and alternate discovery metadata only after the target representations exist.

### 6. Validate

Run route parity, content fidelity, discovery integrity, ownership safety, and drift checks.

### 7. Change the source repo

Make at least one meaningful content/route change and confirm AgentSurface reports stale output correctly.

### 8. Record failures

Failures are product input. Document them rather than patching around them silently.

## Dogfood report template

For each run capture:

```markdown
# Dogfood Run YYYY-MM-DD

Target repo:
Framework:
AgentSurface version/commit:

## What worked

## What required manual correction

## False positives

## False negatives

## Provenance gaps

## Ownership conflicts

## Validation failures

## Proposed spec changes

## Proposed adapter changes
```

## Exit criteria for v0.1 dogfood

Do not call the first milestone complete until:

- generated routes are truthful,
- agent-readable outputs are discoverable,
- private/authenticated content is excluded by default,
- generated outputs can be regenerated without clobbering human files,
- a source change causes a useful drift signal,
- unresolved unknowns are reported rather than fabricated.

## Product discovery and experience handoff extension

When dogfooding reaches the catalog and host-integration phases, use a public catalogue with enough products and dynamic fields to make page-by-page browsing costly. Keep the original v0.1 checks; this section adds an end-to-end evaluation of find-then-open.

### Discovery baseline

Record a representative set of user needs and the exact site-supported filters they map to. For each query, measure:

- number of pages or records read;
- number of tool/API calls and response bytes;
- time to return a useful shortlist;
- whether returned candidates satisfy the explicit criteria;
- whether match explanations point to source-backed fields;
- whether unsupported criteria, missing data, and partial matches are called out;
- whether price, availability, location scope, and freshness are represented correctly.

Compare the results with a baseline where an agent traverses the site's normal pages. The goal is a smaller amount of browsing and context for comparable or better candidate coverage, not a universal ranking score.

### Handoff baseline

For selected candidates, verify:

- the result resolves to the exact canonical first-party item page;
- host presentation occurs inside the current agentic application when supported;
- the opened page is the real site experience, not only generated markdown or a copied card;
- the host reports the actual surface used;
- unsupported in-app presentation falls back to a validated canonical link;
- context passed to the destination contains no credentials, sensitive attributes, or raw conversation text;
- authentication, browser security, and site permission flows remain under user control.

Run each case on supported desktop and mobile hosts where available. Record unsupported hosts as unsupported; do not generalize a successful integration to hosts that were not tested.

### Product dogfood report additions

For each product-catalog run capture:

```markdown
## Catalog source and freshness

## Search cases and supported filter mapping

## Discovery baseline and page-by-page comparison

## Result match fidelity and unsupported criteria

## Price, availability, locale, and provenance issues

## Canonical item route resolution

## Host/device handoff outcomes

## Privacy, authentication, and fallback behavior

## Remaining product or adapter gaps
```

Do not claim the product-discovery milestone complete until bounded search returns source-backed candidates, canonical routes resolve, and the handoff reports an honest in-app or fallback outcome. Product search remains read-only; seller contact, quote submission, booking, and purchase actions are not part of this dogfood flow.

## Local dynamic demonstration (not a real-site dogfood run)

`examples/dynamic-catalog-site/` is a local fixture for exercising the interaction shape while no owner-authorized dynamic catalogue repository is available. It reads its JSON fixture from disk on each request, applies bounded query-time filters, and returns exact first-party-style item routes. The records are explicitly fictional and are not connected to dealer inventory.

This fixture can validate server-rendered query handling, exact item route construction, escaping, unsupported-filter disclosure, and exclusion of private fixture fields. It cannot validate integration with an existing website's server-side source, live freshness, real price/availability semantics, production scale, owner approval, or opening a page inside a user's agentic application. Keep the real dynamic-catalogue and host-handoff exit criteria open until those are exercised against an authorized real site and supported host.
