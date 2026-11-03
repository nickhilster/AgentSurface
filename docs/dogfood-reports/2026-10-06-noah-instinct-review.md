# Dogfood Run 2026-10-06

Target repo: C:\DEV\noah-instinct-review
Framework: Vite React SPA
AgentSurface version/commit: local working tree after 580fc8c

## What worked

- Added a Vite React adapter that reads the explicit standalonePages route map in src/main.tsx.
- Recorded source provenance for the five Team Instinct routes and their main content boundaries.
- Applied route-prefix exclusions so unrelated portfolio routes were not exposed.
- Generated llms.txt and public Markdown alternates with AgentSurface ownership headers.
- Validated route parity, public discovery links, and ownership safety.

## What required manual correction

The target is client-rendered. A normal HTTP fetch of a Vite route returns the application shell without the React-rendered main content. The first agentsurface generate run correctly refused to fabricate page mirrors. The public Markdown mirrors were then added from the verified rendered route content and carry explicit source-file provenance.

## False positives

None observed in the selected route set.

## False negatives

Live drift checking remains unavailable through the fetch-only generator for this SPA. Browser-rendered verification was performed separately against the human surface.

## Provenance gaps

The mirrors are source-mapped to their route component files, but their visible content was curated from the rendered client surface rather than extracted automatically.

## Ownership conflicts

None. AgentSurface-owned llms.txt, public alternates, and internal generated mirrors were created in empty locations.

## Validation failures

validate --no-drift-check reported one acknowledged unchecked drift check and no validation failures.

## Proposed adapter changes

Add an optional browser-rendering recipe for client-rendered apps so generate can obtain a real DOM without weakening the refusal-to-guess behavior.
