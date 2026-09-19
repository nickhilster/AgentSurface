# AgentSurface Specification

## Purpose

AgentSurface installs a trustworthy agent-facing interface layer over an existing website repository.

It does not replace the website, redesign the site, or invent capabilities. It inspects what exists, models it, generates machine-readable representations, advertises those representations, and validates them against the source repository.

## Problem statement

Human-facing websites are optimized for browsers and people. Agents can often scrape them, but scraping alone does not provide a reliable operating contract, explicit route/content structure, provenance, discovery, or truth guarantees.

AgentSurface provides a structured intermediary layer between a website repo and downstream LLM agents.

## Design goals

- Framework-agnostic core
- Model/provider agnostic
- Source-derived over inferred
- Reproducible generation
- Explicit provenance
- Drift detection
- Incremental adoption
- Safe coexistence with existing repo conventions
- No false claims about operability

## Non-goals

AgentSurface is not:

- a CMS,
- a website builder,
- a crawler-first search product,
- an autonomous browser agent,
- a substitute for existing APIs,
- a mechanism to expose private content,
- an excuse to turn every site into an agent-operable application.

## Terminology

### Human surface
The existing website experience intended for people.

### Repo operating surface
Instructions that help coding agents safely understand and modify the repository.

### Public agent-readable surface
Machine-readable representations of public website content, such as Markdown mirrors or structured manifests.

### Discovery surface
Metadata or endpoints that tell agents what agent-readable surfaces exist.

### Agent-operable surface
Verified actions or tools that an agent can invoke to change state. This is distinct from readability and is optional.

### Canonical Site Model (CSM)
The machine-readable source of truth produced from repository inspection. All generated outputs should derive from this model.

## Architecture

```text
Target Website Repository
        |
        v
   Inspector Layer
        |
        v
Canonical Site Model
        |
        +--> provenance
        +--> routes
        +--> content/entities
        +--> capabilities
        +--> constraints
        +--> source mappings
        |
        v
   Generator Layer
        |
        +--> repo operating files
        +--> Markdown alternates
        +--> llms.txt
        +--> discovery metadata
        +--> structured manifests
        |
        v
   Validation Layer
        |
        +--> route parity
        +--> content fidelity
        +--> stale output detection
        +--> capability truthfulness
        +--> ownership safety
```

## Inspection hierarchy

Prefer authoritative structured sources before heuristic inference.

Recommended order:

1. Existing AgentSurface config/model
2. Framework route definitions and content collections
3. OpenAPI or typed API contracts
4. JSON-LD / schema.org
5. sitemaps
6. robots.txt
7. CMS/content schemas
8. source files
9. rendered/static HTML
10. heuristic inference

If information comes from heuristic inference, mark it as such.

## Canonical Site Model

The CSM should be serialized as typed JSON or YAML. Markdown must not be the sole internal source of truth.

Illustrative shape:

```json
{
  "version": "0.1",
  "site": {
    "name": "Example",
    "framework": "astro"
  },
  "routes": [],
  "entities": [],
  "capabilities": [],
  "constraints": [],
  "provenance": []
}
```

### Route record

Each route should be able to carry:

- route/path
- public/private classification
- content type
- source file(s)
- agent-readable alternate, if generated
- canonical URL, if known
- provenance
- confidence

### Capability record

Each capability should include:

- name
- description
- readable vs operable classification
- backing implementation
- auth requirements
- side effects
- constraints
- provenance
- confidence

No operable capability may be generated from copy alone.

## Content classification

Every candidate surface should be classified before generation.

Suggested classes:

- public-static
- public-dynamic
- transactional
- authenticated
- private/internal
- unsafe-to-expose
- unknown

Only public content should be mirrored automatically by default.

## Public agent-readable outputs

Depending on framework and content type, AgentSurface may generate:

- `/page.md`
- `/posts/{slug}.md`
- `/values.md`
- machine-readable route indexes
- content/entity manifests

Markdown mirrors should preserve useful semantic structure while avoiding presentation-only noise.

## Discovery outputs

AgentSurface may generate or configure:

- `/llms.txt`
- `<link rel="alternate" type="text/markdown">`
- alternate links in appropriate human-facing pages
- site-level agent index/manifest

Discovery must point to outputs that actually exist.

### What a capability projection into `llms.txt` may include

`llms.txt` is a discovery index for agent-*readable* content. It must never be, or read
as, an invitation to invoke agent-*operable* actions — that is a separate, explicitly
higher-scrutiny surface (see "Readable vs operable" in `docs/ARCHITECTURE.md`).

Concretely, a `CapabilityRecord` may only be projected into `llms.txt` when **all** of the
following hold:

- it carries a real, source-derived `backingImplementation` (never a literal route/URL
  invented for one specific site);
- `authRequired` is `false` — an auth-gated capability is private-by-classification, and
  listing it in a public file leaks its existence;
- `kind === "readable"` **and** `sideEffects === false`. A public, unauthenticated
  endpoint that mutates state (e.g. a POST-only API) is still agent-operable territory by
  virtue of what it *does*, regardless of who can reach it. `kind: "readable"` alone does
  not capture this — the generator inspection pass in v0.1 only ever emits
  `kind: "readable"` (see `docs/ARCHITECTURE.md`'s adapter boundary), so `sideEffects`
  is the field that actually distinguishes "safe to list as structured data" from
  "reads as callable."

The section heading for this projection must not read as an action menu. Use
`## Structured data`, not `## Capabilities` — a heading is part of what an agent reads,
and "Capabilities" invites exactly the misreading this section exists to prevent.

This was learned the hard way: a `generate.ts` revision briefly published every
capability with a non-null `backingImplementation` regardless of `authRequired` or
`sideEffects`, publishing 18 authenticated admin endpoints and several public mutation
endpoints (chat, lead capture, an internal cron trigger) in a live dogfood target's public
`llms.txt`. See `docs/dogfood-reports/2026-09-18-teambotics-website-phase0-rerun.md`.

## Repo operating outputs

AgentSurface may generate a repo-local operating contract based on a universal template plus repo-specific facts.

Recommended pattern:

- one authoritative contract
- thin platform-specific entry points
- machine-verifiable presence of those entry points

Do not create divergent copies of the same operating rules.

## Existing file preservation

AgentSurface must detect existing files such as:

- `AGENTS.md`
- `CLAUDE.md`
- `OPERATE.md`
- `.github/copilot-instructions.md`
- `llms.txt`

Existing human-owned files must not be silently overwritten.

Possible strategies:

- preserve and report conflict
- merge through explicit markers
- generate into `.agentsurface/generated/`
- require an override flag

Default behavior should be conservative.

## Generated file ownership

Generated files should include machine-readable ownership metadata or headers where format permits.

Example:

```text
Generated by AgentSurface.
Source model: .agentsurface/model/site.json
Do not edit directly unless ownership is transferred.
```

The generator must be idempotent.

## Provenance

Generated claims should retain a path back to the source that justified them.

Examples:

- route -> source file
- page mirror -> content file
- API capability -> OpenAPI operation
- auth rule -> middleware/config

Unknown provenance should reduce confidence or prevent generation.

## Validation

Minimum validators:

### Route parity
A documented route must exist or be explicitly marked external/virtual.

### Content fidelity
Generated text should correspond to current source content.

### Discovery integrity
Alternate links and `llms.txt` entries must resolve to generated outputs.

### Capability truthfulness
No action should be marked operable without a backing implementation.

### Drift detection
Changes to source routes/content/config should identify stale generated output.

### Ownership safety
Generation must not clobber unowned files.

## CLI contract

Initial commands:

```bash
agentsurface init
agentsurface inspect
agentsurface generate
agentsurface validate
agentsurface diff
```

### `init`
Create minimal AgentSurface config without altering existing application behavior.

### `inspect`
Analyze the repository and emit/update the Canonical Site Model.

### `generate`
Generate selected surfaces from the CSM.

### `validate`
Check generated surfaces against the repo.

### `diff`
Show what AgentSurface would change before mutation.

## Configuration

Proposed path:

```text
.agentsurface/config.yaml
```

Configuration should support:

- included/excluded routes
- output locations
- framework adapter override
- visible alternate-link preference
- whether repo operating files are generated
- preservation/ownership policy
- site metadata overrides

Overrides should correct source ambiguity, not become a second uncontrolled CMS.

## Adapter contract

Framework-specific adapters should expose a common interface to the core.

Initial likely adapters:

- Astro
- Next.js
- Vite/static SPA
- static HTML

Each adapter should provide only facts it can verify, such as:

- framework detection
- route discovery
- content source mapping
- build output conventions
- safe injection points for discovery metadata

## CI integration

A later but important workflow:

```text
PR opened
   ↓
AgentSurface inspect
   ↓
compare CSM/generated outputs
   ↓
validate
   ↓
fail if agent surface is stale or false
```

CI should make drift visible, not regenerate and silently commit by default.

## Security and privacy

- Never mirror secrets or environment files.
- Authenticated/private routes are excluded by default.
- Do not infer permissions from UI copy.
- External side effects require explicit capability definitions.
- Generated discovery must not expose otherwise undiscoverable private resources.

## First milestone

The first milestone is not broad framework support.

It is:

1. pick one real website repo that is not agentified,
2. inspect it manually and with the first implementation,
3. produce a CSM,
4. generate useful readable/discovery surfaces,
5. validate them,
6. document failures,
7. revise this spec from evidence.

## Success criteria for v0.1

AgentSurface v0.1 succeeds if a coding agent can be pointed at a supported website repo and, without inventing capabilities:

- understand the site structure,
- produce a trustworthy machine-readable representation,
- expose discoverable agent-readable content,
- report what it cannot determine,
- detect obvious drift after the source changes.

## Future directions

Only after dogfooding validates the core:

- additional framework adapters
- JSON-LD generation/reuse
- OpenAPI integration
- MCP tool generation for genuinely operable capabilities
- richer entity graphs
- plugin architecture
- package/CLI distribution
- agentification score/reporting
