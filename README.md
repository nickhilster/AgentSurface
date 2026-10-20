# AgentSurface

AgentSurface helps a coding agent use a website's source repository to implement a trustworthy, site-native discovery experience in that website while preserving the human-facing site.

The website developer gives their coding agent the repository and AgentSurface. The agent inspects the framework, data source, routes, and public boundaries, then adapts the site so ordinary web-capable agents can find a small set of relevant items and link directly to the exact first-party item page. A separate public API contract is not required when the repository contains a usable source.

## Why this exists

Agents can end up browsing broad categories and many product pages, then return a link that does not identify the exact item the user wanted. AgentSurface helps the website developer change the website so an agent can find a useful shortlist quickly and link to each exact item page.

## Core principle

> Help the website developer's coding agent adapt the site using its own repository and data; make exact first-party item pages discoverable through ordinary web access.

## What AgentSurface helps build

1. **Repository transformation** — inspect the website code and help the coding agent implement the site-side changes.
2. **Site-native discovery** — an ordinary, accessible web page backed by the website's existing catalogue or content source.
3. **Exact item destinations** — canonical links from each result to its real first-party detail page.
4. **Optional projections** — structured metadata, manifests, or protocol tools when useful.
5. **Optional host handoff** — an app-specific integration may open the exact URL in-app; ordinary web links remain the baseline.

Discovery stays read-only. Checkout, lead capture, booking, purchase, and other state-changing actions require a separate design. The user's agentic application controls how a canonical link is presented.

## Intended workflow

```text
website repository + AgentSurface
    ↓
agent inspects framework, data source, routes, and boundaries
    ↓
agent implements a site-native bounded discovery page
    ↓
validate exact item routes, source-backed facts, privacy, and regressions
    ↓
deployed site works through ordinary web access
    ↓
agent returns an exact item link; the host opens it normally
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

The CLI currently provides repository initialization, inspection, generation, validation, and a non-mutating output preview with `diff`. Validation emits text and JSON reports. These capabilities are foundations for the repo-to-site workflow; the CLI does not yet implement the complete tailored website transformation.

The optional GitHub Actions workflow ([CI guide](docs/CI.md)) validates repositories without a live site and enables preview-server checks only when an explicit URL is configured.

`catalog-manifest` writes a compact public catalog descriptor to `<output.dir>/.well-known/agentsurface.json`, preserving human-owned files. The optional `agentsurface-mcp` stdio server exposes read-only `search_catalog` and `get_catalog_item` tools over configured public catalogs, plus `resolve_item_page` when an inspected public route and owner hostname are available. The resolver returns a pending canonical destination request; it does not open a browser or claim navigation.

The current catalog providers support explicitly configured public OpenAPI GET contracts or static JSON-LD indexes. They are optional compatibility paths, not requirements when the target website repository contains a usable source. The optional MCP adapter uses the official TypeScript SDK v2 and needs Node.js 20+ and TypeScript 6+ to build.

## Status

Early OSS design and dogfooding stage. Current code is a foundation, not the complete repo-to-site product described in the detailed design.

See:

- [Portable coding-agent workflow](AGENT_SURFACE.md)
- [Product specification](docs/SPEC.md)
- [Detailed repo-to-site product design](docs/superpowers/specs/2026-10-19-repo-to-agent-surface-design.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Dogfooding protocol](docs/DOGFOODING.md)
- [CI guide](docs/CI.md)
- [Roadmap](ROADMAP.md)
- [Operating contract](OPERATE.md)

## Origin

The initial architecture is extracted from patterns already deployed in a real portfolio/blog repository: a single repo-local operating contract with thin agent entry points, parallel `.md` representations for selected public pages, `rel="alternate"` discovery metadata, and `llms.txt` discovery.

AgentSurface exists to make useful site-side discovery patterns portable, inspectable, verifiable, and adaptable across website repositories.

## License

MIT. See [LICENSE](LICENSE).
