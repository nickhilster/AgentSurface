# AgentSurface

AgentSurface adds a trustworthy agent-facing interface layer to an existing website repository without replacing the human-facing site.

The project inspects a website repo, builds a provenance-backed model of its content, products, routes, and verified capabilities, generates lightweight discovery and selection surfaces, and validates them against their sources so they do not silently drift. For product catalogues, the goal is to help an agent find a relevant item quickly, then hand the exact first-party page to the user's agentic application so the user can inspect the real website experience there.

## Why this exists

Websites already expose interfaces for humans and, in many cases, APIs or structured metadata for software. LLM agents need a different layer: one that makes content, routes, entities, capabilities, constraints, and provenance easy to discover and reason about.

AgentSurface treats that layer as generated infrastructure rather than hand-maintained documentation.

## Core principle

> Do not rewrite the website for agents. Generate an authoritative selection layer from what already exists, then let the user's agentic application open the real first-party page.

## The surfaces

1. **Repo operating surface** — how coding agents should understand and safely modify the repository.
2. **Public agent-readable surface** — machine-readable representations of public website content.
3. **Discovery surface** — mechanisms such as `llms.txt`, manifests, and alternate links that tell agents what data and routes exist.
4. **Product selection surface** — bounded, source-backed catalog search and detail data that helps agents find items without traversing every page.
5. **Experience handoff** — a host-mediated request to open the selected item's canonical first-party page inside the user's agentic application when supported.

Read-only search and retrieval are distinct from state-changing actions. Transactional capabilities require a separate safety design. Website metadata declares verified destinations; the agent host controls presentation and confirms where the page actually opened.

## Intended workflow

```text
website repo
    ↓
inspect
    ↓
canonical site model
    ↓
generate
    ├─ repo operating contract
    ├─ content and entity representations
    ├─ catalog search/detail contracts
    ├─ discovery metadata and manifests
    └─ canonical item-page destinations
    ↓
validate
    ↓
find likely items with bounded queries
    ↓
ask the user's agentic application to open the selected real first-party page
```

## CLI

```bash
agentsurface init
agentsurface inspect
agentsurface generate
agentsurface validate
agentsurface diff
agentsurface catalog-manifest
agentsurface-mcp
```

The CLI provides repository initialization, inspection, generation, validation, and a
non-mutating output preview with `diff`. Validation emits both text and JSON reports.
The optional [GitHub Actions workflow](docs/CI.md) runs repository checks without a live
site and enables preview-server checks only when an explicit URL is configured.

`catalog-manifest` writes a compact public catalog descriptor to
`<output.dir>/.well-known/agentsurface.json`, preserving human-owned files. The optional
`agentsurface-mcp` stdio server exposes read-only `search_catalog` and
`get_catalog_item` tools over inspected public catalogs, plus `resolve_item_page` when
an inspected public route and owner hostname are available. The page resolver returns
a pending canonical destination request; it does not open a browser or claim navigation.
Configure a public OpenAPI GET
contract or explicitly opt into a static JSON-LD index, then run `agentsurface inspect`
before publishing the manifest or starting the MCP server. Search returns the real
first-party item route; opening that route remains the agent host's responsibility.
The optional MCP adapter uses the official TypeScript SDK v2 and needs Node.js 20+ and
TypeScript 6+ to build; the core provider interfaces do not depend on MCP.

The dynamic OpenAPI adapter currently supports documented filter fields and bounded
search/detail calls; it reports dynamic sorting as unsupported until the source declares
an unambiguous sort mapping. Neither JSON-LD nor a model record proves live inventory.
Host-specific browser presentation is kept behind the [host adapter contract](docs/HOST-ADAPTERS.md);
this repository does not claim that a particular agentic app or desktop/mobile platform
has an embedded browsing adapter.

## Status

Early OSS design + dogfooding stage.

See:

- [`docs/SPEC.md`](docs/SPEC.md)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/DOGFOODING.md`](docs/DOGFOODING.md)
- [`docs/CI.md`](docs/CI.md)
- [`ROADMAP.md`](ROADMAP.md)
- [`OPERATE.md`](OPERATE.md)

## Origin

The initial architecture is extracted from patterns already deployed in a real portfolio/blog repository: a single repo-local operating contract with thin agent entry points, parallel `.md` representations for selected public pages, `rel="alternate"` discovery metadata, and `llms.txt` discovery.

AgentSurface exists to make that pattern portable, inspectable, verifiable, and framework-agnostic.

## License

MIT. See [`LICENSE`](LICENSE).
