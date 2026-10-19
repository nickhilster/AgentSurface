# Foundation Dogfood Run 2026-10-19

AgentSurface commit: `0b97e37` (`agentsurface-implementation`).

The two targets were exported from tracked Git snapshots into temporary directories. No
config, model, generated page, report, or build file was written to either source repo.

| Target | Source commit | Framework | Inspected routes | Capabilities |
|---|---|---|---:|---:|
| `teambotics-website` | `db7b08e` | Next.js App Router | 36 | 25 |
| `BoardyAnimated` | `1a0b273` | Vite 8 | 14 | 0 |

## Teambotics website

The first attempt used a dependency junction to the source repository's `node_modules`.
Turbopack rejected that junction because it pointed outside the temporary project root.
The check was repeated from a clean tracked snapshot with dependencies installed locally;
the local Next.js preview then served the selected routes successfully.

- `diff --server` proposed 13 Markdown pages and `llms.txt`, with no conflicts or
  unchecked page renders. It did not change files.
- `generate` wrote 13 Markdown pages plus `public/llms.txt`. Twenty-one routes were
  skipped for documented reasons: dynamic routes, non-public classifications, or no
  deterministic content boundary.
- `validate --server` reported 13 generated files and 13 discovery links checked. Route
  parity, discovery integrity, ownership, drift, and route reachability passed. Capability
  truthfulness remained unchecked because that check is not implemented.
- A second `diff --server` reported zero creates, updates, deletes, conflicts, or
  unchecked entries.
- Tier 1 `validate --no-drift-check --format json` passed route parity, discovery, and
  ownership for the 13 generated files and links. Drift and reachability were explicitly
  unchecked; capability truthfulness was unchecked.

## BoardyAnimated

The snapshot was installed with its locked pnpm dependencies, built, and served with Vite's
production preview.

- Inspection found 14 routes. Three static routes had a deterministic `<main>` boundary;
  the other routes remained interactive, human-gated, or without a source-derived
  boundary.
- The initial `diff --server` proposed three Markdown pages and `llms.txt`, with no
  conflicts or unchecked renders, and left the snapshot unchanged.
- `generate` wrote three Markdown pages plus `public/llms.txt`; it skipped 11 routes for
  the modeled reasons above.
- `validate --server` checked three generated files and three discovery links. Route
  parity, discovery integrity, ownership, drift, and route reachability passed. Capability
  truthfulness remained unchecked.
- A second `diff --server` reported zero changes. Tier 1 without a preview passed local
  route/discovery/ownership checks and marked drift, reachability, and capability
  truthfulness unchecked.

## CI workflow checks

The GitHub Actions YAML parsed locally. Policy fixtures confirmed that no-preview reports
with unchecked live checks pass Tier 1, preview content drift is informational by default,
and strict drift mode fails on drift. These are local workflow/policy checks; the GitHub
Actions workflow itself was not run on GitHub. Truth and safety failures remain job
failures in the workflow policy.

## Unchecked and remaining

- Capability truthfulness is not implemented and is never reported as a pass.
- No GitHub-hosted workflow run was performed.
- These targets do not provide an owner-confirmed live product catalog API, so catalog
  source binding and dynamic inventory remain untested here.
- No real agent host was exercised; a fake or local route check cannot prove in-app page
  handoff support.
- Source repos remained at their starting state. `BoardyAnimated` had pre-existing
  untracked `whatsapp/` directories and they were not used or changed.
