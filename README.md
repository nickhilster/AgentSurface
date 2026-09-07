# AgentSurface

AgentSurface adds an agent-facing interface layer to an existing website repository without replacing the human-facing site.

The project inspects a website repo, builds a trustworthy machine-readable model of what the site actually contains, generates agent-readable surfaces, advertises those surfaces for discovery, and validates them against the source so they do not silently drift.

## Why this exists

Websites already expose interfaces for humans and, in many cases, APIs or structured metadata for software. LLM agents need a different layer: one that makes content, routes, entities, capabilities, constraints, and provenance easy to discover and reason about.

AgentSurface treats that layer as generated infrastructure rather than hand-maintained documentation.

## Core principle

> Do not rewrite the website for agents. Generate an authoritative agent-facing representation from the website that already exists.

## The three surfaces

1. **Repo operating surface** — how coding agents should understand and safely modify the repository.
2. **Public agent-readable surface** — machine-readable representations of public website content.
3. **Discovery surface** — mechanisms such as `llms.txt` and alternate links that tell agents those representations exist.

A fourth layer, **agent-operable capabilities**, may be added only when the underlying website genuinely exposes safe, verifiable actions. Agent-readable and agent-operable are not the same thing.

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
    ├─ page/content markdown alternates
    ├─ llms.txt
    ├─ discovery metadata
    └─ structured manifests
    ↓
validate
    ↓
detect drift and false claims
```

## Planned CLI

```bash
agentsurface init
agentsurface inspect
agentsurface generate
agentsurface validate
agentsurface diff
```

The first milestone is deliberately narrower: dogfood the specification against one real website that has not yet been agentified, record what fails, then abstract only what survives contact with a real repo.

## Status

Early OSS design + dogfooding stage.

See:

- [`docs/SPEC.md`](docs/SPEC.md)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/DOGFOODING.md`](docs/DOGFOODING.md)
- [`ROADMAP.md`](ROADMAP.md)
- [`OPERATE.md`](OPERATE.md)

## Origin

The initial architecture is extracted from patterns already deployed in a real portfolio/blog repository: a single repo-local operating contract with thin agent entry points, parallel `.md` representations for selected public pages, `rel="alternate"` discovery metadata, and `llms.txt` discovery.

AgentSurface exists to make that pattern portable, inspectable, verifiable, and framework-agnostic.

## License

MIT. See [`LICENSE`](LICENSE).
