# Dogfood Re-run 2026-09-19 (structured-data filter review follow-up)

Target repo: teambotics-website (main site), read-only against the existing on-disk
`.agentsurface/model/capabilities.json` — no server started, no writes made to that repo.

## What was fixed

A second review pass on `generateLlmsTxt` found that the §1.1 auth fix (previous
addendum, 2026-09-18) was incomplete: capabilities with `sideEffects: true` were still
published under a heading (`## Capabilities`) that reads as an invitation to call them,
regardless of auth. On the real target this affected three public, unauthenticated,
POST-only endpoints (`/api/chat`, `/api/leads`, `/api/visitor/log`) plus a fourth,
sharper case named directly by the review: `/api/cron/ingest-github`, an internal cron
trigger.

Per the review's own suggested criterion, `generateLlmsTxt` now excludes any capability
where `kind !== "readable"` or `sideEffects === true`, in addition to the existing
`authRequired` and `backingImplementation !== null` checks. The section heading was
renamed from `## Capabilities` to `## Structured data` (the original v0.1 heading) since
"Capabilities" itself reads as an action menu. The decision and its rationale are now
recorded in `docs/SPEC.md`'s discovery section, and `generate.test.ts` gained two tests:
a public POST-only endpoint (matching `/api/chat`'s real shape) is excluded, and the
heading is asserted directly.

## What the real-repo check found — and this is not fully closed

Checked directly against `teambotics-website`'s real, already-inspected
`capabilities.json` (no re-inspect, no server, read-only):

- 21 of 25 capabilities are now excluded by the combined filter (`authRequired ||
  sideEffects`) — up from 18 excluded by the auth-only filter.
- The 4 that remain: `/api/blog/posts`, `/api/blog/posts/[slug]`, `/api/values`, and
  **`/api/cron/ingest-github`**.

**`/api/cron/ingest-github` is still in the published list.** Its `CapabilityRecord` has
`sideEffects: false`, because `NextAppRouterAdapter.inspectCapabilities`'s mutation
detection (`src/adapters/nextAppRouter.ts`) is a syntactic check for `POST`/`PUT`/
`PATCH`/`DELETE` handler function declarations, and this route only exports a `GET`
handler — a common pattern for cron/webhook-triggered endpoints, where the side effect
happens on GET because the caller is a scheduler, not a REST client. `sideEffects: false`
is therefore an accurate description of the route's *HTTP verb shape* but not of its
*actual behavior*, and the projection filter — correctly, per the model it was given —
takes the model's word for it.

This is a different defect from the two fixed so far. The first two were the projection
ignoring a field the model already recorded correctly. This one is the underlying
classification itself being incomplete — a semantic side effect that a syntactic
HTTP-verb heuristic cannot see. The same root-cause pattern the review named ("publishing
a field without consulting the classification") does not fully apply here: the field
*was* consulted; the field itself doesn't yet capture this case.

**Not fixed in this pass.** Flagging rather than silently patching, per this project's
own standard of reporting what breaks instead of guessing at a fix: a plausible
correction (e.g., treating any route under `/api/cron/**` as `sideEffects: true`
regardless of HTTP verb, or widening the detection to path-based heuristics) is an
adapter-classification change, not a projection change, and touches
`NextAppRouterAdapter.inspectCapabilities`'s evidence model — closer to Phase 1's
adapter-contract territory (§2.2's `collectClassificationEvidence`) than to the Phase 0
projection fix this cycle was scoped to. Recommend deciding this explicitly before
Phase 1's adapter work, rather than folding it in unprompted here.
