# Dogfood Run 2026-09-18

Target repo: teambotics-website (main site only — teambotics.app / www.teambotics.app; blog.teambotics.app's existing hand-built agent surface was left untouched)
Framework: Next.js 16.2.6, App Router
AgentSurface version/commit: v0.1, branch `feat/v0.1-engine-teambotics-dogfood`

## What worked

- Framework detection (next.config.ts + app/) at confidence 1.0.
- Route enumeration from the app/ directory tree, including route groups (`(site)`),
  dynamic segments (`[slug]`, `[lang]`), and nested trees (`BOSS/guide/*`, `poko/*`,
  `symphony/*`). 41 routes enumerated, matching a manual count against `find app -name
  page.tsx`.
- Config-redirect detection via static regex parsing of `next.config.ts` (no code
  execution) correctly resolved `/MdownManager` and `/RedactorBuddy` as external
  redirects rather than real content.
- Auth detection: `/admin/**` correctly classified `authenticated` at confidence 1.0,
  backed by a real password-check route (`app/api/admin/login/route.ts` +
  `lib/adminAuth`), not just a directory-name guess.
- Content-boundary resolution: walking the layout chain (page.tsx → layout.tsx →
  imported shell component) to find a `<main>` tag, rather than only scanning the page
  file itself. This is what correctly found the boundary for `/poko/**` (defined in
  `components/poko/PokoShell.tsx`, referenced from `app/poko/layout.tsx`) and correctly
  found *no* boundary for `BOSS/**` and `/nonprofit-application` — a real, verified
  absence, not a parser gap.
- Generation from real rendered HTML (fetched from a running `next start` instance),
  not from static-parsing JSX — genuinely necessary, see "False negatives avoided"
  below.
- Idempotence: running `generate` twice against unchanged source produced byte-identical
  output (verified via md5sum diff of every generated file).
- Drift detection: deliberately edited a real content sentence in
  `app/(site)/about/page.tsx`, rebuilt, restarted, and `validate --server <url>`
  correctly flagged exactly one failure (`[drift] /about`) and nothing else. Running
  `generate` again resolved it; `validate` returned clean. The source edit was then
  reverted and the repo rebuilt back to a clean state.
- Ownership safety: `generate` refuses to overwrite any file that doesn't carry
  AgentSurface's own header; `validate` separately checks every generated file still
  carries that header.
- Exclusion correctness, verified over real HTTP against a running server, not just
  by inspecting the model: `/admin/blog.md`, `/poko/admin/roadmap.md` → 404 (no leak of
  private content). `/BOSS.md`, `/nonprofit-application.md` → 404 (correctly deferred,
  not fabricated). A genuine typo URL still gets the site's normal 404 page (no
  regression from adding the catch-all).

## What required manual correction

- **False positive (fixed):** the adapter's first pass classified `/poko/admin/**` as
  `authenticated` at confidence 1.0, reusing the evidence for the unrelated top-level
  `/admin/**` password gate just because "admin" appeared as *some* path segment. Fixed
  by scoping the auth-check to `segments[0] === "admin"` specifically. Now correctly
  `private-internal` at confidence 0.7 (noindex-only evidence, no confirmed auth check
  found for that sub-tree). Covered by a regression test.
- **Modeling bug (fixed):** `RouteRecord.confidence` was a binary (1.0 unless fully
  "unknown") rather than reflecting the actual classification confidence. Fixed so
  `private-internal` routes correctly report 0.7, not 1.0.
- **False negative avoided by design change:** an early version only scanned the page
  file itself for a `<main>` tag. This would have wrongly deferred all of `/poko/**`
  (3 routes) as "no boundary found," when the boundary genuinely exists one layer up in
  a shared shell component. Fixed by resolving the layout → wrapper-component chain.
  Covered by a regression test.
- **Real Next.js routing collision (fixed):** the first implementation of the discovery
  route was a plain top-level catch-all (`app/[...slug]/route.ts`). This never actually
  matched single-segment `.md` requests (e.g. `/about.md`) because Next.js resolves the
  pre-existing `app/[lang]/page.tsx` single dynamic segment before falling back to a
  catch-all for a single path segment — `/about.md` was silently swallowed as
  `lang=about.md` and 404'd through the site's own not-found page instead of reaching
  the generator's handler. Fixed by having `middleware.ts` (which runs before route
  resolution) rewrite `*.md` requests into a dedicated internal path.
- **Next.js convention gotcha (fixed):** the dedicated internal path was first named
  `app/__agentsurface_md__/...`. Next.js treats any folder starting with `_` as a
  private, routing-excluded folder — the route silently never registered at all (no
  error, just absent from the build's route list). Renamed to `agentsurface-md`
  (no leading underscore).
- **False alarm, not a real bug:** mid-verification, several previously-passing curl
  checks (including a request for a static `public/llms.txt` file, unrelated to any of
  this session's logic) started returning 404. Traced to a stale `next start` process
  still bound to the test port from an earlier build. Killing the actual PID holding the
  port (not just pattern-matching on process name) resolved it. Recorded here because it
  cost real verification time and is worth remembering: always confirm which process
  owns a port before treating its behavior as a code bug.

## False positives

- `/poko/admin/**` misclassified as `authenticated` (see above; fixed, now regression-tested).
- Inspect's own "unknowns" reporting initially flagged `/MdownManager` and
  `/RedactorBuddy` as unresolved classification gaps, when they were actually fully
  resolved redirects (confidence 1.0) — an artifact of overloading the `"unknown"`
  classification value for "not applicable, this is a redirect." Fixed by excluding
  `contentType === "redirect"` from the unknowns check.

## False negatives

- The page-file-only content-boundary scan (see above; fixed).
- None found in generation or validation beyond the above — the dynamic-route
  deferral (`[slug]`, `[lang]`) is a known, declared limitation, not a false negative:
  the model correctly reports these as `dynamicSegments.length > 0` and `generate`
  correctly skips them with an explicit reason rather than guessing at content.

## Provenance gaps

- `BOSS/**` (8 routes) and `/nonprofit-application`: no deterministic content boundary
  found anywhere in the page-file or layout chain. Left as `contentBoundaryTag: null`
  and skipped by `generate` with an explicit reason. This is a real, honest gap, not a
  parser bug — these pages genuinely don't have a consistent wrapper tag AgentSurface
  can key off deterministically without either (a) a config-level per-route CSS
  selector override, or (b) a weaker heuristic (e.g. `<body>` minus header/footer) that
  risks pulling in navigation chrome and would need much more validation before it could
  be trusted.
- `/[lang]`, `/[lang]/products/[slug]`, `/products/[slug]`: dynamic routes deferred
  entirely. Mirroring these truthfully requires understanding the actual data/content
  source behind `generateStaticParams` (translations pipeline, product data file) —
  a real adapter capability this slice does not implement, not a shortcut taken.

## Ownership conflicts

None encountered. No pre-existing `AGENTS.md`/`llms.txt`/discovery files existed for
the main site (only the separate `blog/` Astro app has its own, untouched by this run).

## Validation failures

- The intentional drift-test failure described above (by design, then resolved).
- No other validation failures on the final state.

## Proposed spec changes

- `docs/SPEC.md`'s "Public agent-readable outputs" section should explicitly name
  "resolve the framework's actual layout/wrapper-composition chain, not just the leaf
  content file" as a requirement for any adapter's content-boundary detection — this
  was the single highest-value correction found in this run, and a page-only scan would
  have silently under-covered a real site by ~15%.
- Add a documented config field (not yet implemented) for a per-route content-boundary
  override, for repos like `BOSS/**` here that have no consistent wrapper — so an owner
  can supply one explicitly instead of AgentSurface either guessing or permanently
  excluding a whole product's pages.

## Proposed adapter changes

- The Next.js adapter should eventually understand `generateStaticParams` well enough
  to enumerate real dynamic-route values (e.g. actual product slugs, actual locales)
  instead of deferring the whole route. Deferred deliberately in this slice rather than
  guessed at.
- Discovery injection (`<link rel="alternate" type="text/markdown">` in the actual
  rendered `<head>`) was **not implemented this slice** — only `llms.txt` discovery
  was. Per-page alternate-link injection would require either editing each page's
  `export const metadata` object (an existing-file edit, more invasive) or a shared
  layout-level mechanism resolved per-route, which needs more design than this slice's
  scope. This is a known, declared gap, not a silent omission.
