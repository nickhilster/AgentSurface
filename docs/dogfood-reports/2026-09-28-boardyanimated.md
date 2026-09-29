# Dogfood Run 2026-09-28

Target repo: `C:\dev\BoardyAnimated-boardy4age-agents`
Framework: Vite 8 with explicit React pathname branches and static HTML under `public/`
AgentSurface branch/commit: `codex/boardyanimated-agentsurface`, final implementation includes `90d5ec5`
Target branch/commit: `codex/boardy4age-agents-page`, generated layer `fed1f01`, page/docs `6ae1c58`

## What worked

- High-confidence Vite detection used both Vite config and package metadata.
- Source-derived inventory found 15 routes: seven static routes and eight React routes.
- Four static routes with an explicit `<main>` boundary received Markdown mirrors.
- Three static routes loading `/shared/soft-gate.js` remained in discovery as `human-gated` and received no Markdown body.
- Eight interactive React routes remain HTML-only. The manifest records source files and the verified Google Meet / browser microphone requirements present in route components.
- `llms.txt`, `public/agentsurface/routes.json`, and Markdown outputs were byte-stable across repeated generation.
- A temporary source text change caused validation to report stale `/4age/agents/` Markdown. After restoring the source and rebuilding, validation passed.
- All 15 manifest targets returned HTTP 200 in Vite preview. Markdown was `text/markdown`, the manifest was `application/json`, and `llms.txt` was `text/plain`.

## What required manual correction

- Vite dev server paths returned the React app shell for nested static pages. The production-style Vite preview served the actual `public/**/index.html` pages and was used for generation and validation.
- Static routes retain canonical trailing slashes for HTML reachability; Markdown filenames use normalized paths. Drift validation was corrected to fetch the canonical route URL.
- Inline labels such as `To` and `From` lost spaces in Markdown extraction. The HTML-to-Markdown converter now inserts word boundaries at inline closing tags; a regression test covers this.

## False positives

- The dev server's SPA fallback initially looked like a missing static content boundary. This was an environment mismatch; the built preview confirmed the source boundaries.

## False negatives

- Interactive React routes have no deterministic textual boundary in the current adapter and intentionally remain HTML-only.
- The default React route title uses the path fallback because no source-derived page title is available in `src/App.tsx`.

## Provenance gaps

- Route provenance points to static HTML, `src/App.tsx`, and imported React route components. Additional UI facts not directly detected by those sources are omitted.

## Ownership conflicts

- None. The route manifest, `llms.txt`, and four Markdown files carry AgentSurface ownership metadata. A separate comparison document in the target worktree was left untouched.

## Validation failures

- The resolved local-preview and canonical-trailing-slash issues are described above. Final AgentSurface validation reported 4 generated Markdown files, 15 discovery links, and no failures.

## Proposed spec changes

- None required for this run.

## Proposed adapter changes

- None beyond preserving canonical static URLs and recording explicit component permission/context requirements.

## Deployment

- No production deployment was performed. Validation used the local built preview.
