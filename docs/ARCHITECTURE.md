# Architecture

AgentSurface separates inspection, modeling, generation, and validation so each stage can be tested independently.

## Layer 1 — Inspect

Framework adapters extract verifiable facts from the target repository.

Inputs may include:

- route files
- content collections
- OpenAPI contracts
- JSON-LD/schema.org
- sitemaps
- robots.txt
- static HTML
- repo-local agent instructions

The inspector should prefer deterministic parsing over LLM inference.

## Layer 2 — Canonical Site Model

All outputs flow from a typed canonical representation stored under `.agentsurface/`.

Suggested layout:

```text
.agentsurface/
  config.yaml
  model/
    site.json
    routes.json
    entities.json
    capabilities.json
    constraints.json
    provenance.json
  generated/
```

The exact file split may change during dogfooding; the architectural requirement is one canonical machine-readable model, not duplicated hand-maintained Markdown.

## Layer 3 — Generate

Generators project the canonical model into delivery surfaces:

- repo operating contract
- thin platform entry points
- Markdown page mirrors
- llms.txt
- alternate discovery metadata
- structured manifests

## Layer 4 — Validate

Validators compare generated surfaces to the underlying repository and canonical model.

Validation should answer:

- Does this route exist?
- Is this content current?
- Does this discovery link point somewhere real?
- Is this claimed capability actually backed by code/API?
- Did generation overwrite something it did not own?

## Layer 5 — Maintain

AgentSurface should support CI and local diffing so drift becomes visible when the human-facing site changes.

The maintenance loop is:

```text
source change → inspect → model diff → generated diff → validate
```

## Adapter boundary

Framework adapters should be narrow. They expose facts, not project-wide policy.

Conceptual interface:

```ts
interface FrameworkAdapter {
  detect(repo: RepoContext): Promise<DetectionResult>;
  inspectRoutes(repo: RepoContext): Promise<RouteRecord[]>;
  inspectContent(repo: RepoContext): Promise<ContentRecord[]>;
  inspectCapabilities?(repo: RepoContext): Promise<CapabilityRecord[]>;
  discoveryInjectionPoints?(repo: RepoContext): Promise<InjectionPoint[]>;
}
```

## Provenance model

Any non-trivial generated fact should be traceable to evidence.

Conceptual provenance record:

```json
{
  "subject": "route:/values",
  "claim": "public-static",
  "source": "blog/src/pages/values.astro",
  "method": "framework-route-parser",
  "confidence": 1.0
}
```

Heuristic inference should carry lower confidence and should never elevate a site to agent-operable status on its own.

## Readable vs operable

A critical architectural boundary:

```text
Agent-readable
  understands content/routes/entities

Agent-operable
  invokes verified actions with side effects
```

The first can be generated broadly. The second requires explicit backing contracts, authorization, constraints, and side-effect semantics.

## Ownership model

Every generated artifact needs an owner state:

- generated-and-owned
- human-owned
- merged/managed
- conflict

Generation should default to preserving unknown files and reporting conflicts rather than overwriting them.
