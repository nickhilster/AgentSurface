# AgentSurface Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the repeatable, validated, machine-readable foundation needed by product discovery and page handoff.

**Architecture:** Keep the current TypeScript CLI and canonical model as the core. Add validated configuration, structured validation output, and non-mutating change previews; keep framework-specific facts behind adapters and use the same ownership-safe output path for generated public artifacts.

**Tech Stack:** TypeScript 5.7, Node.js ESM, `js-yaml`, Vitest, GitHub Actions.

**Spec:** `docs/SPEC.md`, especially “Validation,” “CLI contract,” “Configuration,” “CI and ecosystem,” and “Provenance and validation.”

## Global Constraints

- “Source-derived over inferred; uncertainty remains explicit.”
- “Generated outputs derive from this model or explicitly configured authoritative sources.”
- “Only public content should be mirrored automatically by default.”
- “Unknown provenance should reduce confidence or prevent generation.”
- “Default to preserving unknown files and reporting conflicts.”
- “CI should inspect and validate generated outputs, report drift, and fail on configured truth/safety violations. It should not silently regenerate and commit outputs by default.”

## Review Focus

- A pre-existing human-owned generated destination is preserved and a conflict is reported; pin with tests for `runGenerate` and the shared owned-write utility.
- Missing or stale model metadata never looks like a valid model; pin with `src/lib/modelVersion.test.ts`.
- A validator unable to check live routes reports `unchecked`, not `pass`; pin with `src/commands/validate.test.ts`.
- A dry-run diff never writes target files; pin with `src/commands/diff.test.ts`.
- A CI run without a preview server is explicit about the checks it skipped; pin with workflow fixtures and `src/commands/validate.test.ts`.

---

### Task 1: Reconcile the existing source audit with current code

**Files:**
- Read: `docs/PLAN-v1-product.md`
- Read: `src/commands/`, `src/config.ts`, `src/lib/`, `src/types/`, `src/cli/index.ts`
- Modify: `docs/PLAN-v1-product.md` only where it is still presented as actionable current guidance

**Interfaces:**
- Consumes: current `main` source and tests.
- Produces: a checked-off/deferred/superseded status for each existing proposal in `docs/PLAN-v1-product.md`; no implementation decision may rely on its stale “current state” statements without source confirmation.

- [ ] Compare each §1.1–§1.8 finding with current implementation and named tests; record the actual remaining gap or mark it resolved with the validating test.
- [ ] Compare its adapter, packaging, and CI proposals with `docs/SPEC.md` and the current roadmap; remove contradictions without deleting historical reasoning.
- [ ] Review: every proposed code change in the later tasks maps to an open roadmap item or a demonstrated correctness gap; already-implemented behavior is not reimplemented.
- [ ] Commit the reconciliation with message `docs: reconcile product plan with current source`.

### Task 2: Validate config and support owner-supplied source mappings

**Files:**
- Modify: `src/types/config.ts`
- Modify: `src/config.ts`
- Modify: `src/config.test.ts`
- Modify: `src/commands/init.ts`
- Create: `src/commands/init.test.ts`

**Interfaces:**
- Produces: `validateConfig(value: unknown): AgentSurfaceConfig`, throwing an actionable field-path error for invalid config.
- Backward compatibility: existing v0.1 config files with no new optional fields continue to load through defaults.
- Owner-supplied route classification/content-boundary overrides carry owner-declared provenance and cannot claim source-derived confidence.

- [ ] Add failing tests named `loadConfigDefaultsExistingFields`, `loadConfigRejectsInvalidPathOrHostname`, `loadConfigValidatesRouteOverrides`, and `initDoesNotOverwriteExistingConfig`.
- [ ] Run `npm test -- src/config.test.ts` and confirm the new validation cases fail for the expected reasons.
- [ ] Implement runtime config validation and safe path/hostname normalization; do not infer owner mappings from page copy.
- [ ] Run the focused tests and `npm run typecheck`; expected: pass.
- [ ] Commit the config validation change.

### Task 3: Emit structured validation reports

**Files:**
- Create: `src/types/validation.ts`
- Modify: `src/commands/validate.ts`
- Modify: `src/commands/validate.test.ts`
- Modify: `src/cli/index.ts`
- Modify: `docs/SPEC.md` only if the implementation reveals an unresolved report-field contract

**Interfaces:**
- Produces: `ValidationStatus = "pass" | "fail" | "unchecked"`, `ValidationRecord`, and `ValidateResult.records: ValidationRecord[]`.
- Produces: `writeValidationReport(repoRoot: string, result: ValidateResult): { path: string; conflict: boolean }`, writing `.agentsurface/validate-report.json`.
- Existing `failures` and `unchecked` arrays remain available to avoid breaking the CLI library surface in the same release.
- Adds live canonical-route reachability as a check; without a server URL it is unchecked, and a reachable wrong status is a failure.

- [ ] Add failing tests `reportHasPassFailAndUncheckedRecords`, `reportIsValidJson`, `reportMarksUnreachableRouteUnchecked`, and `unreachableCanonicalRouteFails`.
- [ ] Confirm the new tests fail against the current result type.
- [ ] Add one report record for each validation check and preserve error context without secrets.
- [ ] Write the report under `.agentsurface/`, which AgentSurface owns, and add `--format text|json` CLI output selection.
- [ ] Run `npm test -- --run src/commands/validate.test.ts` and `npm run typecheck`; expected: pass.
- [ ] Commit the structured validation report change.

### Task 4: Implement non-mutating `diff`

**Files:**
- Create: `src/commands/diff.ts`
- Create: `src/commands/diff.test.ts`
- Modify: `src/commands/generate.ts` to share pure render/projection functions
- Modify: `src/cli/index.ts`

**Interfaces:**
- Produces: `runDiff({ repoRoot, serverBaseUrl? }): Promise<DiffResult>`.
- `DiffResult` lists create/update/delete/conflict/unchecked changes and their output paths; `runDiff` does not write files.

- [ ] Add `diffDoesNotWriteFiles`, `diffReportsOwnedOutputUpdate`, and `diffReportsHumanOwnedConflict` tests.
- [ ] Confirm the dry-run behavior fails against a write-capable-only generator.
- [ ] Extract deterministic artifact projection from writing; route both `generate` and `diff` through that projection and the owned-write utility.
- [ ] Implement `agentsurface diff` CLI formatting and nonzero exit for configured conflicts or invalid model state.
- [ ] Run focused tests, full `npm test`, `npm run build`, and `npm run typecheck`; expected: pass and no target files changed by `diff`.
- [ ] Commit the non-mutating diff command.

### Task 5: Add tiered GitHub Actions validation

**Files:**
- Create: `.github/workflows/agentsurface-validate.yml`
- Create: `docs/CI.md`
- Modify: `README.md`
- Create: `.github/workflows/fixtures/` only if fixture workflows are needed

**Interfaces:**
- Tier 1 runs inspect/model/config/route/discovery/ownership validation without a running target site.
- Tier 2 is enabled only when the workflow receives an explicit preview URL; it runs live content and reachability checks.
- The workflow never regenerates or commits outputs.

- [ ] Add workflow checks for Tier 1 defaults, explicit Tier 2 opt-in, permissions limited to read-only repository contents, and no write-back step.
- [ ] Run a local YAML parse/lint and a fixture invocation for no-preview and preview-configured inputs.
- [ ] Document required commands, preview URL input, report artifacts, and which checks remain unchecked without Tier 2.
- [ ] Confirm PR failure/report policy matches `docs/SPEC.md`; expected: truth/safety failures fail the job, optional live drift is reported unless strict mode is enabled.
- [ ] Commit the tiered CI workflow.

### Task 6: Foundation exit review

**Files:**
- Modify: `ROADMAP.md`
- Modify: `docs/DOGFOODING.md`
- Add: dated dogfood report under `docs/dogfood-reports/`

- [ ] Run `npm test`, `npm run build`, and `npm run typecheck`.
- [ ] Dogfood the CLI against the existing supported repo and a second structurally different site; verify JSON report, diff non-mutation, route/content validation, and CI tier behavior.
- [ ] Record every unverified check as unchecked; update roadmap checkboxes only for demonstrated behavior.
- [ ] Commit the foundation dogfood report and roadmap updates.
