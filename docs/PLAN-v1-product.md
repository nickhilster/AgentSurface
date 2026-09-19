# AgentSurface: v0.1 → Product Plan

Status: proposal. Revision 2 — audited against the v0.1 source tree, not only against
the design docs.

This plan is written to be executed phase by phase by a coding agent, the same way the
v0.1 slice was: real code, real builds, real dogfooding against real sites, honest
reporting of what breaks.

Per `OPERATE.md`'s source-of-truth order, nothing here overrides `OPERATE.md` or
`docs/SPEC.md`. Where this plan proposes a spec change it says so explicitly, and the
change still has to land in `docs/SPEC.md` before code may treat it as authoritative.

## Revision note (what changed from revision 1, and why)

Revision 1 was written from the design docs. Revision 2 was written after reading `src/`
line by line. That surfaced material corrections, recorded here rather than silently
folded in, per `OPERATE.md`'s handoff discipline:

1. **Revision 1 described an adapter interface that does not exist.** It stated that
   `FrameworkAdapter` currently has `inspectContent` and `discoveryInjectionPoints`. The
   implemented interface (`src/types/model.ts`) is `name`, `detect`, `inspectRoutes`,
   `inspectCapabilities?` — nothing else. Revision 1 was describing the sketch in
   `docs/ARCHITECTURE.md`, which `OPERATE.md` ranks *below* executable code. §2 is
   rewritten against the real interface.
2. **The proposed abstraction did not hold up.** `resolveCompositionChain()` returning
   `SourceFile[]`, with "the shared core owns walking the chain to find a content
   boundary," is not implementable: finding `<main>` inside a file means parsing that
   framework's file format (JSX, `.astro`, `.svelte`, `.vue`). Putting that in the core
   rebuilds in the core exactly what adapters exist to contain. §2.3 replaces it.
3. **The deepest lesson of the dogfood run was missing.** Two of the four real bugs (the
   `[lang]`/catch-all collision and the `_`-prefixed folder) produced *no error at all* —
   they were caught only by issuing real HTTP requests. Revision 1 proposed catching them
   with declarative adapter metadata. Declaration helps, but the evidence says
   declaration is not sufficient. §6.1 promotes runtime reachability verification to a
   required validator.
4. **An audit of v0.1's own generator found correctness debt that blocks adapter #2**,
   including a hardcoded site-specific claim and a missing ownership check. Revision 1
   treated the v0.1 code as uniformly sound. New §1 records what must be fixed first.
5. **Research claims are now cited, and one was materially overstated.** See §0.
6. **Gaps against the brief are filled**: MCP (§10) and an explicit "what this does not
   solve" (§11) were requested and were absent. Per-phase exit criteria (§12) were absent.
7. Dangling cross-references to nonexistent sections (`§4.4`, `§4.5`) and to an
   uncommitted research report (`§2.2 of the research report`) are removed. A plan handed
   to a coding agent must not cite documents that agent cannot open.

---

## 0. Research baseline

Claims are marked **[verified]** where checked against a primary or named source during
this revision, **[unverified]** where carried over from the first research pass and not
confirmed. An unverified claim must not be the sole justification for a phase.

### 0.1 llms.txt: adoption is wide, consumption is near zero **[verified]**

Ahrefs analysed ~137,000 domains: 28% publish an `llms.txt`, and of the ~38,000 with a
valid file, **97% received zero requests for it** in May 2026. Of the 3% that were
fetched, SEO audit tools were the largest single consumer at 21.7%; GPTBot 4.51%;
ClaudeBot 0.80%; AI retrieval bots in aggregate 1.1%.
([Ahrefs study](https://ahrefs.com/blog/llmstxt-study/),
[summary](https://www.searchenginejournal.com/97-of-llms-txt-files-got-no-requests-ahrefs-data-shows/579478/))

**Decision impact:** `llms.txt` emission must not be the project's headline value metric,
and engineering investment in it should stop at "correct and spec-conformant." The
differentiator is the provenance and validation layer.

### 0.2 The llms.txt spec is at **v2**, and v2 already specifies the `.md` convention **[verified]**

[llmstxt.org](https://llmstxt.org/) currently publishes "The /llms.txt file, v2,"
described as "updated based on what I learned from two years of adoption." Two things
matter here:

- The only **required** element is an H1 with the project/site name. Everything else —
  blockquote summary, content sections, H2-delimited file lists — is optional. File-list
  entries are `[name](url)`, then **optionally a `:` and notes**.
- v2 explicitly tells sites to provide a clean markdown version of each page at the same
  URL, either with `.md` appended (`page.html.md`) or with the extension replaced
  (`page.md`).

**Decision impact, and a correction to revision 1:** revision 1 attributed the
`.md`-suffix convention to Mintlify and proposed adopting it as an ecosystem courtesy. It
is in the spec. AgentSurface v0.1 **already implements it** — that is what the middleware
rewrite serving `/about.md` is. The project is already conformant with the
highest-leverage part of the current spec, which is a stronger and more accurate claim
than revision 1 made, and the README should say so.

`llms-full.txt` is **not** in the spec; it is a de-facto convention popularised chiefly by
Mintlify. Revision 1 recommended emitting it while also saying "strictly track the spec,
don't diverge" — a contradiction. §5.1 resolves it.

### 0.3 Network-layer access is a separate problem AgentSurface does not solve **[verified, with a correction]**

Revision 1 said "Cloudflare blocks AI crawlers by default on all new domains since
mid-2025." That is overstated. The verified scope is narrower: for **new domains
onboarding to Cloudflare and free-tier customers**, the **Training** and **Agent** crawler
categories are blocked by default **on ad-supported pages**, while **Search** remains
allowed by default.
([Cloudflare](https://blog.cloudflare.com/content-independence-day-ai-options/),
[Search Engine Land](https://searchengineland.com/cloudflare-to-block-ai-crawlers-by-default-with-new-pay-per-crawl-initiative-457708))
The precise effective date was not pinned during this revision.

**Decision impact:** unchanged in direction, sharper in wording. AgentSurface must not
claim to solve "agents can't read your site." The honest claim is narrower and still
valuable: *what agents do read is correct, current, and provably not fabricated.* §6.4
adds a read-only diagnostic; §11 states the limit plainly.

### 0.4 Competitors **[partially verified]**

- `next-llms-txt` exists on npm **[verified]** — a single-framework generator, generation
  only, no provenance, no drift validation.
- `agent-surface` is taken on npm; **`agentsurface` is free** **[verified]** — which is
  the name `package.json` already declares.
- The broader claim that *no* tool does source-derived-with-provenance generation for
  general application code is **[unverified]** — an absence-of-evidence result from a
  single research pass. Treat it as "none found," not "none exists," and do not build
  positioning that collapses if one is found. §8 is written to survive either way.

### 0.5 Prior art: durable standards were generated by default, not hand-authored **[unverified]**

That robots.txt / sitemap.xml / JSON-LD reached durable adoption largely because tooling
emitted them automatically (CMS and plugin defaults) rather than because authors hand-wrote
them is directionally consistent with §0.1 — a hand-authored file nobody regenerates is a
file that goes stale. Carried forward as a design bias (ship as a zero-config default;
make regeneration cheap), not as a load-bearing fact.

### 0.6 Framework introspection quality varies **[unverified, must be dogfood-tested]**

Documentation-based assessment only: Gatsby (GraphQL schema) and Astro (typed Content
Collections) expose real introspection APIs; Hugo/Jekyll/Eleventy expose none and may be
*harder* than Next.js; SvelteKit's file-routing model is a close cousin of Next.js App
Router and should reproduce the same *categories* of bug. None of this was verified by
attempting an adapter. §12 treats it as a hypothesis to test, not a settled ordering.

### 0.7 MCP **[verified]**

The current spec revision is **2026-07-28**, introducing a stateless protocol core,
header-based routing, cacheable list results, and authorization hardening.
([spec](https://modelcontextprotocol.io/specification/2026-07-28)) See §10.

---

## 1. Phase 0: correctness debt in the v0.1 engine

This section did not exist in revision 1. It comes from reading `src/` against
`OPERATE.md`'s non-negotiables. **These are not style issues.** Each either violates a
stated principle or produces a silent failure, and each will fire on the second target
repo — several of them specifically on the repos §8 names as the primary conversion
audience.

Fix these before generalizing the adapter layer. Generalizing on top of them multiplies
them across every adapter.

**Why these survived the dogfood run:** the test suite (19 tests, all passing) covers
exactly two files — `nextAppRouter.ts` and `htmlToMarkdown.ts`. `generate.ts`,
`validate.ts`, `inspect.ts`, `init.ts`, `config.ts` and the CLI have **no tests at all**.
Every defect below lives in an untested file. The v0.1 slice tested the parts where bugs
were *found by hand*, which is the right instinct under time pressure, but it means the
generation and validation layers — the two that produce the artifacts users trust — are
currently unverified by anything except one manual dogfood session. Phase 0 is as much
about closing that gap as about the individual fixes.

### 1.1 `generate` emits a hardcoded, site-specific claim

`src/commands/generate.ts` (`generateLlmsTxt`) unconditionally writes a "Structured data"
section containing a literal `/api/values` entry carried over from the dogfood target. On
any other repo that is a **fabricated claim about a route that does not exist** — a direct
violation of "Never invent routes, actions, APIs, entities, auth rules, or capabilities."
Nothing verifies the link resolves, so it also defeats the project's own
discovery-integrity guarantee.

**Fix:** derive that section from `CapabilityRecord`s in the model, or omit it when there
are none. No literal route strings for any specific site anywhere in `src/`.

### 1.2 `llms.txt` is written with no ownership check

Page generation carefully refuses to overwrite a file lacking AgentSurface's ownership
header. `generateLlmsTxt` does not: it calls `writeFileSync` on `public/llms.txt` with no
existence check, no ownership check, and no respect for `config.ownership.overwriteHumanOwned`.

This violates `OPERATE.md`'s "Human-owned files must not be overwritten without explicit
ownership rules" and `docs/SPEC.md`'s "Existing human-owned files must not be silently
overwritten." It did not fire during the dogfood run only because the target had no
pre-existing `llms.txt` — which the dogfood report records explicitly under "Ownership
conflicts: none encountered."

The severity is higher than it first looks: **§8's headline conversion audience is people
who already hand-rolled an `llms.txt`.** As written, AgentSurface destroys their file on
first run, while the pitch is "we keep yours from going stale."

**Fix:** route every generated artifact through one ownership-checked write path. No
generator calls `writeFileSync` directly.

### 1.3 Output paths and server defaults are Next.js-specific, inside framework-agnostic code

- `public/llms.txt` is hardcoded in the core generator. `config.output.dir` is declared in
  `src/types/config.ts` and **never read anywhere in `src/`** — a config field the tool
  advertises and silently ignores.
- `src/cli/index.ts` defaults `serverBaseUrl` to `http://localhost:3000` — a Next.js
  convention baked into the framework-agnostic CLI.

**Fix:** both become adapter-declared (§2.2: `outputConventions()`, `renderRecipe()`) and
config-overridable.

### 1.4 The drift validator silently passes on the failures that matter most

In `src/commands/validate.ts` the drift loop skips **without recording a failure** when:

- `!res.ok` → a route that now returns **404 or 500 passes validation**;
- `fragment === null` → the content boundary **disappeared** — passes;
- `fetch` throws → server unreachable — passes.

The states a maintainer most needs to hear about are exactly the states that report clean.
This is a false negative in the layer the entire product's trust claim rests on.

**Fix:** each becomes a distinct reported outcome. **"Could not check" must be a third
state alongside pass and fail**, never folded into pass. `ValidateResult` gains an
explicit `unchecked` list, and the CLI reports it prominently.

### 1.5 `validate` with no `--server` reports success having checked nothing

`serverBaseUrl` is optional; without it the whole drift section is skipped and `validate`
exits clean. A CI job wired the obvious way (`npx agentsurface validate`) is **guaranteed
green and guaranteed meaningless.** This directly undermines §6.

**Fix:** `validate` states which checks ran and which did not, and fails unless the
operator explicitly acknowledges running without drift checking.

### 1.6 `generate` with no running server succeeds while producing nothing

Every route lands in `skipped: fetch failed` and the command reports success. That is the
default experience for anyone who runs `npx agentsurface generate` without first building
and starting their site — the exact flow §7.5 promises.

**Fix:** distinguish "skipped for a modeled reason" (dynamic route, no boundary, not
public — legitimate, keep) from "skipped because infrastructure was missing" (fatal).

### 1.7 The generated `llms.txt` is not spec-conformant, and the validator depends on the divergence

Generated entries look like `- [label](/path) — Markdown: /path.md`. The v2 spec format
(§0.2) is `[name](url)` optionally followed by `:` and notes. Worse, `validate.ts` parses
discovery links with a regex keyed to `Markdown:` — so the validator can only validate
AgentSurface's own invented format, and would report a **spec-conformant** `llms.txt` as
having zero discovery links.

**Fix:** emit spec format, parse spec format, and add a fixture test using a hand-written
spec-conformant file AgentSurface did not generate.

### 1.8 The model has a literal version type and no migration path

`CanonicalSiteModel.version` is the literal type `"0.1"`, and `inspect` output is read back
by `generate`/`validate` via bare `JSON.parse` with no version check. §3's additive schema
changes will produce models that older binaries mis-read and newer binaries accept silently.

**Fix:** a version check at every model read, with an actionable "model was written by a
different AgentSurface version; re-run inspect" error. Land this *before* §3's schema
changes, not after.

### 1.9 Exit criteria for Phase 0

- No literal route/URL strings from any specific site remain in `src/` (grep-assertable).
- Every artifact written **into the target repo's own tree** goes through one
  ownership-checked write path — no direct `writeFileSync` for those. (Writes into
  `.agentsurface/`, which AgentSurface owns outright, are unaffected.) A test proves a
  pre-existing hand-authored `llms.txt` is preserved and reported as a conflict.
- `config.output.dir` is either honoured or removed; no advertised-but-ignored config.
- `validate` reports pass / fail / **unchecked** per check, and fixture tests prove that a
  404ing route and a vanished boundary each produce a failure rather than silence.
- `generate` exits non-zero when it produced nothing because infrastructure was missing.
- A spec-conformant `llms.txt` fixture AgentSurface did not generate validates correctly.
- A model version mismatch produces an actionable error, not a crash or a silent misread.
- `generate.ts` and `validate.ts` have real test coverage. Every defect in §1.1–§1.8 has a
  test that fails against today's code and passes after the fix — otherwise Phase 0 is
  asserting correctness the same way v0.1 did, by hand, once.

---

## 2. Adapter architecture

### 2.1 What the Next.js adapter's friction actually taught us

Four real bugs from the dogfood report generalize into four responsibilities the current
interface does not name. Restated precisely, because revision 1's framing of two of them
was wrong:

1. **A page's content boundary is a property of composition, not of the leaf file.**
   `/poko/**`'s boundary lived in a shared shell component one layer up. Astro layouts,
   SvelteKit `+layout.svelte` nesting, Nuxt layouts and Remix nested routes all have this
   shape.
2. **Classification evidence is scoped to a path segment and does not travel.**
   `/poko/admin/**` wrongly inherited `/admin/**`'s auth evidence because the check asked
   "does `admin` appear anywhere in this path."
3. **Routing precedence is framework-specific, and — the part revision 1 missed — is not
   reliably knowable from declaration alone.** Next.js resolved `[lang]` before a
   catch-all, so the generated handler silently never matched. No error was produced. The
   bug was found by `curl`.
4. **Naming conventions can make generated infrastructure invisible with no error.**
   `_`-prefixed folders are excluded from Next.js routing entirely. Also found by `curl`.

Bugs 3 and 4 share a property that shapes everything below: **they were undetectable
statically and produced no failure signal.** Any abstraction that addresses them only by
asking adapters to declare more metadata is addressing half the problem.

### 2.2 Proposed adapter contract (v0.2 target)

The current implemented interface is:

```ts
interface FrameworkAdapter {
  readonly name: string;
  detect(repo: RepoContext): Promise<DetectionResult>;
  inspectRoutes(repo: RepoContext): Promise<RouteRecord[]>;
  inspectCapabilities?(repo: RepoContext): Promise<CapabilityRecord[]>;
}
```

`inspectRoutes` is a god-method: it enumerates routes, parses config redirects, detects
auth, reads `noindex`, resolves the content boundary, **and assigns the final
classification and confidence**. All of the dogfood bugs live inside it. Splitting it is
the actual win — and the governing principle for the split is:

> **The adapter answers questions about its framework. The core owns all policy, all
> classification arithmetic, and all verification against reality.**

v0.1 violates this: the adapter decides `classification` and `confidence` directly. That
is policy in the adapter, and it is why bug 2 was possible.

```ts
interface FrameworkAdapter {
  readonly name: string;
  /** Declared, not discovered: what this adapter can and cannot do. Core degrades gracefully. */
  readonly supports: AdapterSupportMatrix;

  detect(repo: RepoContext): Promise<DetectionResult>;

  /** 1. Enumeration only. No classification, no boundary resolution. */
  enumerateRoutes(repo: RepoContext): Promise<RouteCandidate[]>;

  /** 2. Evidence, not verdicts. Each record carries the exact path scope it derives from. */
  collectClassificationEvidence(
    repo: RepoContext, route: RouteCandidate
  ): Promise<ClassificationEvidence[]>;

  /** 3. A DOM selector plus the evidence chain that justifies it. The adapter parses its
   *  own file formats; the core never does. */
  resolveContentBoundary(
    repo: RepoContext, route: RouteCandidate
  ): Promise<ContentBoundary | null>;

  /** 4. "If a request came in for this path, what would actually handle it?" — a query,
   *  not a rule table. This is the catch-all/[lang] collision, asked directly. */
  resolveRequestPath(repo: RepoContext, path: string): Promise<PathResolution>;

  /** 5. Paths that are invisible by framework convention. */
  reservedNamingRules(): ReservedNamingRule[];

  /** 6. How to produce rendered HTML for this repo. Generation is render-based (§4.1),
   *  so this must be declared rather than assumed (today: hardcoded localhost:3000). */
  renderRecipe(repo: RepoContext): RenderRecipe;

  /** 7. Where static artifacts belong: public/, static/, dist/, ... */
  outputConventions(repo: RepoContext): OutputConventions;

  inspectCapabilities?(repo: RepoContext): Promise<CapabilityRecord[]>;
  discoveryInjectionPoints?(repo: RepoContext): Promise<InjectionPoint[]>;
}
```

Two supporting types carry most of the design weight:

```ts
interface ClassificationEvidence {
  claim: string;                  // "authenticated", "noindex", "redirect", ...
  /** The exact route-path segments this evidence was derived from. The core refuses to
   *  apply evidence whose scope is not a prefix of the route being classified. */
  scope: string[];
  source: string;
  method: InspectionMethod;
  confidence: Confidence;
}

interface ContentBoundary {
  /** A DOM selector, verifiable against rendered HTML by the core with no framework knowledge. */
  selector: string;
  /** Why the adapter believes this. Must be non-empty; the core rejects unjustified boundaries. */
  evidence: ProvenanceRecord[];
  confidence: Confidence;
}
```

### 2.3 Does this abstraction actually hold against the four real bugs?

That is the test this plan is required to pass, so it is answered bug by bug — including
where revision 1's answer fails.

| Dogfood bug | Revision 1's answer | Why it fails | Revision 2 |
|---|---|---|---|
| Boundary in a shell component | `resolveCompositionChain()` returns files; **core** walks them to find the boundary | The core would have to parse JSX, `.astro`, `.svelte`, `.vue` to find `<main>` in those files. That is per-framework parsing in the core — the exact thing adapters exist to prevent. The abstraction inverts the boundary it is meant to defend. | `resolveContentBoundary()` returns a **selector plus evidence**. The adapter parses its own formats (it already does). The core owns two genuinely framework-agnostic jobs: reject a boundary with no evidence, and **verify the selector matches exactly one node in real rendered HTML**. The composition chain becomes an adapter implementation detail that shows up in the model as provenance. |
| `/poko/admin` false auth | "Not an interface change — a modeling discipline, kept correct by a regression test" | A discipline enforced by one regression test in one adapter does not survive adapter #3 written by someone who never read this plan. | `ClassificationEvidence.scope` makes it **structurally unrepresentable**: evidence physically carries its originating segments, and the core applies it only on a prefix match. The adapter cannot express "this evidence applies everywhere" by accident. This is a real improvement over revision 1's conclusion. |
| catch-all vs `[lang]` collision | `routingPrecedence(): RoutingPrecedenceRule[]`, e.g. `{ kind: "catch-all-yields-to-dynamic-segment" }` | An enum of opaque `kind` strings gives the core nothing to execute — the core would need an implementation per kind, i.e. framework knowledge back in the core. And the bug was invisible statically; a declared rule that is subtly wrong reproduces it exactly. | `resolveRequestPath()` asks the adapter the question directly, **plus** §6.1's mandatory runtime reachability check. Static answer for planning, real HTTP request for proof. |
| `_`-prefixed folder invisible | `reservedNamingRules()` | Correct — keep it. | Kept, **plus** the same runtime check as a backstop, since this bug's signature was "silently absent from the build with no error." |

The honest conclusion: **declarative adapter metadata solves two of the four bugs; the
other two are only closed by verifying against a running site.** An adapter contract that
does not force that verification has not learned what the dogfood run taught. That is why
§6.1 is a required validator and not a nice-to-have.

### 2.4 What "adding an adapter" becomes

A bounded checklist, each step independently testable before wiring into
`generate`/`validate`:

1. `detect()` — framework fingerprint.
2. `enumerateRoutes()` — prefer the framework's own introspection surface (Astro's
   `getCollection`, Gatsby's GraphQL schema) over hand-parsing files; fall back to
   file-convention parsing only where no such surface exists.
3. `collectClassificationEvidence()` — evidence only. If the adapter finds itself wanting
   to return a verdict, that is a signal the core's policy layer is missing a rule.
4. `resolveContentBoundary()` — tested against at least one real nested-layout case in
   that framework's dogfood target.
5. `resolveRequestPath()` + `reservedNamingRules()` — reviewed against the framework's own
   routing documentation, then **proven by the §6.1 reachability run**, not by reading docs
   alone.
6. `renderRecipe()` + `outputConventions()` — declared.
7. Dogfood against one real site, produce a report using the `docs/DOGFOODING.md`
   template, and feed new friction back into this contract before calling the adapter
   supported.

A core-owned conformance suite should run steps 2–5 against any adapter generically, so
adapter authors inherit the accumulated lessons instead of rediscovering them.

---

## 3. Canonical Site Model: does it generalize?

Mostly yes. Three additive changes, one open question, and one thing revision 1 missed
entirely.

### 3.1 Additive changes

- **Provenance source becomes a discriminated union.** Gatsby-style content has no single
  justifying file path; its provenance is a query resolved against a schema, potentially
  spanning several source plugins. Replace `source: string` with
  `{ kind: "file"; path: string } | { kind: "query"; schema: string; query: string; resolvedAgainst: string[] }`.
  Additive; existing file-based records are unaffected. Land in `docs/SPEC.md` before a
  Gatsby adapter is attempted, not mid-implementation.
- **`ClassificationEvidence.scope`** (§2.2) becomes part of the model, not just the
  adapter interface — a classification's provenance must record which path segments
  justified it.
- **`ContentBoundary` replaces `contentBoundaryTag: string | null`.** A bare tag name
  cannot express "the second `<main>`", scoped selectors, or the evidence chain. The
  `null` case — a genuinely absent boundary, as with `BOSS/**` — stays first-class and
  must not be "fixed" by guessing.

### 3.2 The gap revision 1 missed: one repo is not one site

The dogfood target contains a **second application** — `blog/`, a separate Astro app on a
different subdomain, with its own hand-built agent surface — which was excluded by hand
during the run. The model has no way to express this. `SiteInfo` is singular, with a flat
`hostnames: string[]`, and `RepoContext.excludeDirs` is the only tool available.

This is not an edge case. Monorepos, `apps/*` layouts, docs-site-beside-marketing-site,
and a Next.js app with an Astro blog are all ordinary. And the target that produced the
project's only dogfood report is *already* one of them.

**Proposed:** the CSM gains a top-level `apps: AppRecord[]`, each with its own root
directory, detected framework/adapter, hostname set, and route list; the current
single-site shape becomes the one-app case. Decide this before the second adapter, because
"two frameworks in one repo" is where a multi-adapter tool earns its keep — and it is
directly testable against the repo already in hand.

### 3.3 Where the model stays strict

Unchanged: source-derived over inferred, unknowns first-class, confidence scoring, no
operable capability from copy alone. Nothing in the research argues for loosening any of
it; §0.1 and §8 argue it is the whole differentiator.

### 3.4 Where it needs more expressiveness

The per-route content-boundary override already flagged as proposed-but-unimplemented in
the dogfood report (`BOSS/**` has no consistent wrapper). Implement in v0.2 as a config
field carrying an explicit owner-supplied selector, recorded in provenance with
`method: "owner-declared"` and a confidence the owner cannot set to 1.0 — an override is
a human assertion, not a source-derived fact, and the model should not let it masquerade
as one.

### 3.5 Versioning

Per §1.8, model versioning and a read-time compatibility check must land before any of
§3.1. Additive-but-unchecked schema evolution is how a machine-readable source of truth
quietly becomes untrustworthy.

---

## 4. Generation quality

### 4.1 Name the architectural constraint first

Generation is **render-based**: `generate` fetches real rendered HTML from a running
instance. This is a genuinely good decision — the dogfood report shows static JSX parsing
would have produced false negatives — but revision 1 never stated it as a constraint, and
it propagates into CI (§6.3) and onboarding (§7.5):

- `generate` cannot run on a clean checkout. It needs a build and a running server.
- Today this is hidden behind a hardcoded `http://localhost:3000` default and silent
  per-route skips (§1.3, §1.6).

**Decision required in v0.2, not deferred:** keep render-based generation as the primary
path, make its prerequisite explicit and adapter-declared (`renderRecipe()`), and evaluate
a second source — reading a framework's **static build output** (`out/`, `dist/`,
`_site/`) — for frameworks that produce one. A build-output mode removes the running-server
requirement for a large class of sites and makes §6.3 dramatically cheaper. Whether it is
worth the second code path is an open question (§13), but the current implicit dependency
must stop being implicit either way.

### 4.2 Don't reinvent HTML→Markdown

`src/lib/htmlToMarkdown.ts` is ~100 lines of regex over HTML, explicitly documented as a
deliberately simple v0.1 pass with no link or image preservation. It should not be
extended further.

Use [Turndown](https://www.npmjs.com/package/turndown) (7.2.4, published 2026-04-03 —
actively maintained **[verified]**) with a custom rule set, or a `unified`/`rehype-remark`
pipeline if a real AST is wanted for §4.4. Turndown is the smaller step and closes the
documented link/image limitation directly.

Note one real regression risk in swapping: `extractContentBoundary` currently does
depth-tracked tag matching by regex and returns `null` on malformed HTML rather than
guessing. Whatever replaces it must preserve that "bail out rather than fabricate"
behaviour, and the existing tests are the contract to satisfy.

### 4.3 Keep readability extraction as a fallback, never the mechanism

Crawl-based tools must use readability heuristics because the rendered DOM is all they
have. AgentSurface knows the true boundary from source. A readability pass is legitimate
only *inside* an already-confirmed boundary that still contains obvious chrome — never as
the boundary-finding mechanism. Keep the distinction explicit in code and docs, or the
project quietly becomes a crawler with extra steps and loses the argument in §8.

### 4.4 Provenance through the conversion step

Each generated Markdown block should be traceable to the source DOM node it came from.
This is what makes §6.2's sub-page drift reporting possible ("this paragraph changed")
rather than today's page-level signal. It is the main argument for an AST pipeline over
string rewriting.

### 4.5 Links

Internal links should resolve to the generated `.md` alternate of the target route where
one exists. Per §0.2 this is the **spec's** convention, not a borrowed one. Where no
alternate exists, link to the HTML URL and do not imply one exists.

---

## 5. Discovery standards

### 5.1 llms.txt: conform to v2 exactly; stop there

Given §0.1, `llms.txt` should be a cheap, correct, spec-conformant output and nothing
more. Concretely, for v0.2:

- **Fix conformance and the validator's dependence on the divergence (§1.7).** This is the
  priority; everything else here is optional.
- **Verify against the v2 changes page** before implementing — revision 1 was written
  without noticing v2 exists, so no assumption about the format should be carried forward
  unchecked.
- **`llms-full.txt`: opt-in, and labelled honestly.** It is not in the spec (§0.2). It is
  cheap given the alternates already exist and genuinely serves one-shot RAG-style
  consumers, but emitting a non-spec file by default contradicts "track the spec." Ship it
  behind config, documented as a de-facto convention.

### 5.2 Per-page discovery: prefer the `Link` header, keep expectations low

`rel="alternate"` injection was deferred in v0.1 as too invasive — it would have meant
editing each page's `metadata` export. Given §0.1 (bots do essentially no unprompted
discovery), its marginal value over `llms.txt` today is probably small.

Proposed for v0.3, scoped to avoid the invasiveness that caused the original deferral:

- Emit `Link: </about.md>; rel="alternate"; type="text/markdown"` as an **HTTP response
  header** via the same middleware layer that already intercepts `.md` requests. RFC 8288
  makes this a standards-compliant equivalent to a `<link>` tag, it touches no human-owned
  page source, and it reuses infrastructure already proven in the dogfood run.
- Treat in-`<head>` `<link>` injection as an **opt-in, adapter-specific** capability for
  frameworks with a single low-risk edit point, never a required feature. Otherwise every
  future adapter inherits the "safely edit every page's metadata" problem the Next.js
  adapter correctly declined to solve.

Whether any agent consumes either form is unverified (§13). Treat as a low-cost bet.

### 5.3 Don't invent a new discovery format

Given §0.5's adoption lesson and §0.1's consumption data, the failure mode to avoid is
publishing a better-designed format nobody reads. AgentSurface's leverage is being the
thing that keeps the *existing* formats true, not adding a fifth one.

---

## 6. Validation depth

Current state: local-only console output covering route parity, drift, discovery
integrity and ownership safety — real, and proven against a real drift scenario — but with
the silent-pass defects in §1.4/§1.5, no machine-readable output, and no CI story.

### 6.1 Runtime reachability verification (new, and the highest-value addition)

**The single most important lesson of the dogfood run is that two of four real bugs were
invisible to static analysis and produced no error.** The dogfood report also records that
exclusion correctness was confirmed "over real HTTP against a running server, not just by
inspecting the model" — by hand, with `curl`.

That manual step should be a first-class validator. After `generate`, against a running
instance, assert:

1. Every `.md` alternate advertised in `llms.txt` returns **200** and its body matches the
   generated file.
2. Every route classified non-public has **no** reachable alternate (expect 404) — this is
   the check that caught `/admin/blog.md` and `/poko/admin/roadmap.md` leaking.
3. Every route deliberately skipped (no boundary, dynamic) returns **404** at its `.md`
   path rather than something fabricated.
4. A known-nonexistent path still reaches the site's own 404 handling — i.e. AgentSurface's
   discovery mechanism did not swallow the site's routing.

Checks 1 and 4 together are precisely the `[lang]`/catch-all collision and the
`_`-prefix bug. Both become automatic, per-adapter, and permanent. This is the mechanism
that stops adapter #3 from rediscovering them.

### 6.2 Structured output (prerequisite for everything in §6.3)

Emit `.agentsurface/validate-report.json`, one record per check:
`{ check, subject, status: "pass" | "fail" | "unchecked", detail, confidence }`. The
`unchecked` state is mandatory per §1.4 — a report that cannot distinguish "verified
correct" from "could not verify" is not a trust artifact.

### 6.3 CI integration — and the render problem it has to solve

Revision 1 proposed a GitHub Action running `inspect` + `generate --check` + `validate` on
every PR. It did not address the blocker: **content fidelity requires a running instance
of the site** (§4.1). A CI job must therefore build and serve the target app — expensive,
framework-specific, and sometimes impossible without production secrets.

Resolve it explicitly rather than discovering it during implementation:

- **Tier 1 (no server, runs everywhere):** route parity, discovery integrity, ownership
  safety, model-vs-source staleness. Cheap, safe to run on every PR, and enough to catch
  most real drift, since route and classification changes originate in source.
- **Tier 2 (needs a rendered site):** content fidelity and §6.1 reachability. Run where
  the repo already has a build/preview step — a deploy preview URL is the natural input,
  and `validate --server <preview-url>` already supports it. Where a preview exists, Tier 2
  is nearly free; where it doesn't, it is opt-in.

This split is what makes CI integration buildable rather than aspirational, and it should
shape the Action's design from the start.

Failure policy, consistent with `docs/SPEC.md`'s "CI should make drift visible, not
regenerate and silently commit": fail on route parity, discovery integrity and
ownership-safety violations; **report** content drift as a PR comment rather than blocking,
unless the repo opts into strict mode. `generate --check` must never write in CI.

### 6.4 Bot-access diagnostic

A clearly-labelled informational check (never pass/fail, since AgentSurface cannot fix it):
report robots.txt posture and known AI-crawler blocks, e.g. "this site currently disallows
ClaudeBot; generated outputs may not be reachable by that agent." Useful context; not a
claim to have solved §0.3.

### 6.5 Capability truthfulness

The `capability-truthfulness` check exists in the `ValidationFailure` union but is never
emitted. Either implement it — assert every `CapabilityRecord` has a resolvable
`backingImplementation` and that no record is `kind: "operable"` without one — or remove it
from the type. A declared-but-unimplemented check in a trust product is worse than no check.

---

## 7. Product packaging and distribution

### 7.1 npm package

Publish as `agentsurface` (**available [verified]**, already declared in `package.json`),
runnable as `npx agentsurface`. Table stakes, and a prerequisite for the Action.

### 7.2 Library extraction — do it early, while it is small

Split `src/` into a `core` (CSM types, inspect/generate/validate engine, adapter contract)
importable independently of the CLI, so the CLI, the GitHub Action and any future hosted
layer share one implementation. Do it now, at ~1,400 lines and one adapter, not later.

### 7.3 GitHub Action

Ship `agentsurface/validate-action` wrapping §6.3's two tiers, defaulting to Tier 1 with
Tier 2 enabled by supplying a preview URL. Depends on §6.2.

### 7.4 Hosted layer: defer, with a stated precondition

Not before the CLI and Action have real external (non-Teambotics) usage. The reasoning is
structural, not schedule-based: AgentSurface's differentiation requires **source access**.
A hosted service with only crawl access to a deployed site degrades into the category
§8 argues against. A hosted layer therefore only makes sense as "a GitHub App with repo
access running the same core" — which is the Action, hosted and managed, not a different
product. If pursued, reuse the §7.2 core; do not fork it.

### 7.5 Zero-context install — and what currently blocks it

The goal: `npx agentsurface init && npx agentsurface inspect && npx agentsurface generate`
produces a model, alternates for confidently-classified public routes, and a conformant
`llms.txt`, with no config file for the default case.

**This is not currently achievable**, and revision 1 asserted it as if it were. `generate`
requires a running server it does not start, defaults to a Next.js port, and reports
success while producing nothing when nothing is there (§1.6). Closing this needs, at
minimum: `renderRecipe()` so the CLI can tell the user exactly what to run (or start it
itself), a fatal error instead of silent success, and §4.1's build-output mode for
frameworks where it applies.

The five-doc reading list is right for a contributor. It must never be a prerequisite for a
first-time user getting value.

---

## 8. Value proposition, stated so it survives contact with a competitor

**For agents:** content and route information that is correct, current, and carries a path
back to the source that justified it — without needing to render JS, guess at boilerplate,
or act on a claim nobody checked.

**For the human maintainer**, against each real alternative:

- **vs. doing nothing.** Agents and AI answer engines already read your site, badly —
  through JS-blind crawlers, readability guessing, or not at all. Doing nothing doesn't
  avoid that outcome; it only removes your say in it.
- **vs. hand-rolling an `llms.txt`.** A hand-authored file goes stale the moment the site
  changes, and nothing tells you. AgentSurface's `validate` catches that automatically.
  **This is the strongest claim the project has, because it is already demonstrated**: the
  dogfood run edited a real sentence in a real page, `validate` flagged exactly one drift
  failure and nothing else, `generate` resolved it, `validate` went clean. Lead with that
  reproducible before/after. (Note the dependency: §1.2 must be fixed first, or the tool
  destroys the file of every user in this exact segment on first run.)
- **vs. Firecrawl / Mintlify's standalone generator / generic llms.txt generators.** They
  read rendered output and cannot distinguish authoritative content from chrome, marketing
  copy, or a stale cache — and they have no way to notice when their output stops matching
  the site, because they never captured what "matching" would mean. AgentSurface reads the
  source, so every claim carries provenance and a source change can be checked
  mechanically. State this as a structural difference, not a feature count.
- **vs. `next-llms-txt` and other single-framework generators.** Same category of gap:
  generation without provenance or drift validation. Where directly comparable, claim
  exactly that and no more.

**Positioning discipline:** the "nobody else does source-derived-with-provenance" claim is
unverified (§0.4). The argument above does not depend on it — it compares against named
tools on a named axis (provenance and drift detection). Keep it that way.

---

## 9. Migration path: what happens to the existing v0.1 code

| Artifact | Disposition | Why |
|---|---|---|
| CSM types (`src/types/model.ts`, `config.ts`) | **Keep, extend** | Additive changes per §3 (provenance union, `ClassificationEvidence.scope`, `ContentBoundary`, `apps[]`), plus §1.8 versioning first. |
| Next.js adapter (`src/adapters/nextAppRouter.ts`) | **Refactor onto the new contract; keep every fixed-bug behaviour; move classification policy out** | The four fixes become `collectClassificationEvidence` / `resolveContentBoundary` / `resolveRequestPath` / `reservedNamingRules`. One genuine behavioural change, not just reshaping: the adapter must stop assigning `classification` and `confidence` (§2.2) and return evidence instead. |
| Content-boundary walker (`findContentBoundaryTag` et al.) | **Keep the logic, relocate it** | This is the single highest-value piece of code in the repo and the fix for the worst false negative found. It becomes the Next.js implementation of `resolveContentBoundary()`, returning a selector plus its evidence chain instead of a bare tag name. |
| Adapter tests (`nextAppRouter.test.ts`) | **Keep, extend** | Already cover the two bugs they were written for. Extend to the new methods directly, and add the core conformance suite (§2.4). |
| `htmlToMarkdown.ts` + test | **Replace internals with Turndown (§4.2); keep the module boundary and tests as the contract** | Documented as a deliberately simple v0.1 pass. Preserve the "return null rather than fabricate a boundary" behaviour. |
| `generateLlmsTxt` (inside `generate.ts`) | **Rebuild** | The one piece that is genuinely throwaway: hardcoded site-specific content (§1.1), no ownership check (§1.2), hardcoded output path (§1.3), non-spec format (§1.7). Four principle violations in ~35 lines. |
| `validate.ts` | **Keep structure, fix silent passes (§1.4/§1.5), add structured output (§6.2) and reachability (§6.1)** | The checks are right; the reporting of "could not check" is wrong. |
| `generate.ts` / `inspect.ts` / `init.ts` / CLI | **Keep as thin wrappers; extract core per §7.2** | Logic is sound apart from the items above; the change is packaging. |
| Dogfood report | **Keep permanently, unmodified** | It is the evidentiary basis for §2's design and §8's strongest claim. Do not polish it in hindsight. Add new dated reports alongside it. |
| `docs/SPEC.md` | **Amend, don't replace** | Composition-chain requirement, provenance union, evidence scoping, per-route boundary override, multi-app model, "unchecked" as a validation state. |
| `docs/ARCHITECTURE.md` | **Correct it** | Its `FrameworkAdapter` sketch does not match the implemented interface, which is what misled revision 1. Either align it or mark it explicitly as aspirational. |
| `ROADMAP.md` | **Keep v0.1 history; supersede v0.2/v0.3 with §12** | Don't rewrite accurate history. |

---

## 10. MCP and the readable/operable boundary

Requested in the brief and absent from revision 1 beyond dangling pointers. The position:

**Nothing in this plan brings MCP forward.** `OPERATE.md` requires explicit owner
direction before "adding an agent-operable action layer that could cause external side
effects," and the readable surface is not yet stable across two frameworks. The ordering
in `ROADMAP.md` — operability only after readable/discovery surfaces are stable — is
correct and this plan does not alter it.

What is worth recording now, so the option stays open:

- **Asymmetric risk.** A wrong readable claim misinforms an agent. A wrong operable tool
  manifest causes a real-world action. The evidence bar for `kind: "operable"` must be
  categorically higher, and §6.5's unimplemented capability-truthfulness check is the
  first place that bar gets enforced.
- **The only defensible source is a machine-checkable contract** — an OpenAPI document, a
  typed RPC schema — never route-file inspection and never UI copy. v0.1's
  `inspectCapabilities` correctly marks every discovered API route `kind: "readable"` with
  a comment explaining why. That restraint is right; keep it.
- **If pursued, generate a manifest, do not become a server.** Emitting an MCP tool
  manifest derived from a verified backing contract is consistent with the project's
  model-agnostic stance. Running a hosted MCP server is a different product with a
  different security posture.
- **Track the 2026-07-28 revision** (§0.7) for its authorization hardening if and when this
  becomes real.

Precondition before any implementation: a real dogfood target that has a genuine
machine-checkable API contract, so the work is evidence-driven rather than speculative.

---

## 11. What AgentSurface does not solve

Stated explicitly so the README never overclaims, and so a coding agent doesn't build
toward these by accident.

- **Network-level access.** If a site blocks AI crawlers at the edge (§0.3), perfectly
  generated alternates are perfectly unreachable. AgentSurface can report this (§6.4) and
  nothing more.
- **Consumption.** Per §0.1, publishing a correct `llms.txt` does not mean anything reads
  it. The project's value has to rest on correctness of what *is* read, not on volume.
- **Sites whose content isn't in the repo.** A CMS-backed site's copy lives in a database.
  AgentSurface can model routes and structure, but "source-derived" degrades toward
  "render-derived" for the content itself — which narrows the gap with crawl-based tools
  for exactly that class of site. Worth being honest about rather than papering over.
- **Dynamic routes, still.** `[slug]`, `[lang]` remain deferred. Enumerating them truthfully
  requires understanding the data source behind `generateStaticParams` — real adapter work,
  not yet done.
- **Pages with no deterministic boundary.** `BOSS/**` remains excluded until an owner
  supplies a selector (§3.4). Correct behaviour, but it means coverage is a function of how
  consistently the target site is built.
- **Agent behaviour.** Nothing here makes an agent read the alternate rather than the HTML.

---

## 12. Phasing and exit criteria

Dependency order matters more than the labels. `→` means "blocks."

```
Phase 0 (correctness) → Phase 1 (adapter contract) → Phase 2 (second adapter)
Phase 0 → structured validation (§6.2) → CI Action (§7.3)
Phase 1 → library extraction (§7.2) → npm publish (§7.1)
```

**Phase 0 — correctness debt (§1).** No new capability. Exit criteria in §1.9.

**Phase 1 — adapter contract + model (v0.2).** Reordered after the Phase 0 review cycle
(see "Phase 1 reordering note" below): **structured validation report (§6.2) and the
runtime reachability validator (§6.1) land first**, ahead of the adapter contract work —
then new contract (§2.2), Next.js adapter refactored onto it, model changes (§3.1, §3.5)
with the multi-app decision made (§3.2), per-route boundary override (§3.4), Turndown
swap with links and images preserved (§4.2), library extraction and npm publish
(§7.1–7.2).

§6.1's acceptance cases must include, at minimum:
1. every `.md` alternate advertised in `llms.txt` returns 200 and matches the generated
   file (catches a dead/unwritten alternate — the failure mode this review cycle's item 5
   named: `generate` against a partially-reachable server produces partial output with no
   error, and an `llms.txt` advertising alternates that were never written);
2. every route classified non-public has no reachable alternate;
3. every deliberately-skipped route (no boundary, dynamic) 404s at its `.md` path rather
   than fabricating one;
4. a known-nonexistent path still reaches the site's own 404 handling.
Item 5 is not patched separately in `generate` — it is this validator's first acceptance
case, so the check is written once rather than twice.

*Exit:* the reachability validator reproduces the two HTTP-only bugs from the original
dogfood report (the `[lang]`/catch-all collision, the `_`-prefixed folder) as automated
test failures when deliberately reintroduced, and separately catches a deliberately
unwritten-but-advertised alternate (item 5's case); the Next.js adapter passes the core
conformance suite; `npx agentsurface` works end-to-end on a fresh clone of the dogfood
target with no repo-local code; re-running the original dogfood produces the same model
modulo the schema additions.

### Phase 1 reordering note (post Phase-0-review)

The original ordering put §6.1 in the middle of Phase 1's item list. A review of the
Phase 0 commits found three defects in one function (`generateLlmsTxt`) across two review
cycles — a dead link, a leaked private-capability record, and a leaked mutating-endpoint
record — and all three share one shape: **a generated artifact claimed something that did
not hold when an agent would actually have requested it.** That is precisely what §6.1
checks for, mechanically, on every future adapter. Doing the adapter-contract refactor
(§2.2) before that validator exists means the refactor lands against a fixture suite that
has already been shown, twice, to pass while real output was wrong. Doing it after means
the refactor lands against a net. §6.1 now leads Phase 1.

**Phase 2 — second adapter (v0.3).** **Astro** first (§0.6), chosen because its typed
Content Collections exercise `enumerateRoutes()`'s introspection path rather than
file-parsing, and because the dogfood target already contains an Astro app (§3.2) — the
multi-app model and the second adapter can be tested on one repo already in hand. GitHub
Action (§7.3) with §6.3's tiering. Spec-conformant `llms.txt` plus opt-in `llms-full.txt`
(§5.1). `Link`-header alternates (§5.2).
*Exit:* a dogfood report for the Astro target using the existing template, listing what
broke; any adapter-contract change that report forces is made *before* Phase 3; the Action
runs Tier 1 on a real PR and Tier 2 against a preview URL.

**Phase 3 — third adapter and hardening (v0.4).** **SvelteKit**, chosen specifically
because it should stress the same bug categories (§0.6) — if the contract holds there, it
is generalizing; if it doesn't, the contract is wrong and Phase 1 gets revisited rather
than patched around. Bot-access diagnostic (§6.4). Capability truthfulness (§6.5).
*Exit:* a SvelteKit adapter written against the contract without changing it — or a
written account of exactly which part had to change and why.

**Still deferred, unchanged:** agentification scores, autonomous deployment, automatic
exposure of authenticated/private routes, vendor-specific core dependencies, MCP
generation (§10), hosted layer until §7.4's precondition is met.

---

## 13. Open uncertainties

Flagged rather than resolved, per `OPERATE.md`'s "unknown is a valid state."

- **Whether any agent consumes `rel="alternate"` in either form** (§5.2) is unverified in
  both directions. No evidence was found of consumption *or* of non-consumption for this
  specific use. A low-cost bet, not a proven win.
- **Whether Astro or Gatsby is genuinely the easier second adapter** (§0.6) is
  documentation-based, not tested. Phase 2's ordering is a hypothesis; if Astro's
  introspection turns out not to reduce adapter effort, that is a finding worth reporting,
  not a failure to hide.
- **Whether a static-build-output generation mode is worth a second code path** (§4.1).
  It would remove the running-server requirement for many sites and make CI far cheaper,
  but it re-introduces a class of framework-specific output-layout knowledge. Decide with
  the Astro adapter in hand, when there are two data points.
- **Whether the "no competitor does this" claim holds** (§0.4). One research pass found
  none. §8 is deliberately written not to depend on it.
- **How the multi-app model (§3.2) interacts with per-app adapters and a single
  `llms.txt`.** One repo, two frameworks, two hostnames — does that produce one discovery
  surface or two? Unresolved; the dogfood target can answer it empirically.
- **Whether render-based generation is viable for CMS-backed sites at all** (§11), or
  whether that class of site needs a different source strategy entirely.
