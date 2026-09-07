# AgentSurface Operating Contract

This is the repo-local operating contract for coding agents working on AgentSurface.

## Required reading

Before making changes, read in this order:

1. `OPERATE.md`
2. `docs/SPEC.md`
3. `ROADMAP.md`
4. `docs/DOGFOODING.md` when working on implementation behavior

## Source-of-truth order

When instructions conflict, use this hierarchy:

1. `OPERATE.md`
2. executable code and configuration
3. tests and validation rules
4. `docs/SPEC.md` and architecture docs
5. README and examples
6. roadmap/issues
7. historical comments or chat context

Do not silently reconcile contradictions. Surface them.

## Project goal

AgentSurface should inspect an existing website repository and generate a trustworthy agent-facing interface layer without rewriting the human-facing website.

## Non-negotiable principles

- Never invent routes, actions, APIs, entities, auth rules, or capabilities.
- Prefer source-derived facts over LLM inference.
- Preserve provenance for generated claims where practical.
- Treat unknown as unknown rather than filling gaps.
- Keep agent-readable and agent-operable capabilities separate.
- Generated output must be reproducible and safe to regenerate.
- Human-owned files must not be overwritten without explicit ownership rules.
- Framework-specific behavior belongs behind adapters.
- The canonical site model is machine-readable; Markdown is a projection, not the authoritative internal representation.
- Avoid coupling the project to one LLM vendor or coding-agent product.

## Development posture

This project is in dogfooding-first mode. Do not generalize from imagined needs when a real target repository can answer the question.

The first implementation should optimize for:

1. inspect one non-agentified website repo,
2. produce a canonical model,
3. generate useful agent-readable surfaces,
4. add discovery,
5. validate truthfulness and drift,
6. record failures and missing abstractions.

## Approval boundaries

Agents may autonomously:

- add tests,
- improve documentation,
- implement behavior that is directly covered by the current spec,
- refactor internally without changing public semantics,
- add framework adapters that follow the adapter contract.

Pause for explicit owner direction before:

- changing the project’s core semantics,
- introducing a vendor-specific dependency into the core,
- weakening provenance or validation guarantees,
- changing generated-file ownership rules,
- adding an agent-operable action layer that could cause external side effects,
- removing backwards-compatible output formats.

## Handoff discipline

Every meaningful implementation change should leave the repository in a state where another agent can determine:

- what changed,
- why it changed,
- what remains unresolved,
- what validation was run,
- which assumptions were made.

Issues, commit messages, tests, and docs should carry that state rather than relying on chat history.
