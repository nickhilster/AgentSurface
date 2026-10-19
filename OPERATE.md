# AgentSurface Operating Contract

This is the repo-local operating contract for coding agents working on AgentSurface.

## Required reading

Before making changes, read in this order:

1. `OPERATE.md`
2. `docs/SPEC.md`
3. `docs/superpowers/specs/2026-10-19-repo-to-agent-surface-design.md`
4. `ROADMAP.md`
5. `docs/DOGFOODING.md` when working on implementation behavior

## Source-of-truth order

When instructions conflict, use this hierarchy:

1. `OPERATE.md`
2. executable code and configuration
3. tests and validation rules
4. `docs/SPEC.md` and its linked detailed product design
5. architecture docs and README
6. roadmap/issues
7. historical comments or chat context

Do not silently reconcile contradictions. Surface them.

## Project goal

AgentSurface helps a coding agent inspect a website repository and implement a trustworthy, site-native agent-friendly discovery experience in that website while preserving its human-facing experience. The detailed product design describes the intended repo-to-site workflow and identifies which parts are not yet implemented.

## Non-negotiable principles

- Never invent routes, actions, APIs, entities, auth rules, capabilities, or data sources.
- Prefer repository-backed facts over LLM inference.
- Preserve provenance for generated claims where practical.
- Treat unknown as unknown rather than filling gaps.
- Reuse the target site's authoritative source; a separate public API contract is not required when repository data access is usable.
- Exact canonical item links matter; do not present category or generic search pages as exact-item matches.
- Keep discovery read-only and public by default; preserve auth and privacy boundaries.
- Preserve the human-facing website and owner-controlled files.
- Generated output must be reproducible and safe to regenerate.
- Framework-specific behavior belongs behind adapters.
- Keep core AgentSurface independent of any one LLM vendor or coding-agent product.
- Optional MCP, OpenAPI, JSON-LD, manifests, and host adapters must not become prerequisites for the core website experience.

## Development posture

This project is in dogfooding-first mode. Prefer a working repo-to-site transformation on representative target repositories over adding protocol breadth or generalizing from imagined needs.

A complete dogfood run should:

1. inspect a target website repository and identify its authoritative content or product source;
2. map public entities to exact canonical item routes;
3. implement a bounded, accessible discovery page using the site's existing architecture;
4. verify item identity, data accuracy, freshness claims, privacy boundaries, links, and site regressions;
5. record failures and missing abstractions.

The CLI, canonical model, generators, and validators support this outcome; they are not the success criterion by themselves.

## Approval boundaries

Agents may autonomously:

- add tests;
- improve documentation;
- implement behavior directly covered by the current spec;
- refactor internally without changing public semantics;
- add framework adapters that follow the adapter contract.

Pause for explicit owner direction before:

- changing the project's core semantics beyond the approved repo-to-site direction;
- introducing a vendor-specific dependency into the core;
- weakening provenance, privacy, or validation guarantees;
- changing generated-file ownership rules;
- adding an agent-operable action layer that could cause external side effects;
- removing backwards-compatible output formats;
- deploying changes or modifying an external production site.

## Handoff discipline

Every meaningful implementation change should leave the repository in a state where another agent can determine:

- what changed;
- why it changed;
- what remains unresolved;
- what validation was run;
- which assumptions were made.

Issues, commit messages, tests, and docs should carry that state rather than relying on chat history.
