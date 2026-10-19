# Handoff Contract Dogfood Report — 2026-10-19

## Scope

This report covers the host-neutral AgentSurface handoff contract and its fake-adapter conformance suite. No real agentic application or desktop/mobile platform was selected for this run.

## Canonical destination

The contract accepts an exact HTTPS canonical item URL only when its hostname is owner-configured and its path matches an inspected public HTML route. It rejects credentials, query strings, fragments, non-default ports, unknown/private routes, and unapproved hosts. `resolve_item_page` returns a structured `pending` request for the selected entity; it does not navigate or claim a presentation outcome. Markdown alternates are not returned as the page destination.

## Host adapter conformance

The automated fake-adapter suite covers exact URL preservation, actual-surface reporting, unsupported fallback, context filtering, authentication denial, and rejection of an adapter that claims the wrong page. The suite uses a fake adapter and does not establish support in a real application.

## Real host and device outcomes

Not run. The owner has not named an agentic application or desktop/mobile platform, and no verified supported host extension point is available in this repository. Embedded viewing, external browser launch, redirects, CSP/auth behavior, and user prompts therefore remain unverified.

## Catalog source

No owner-confirmed live catalog source was configured for this run. This report does not establish live product availability or complete the end-to-end find-then-open dogfood milestone.

## Remaining work

- Select the target agentic application and desktop/mobile platforms.
- Verify its documented extension point for opening a canonical URL in its own environment.
- Select and authorize a catalog source for end-to-end dogfooding.
- Run real host and catalog flows, recording actual presentation, fallback, auth/CSP, and freshness outcomes.
