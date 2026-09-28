# BoardyAnimated AgentSurface Design

**Date:** 2026-09-28  
**Status:** Awaiting owner review  
**Target:** `C:\dev\BoardyAnimated-boardy4age-agents`

## Goal

Make every intended BoardyAnimated website page discoverable and useful to agents while preserving the existing human-facing site. Use AgentSurface as the source-derived inspection, generation, and validation workflow. Do not create agent-operable actions or imply that an agent can perform an action merely because a page describes it.

## Current site

BoardyAnimated is a Vite/React application with static HTML pages under `public/`. React route selection is explicit in `src/App.tsx`; the static pages are explicit `public/**/index.html` files. Some static pages include the client-side soft gate. React experiences include pages with browser microphone access and Google Meet add-on context. The `?capture=1` animation path, Meet test query options, and Figma Make development page are implementation/test surfaces rather than distinct public content pages.

AgentSurface currently has a Next.js App Router adapter. Its public discovery output is `llms.txt`; Markdown generation requires a verified content boundary and a running site. A Vite/static adapter and Vite-specific public Markdown delivery are not implemented.

## Proposed approach

Add a deterministic Vite/static adapter to AgentSurface. It will identify the Vite project from repository configuration, enumerate static `index.html` pages and React paths declared in `src/App.tsx`, and preserve source-file provenance for each route. It will not crawl arbitrary links and treat every linked URL as a route. Route inventory will exclude query-string test/capture variants and development-only routes.

On the human-facing `/4age/agents/` page, add recognizable brand marks wherever a named third-party brand is shown, especially in the Boardy contact-channel cards. Keep readable text labels beside every logo. Use neutral accessible icons for generic channels such as SMS, phone, and email; do not use a brand mark that suggests a separate iMessage integration. Prefer existing local assets, otherwise add properly sourced local logo assets rather than runtime hotlinks.

For static HTML routes, the adapter will use explicit content boundaries. It must not mistake a soft-gate login form for page content. Routes using the client-side human gate will appear in the public route index with their canonical URL and a clear gated-page note, but no page Markdown will be published for them. Other static pages with a verified public boundary will receive Markdown mirrors.

For React routes, the public index will link to the existing page and include only factual metadata derived from its explicit route declaration and page source. A page Markdown mirror will be generated only when the adapter can identify a deterministic textual content source; otherwise the index will say that the page is an interactive experience and link to its HTML. Microphone permission and Google Meet context requirements will be included only when stated by the source. No browser automation or speculative transcript extraction is in scope.

Extend AgentSurface's output configuration so generated Markdown pages can be written to a target site's static public directory with ownership protection, and discovery links resolve to those deployed files. Preserve the existing internal canonical model and generated ownership rules. Existing human-owned files, including `AGENTS.md`, remain untouched. Generate `llms.txt`, plus `public/agentsurface/routes.json` as the public route manifest. The manifest is a projection of the canonical route model, not a separately maintained route list.

## Route scope and content policy

Include all current, intended public routes identified from the source:

- Static HTML pages under `public/**/index.html`, including `/4age/` and `/4age/agents/`.
- React routes in `src/App.tsx`, including the home page and shipped experiences such as `/free-boardy`, `/memeking`, `/chatting-with-boardy`, `/meet-side-panel`, `/meet-main-stage`, `/mic-demo`, and `/boardy-v2-lab`.
- Where a static HTML route and React route overlap, preserve the deployed route behavior verified from Vite/Vercel configuration and report the source mapping explicitly.

Exclude non-page variants such as `?capture=1`, `?speaking=1`, `?testAudio=...`, and the Figma Make development kit. Do not include routes that are only present in another dirty checkout or unmerged local edits.

The site-level public index may identify human-gated routes, but generated public Markdown must not contain their gated page content. This is an audience/content policy, not a claim that the client-side gate is a security boundary. Private files, credentials, environment files, and internal development routes are never published.

## Generation and discovery

AgentSurface will produce a canonical route model with provenance in `.agentsurface/model/`. Public Markdown pages will be served under `public/agentsurface/pages/`; the public route manifest will be `public/agentsurface/routes.json`. Each manifest entry contains the canonical path, route title when deterministically available (otherwise the path), canonical HTML URL, Markdown URL or `null`, a surface type (`static-content`, `interactive`, or `human-gated`), source file paths, and any verified access/interaction requirements. `llms.txt` links to each intended public page, using a Markdown mirror when one is generated and the canonical HTML URL otherwise. Every discovery target must resolve in the built site.

Generation must be repeatable and refuse to overwrite unowned files. Static Markdown output paths must be stable and avoid collisions with existing routes or human-owned assets. No new backend, authentication, or side-effecting agent capability is introduced.

## Validation

The implementation is complete when:

1. AgentSurface detects BoardyAnimated as Vite/static with high confidence and discovers all intended current routes from source.
2. The generated route model records source provenance and explicitly excludes test/capture/development variants.
3. Public Markdown is generated only for routes with verified content boundaries; gated page bodies are absent.
4. `llms.txt` and the route manifest link to real HTML or Markdown outputs, and the manifest clearly identifies gated and interactive HTML-only pages.
5. Repeated generation is byte-stable and does not overwrite human-owned content.
6. AgentSurface validation reports no route-parity, discovery, ownership, or content-drift failures.
7. The BoardyAnimated production build succeeds, and a local preview serves `llms.txt`, the route manifest, and each generated Markdown URL with the expected content type and status.
8. The `/4age/agents/` channel cards show the appropriate brand marks with persistent text labels, retain the accurate SMS/iMessage distinction, and remain legible with keyboard navigation and assistive technology.

## Out of scope

- Broad redesign or rewriting of BoardyAnimated's human-facing pages beyond the requested `/4age/agents/` channel-brand treatment.
- Publishing gated page body content in public mirrors.
- Generating UI actions, APIs, MCP tools, or other agent-operable capabilities.
- Adding routes from query variants, build tooling, experiments, or unmerged local work.
- Deploying to production as part of this implementation spec; verify generated behavior locally first and assess deployment authorization after review.
