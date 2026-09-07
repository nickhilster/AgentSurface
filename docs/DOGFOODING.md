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
