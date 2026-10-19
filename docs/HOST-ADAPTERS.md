# Host Adapter Contract

AgentSurface can resolve an item to an exact canonical HTTPS page and produce a pending handoff request. A host adapter belongs to the agentic application integration, not the website/framework adapter. It is the host's job to present the real first-party page and report what happened.

## Request

`ExperienceHandoffRequest` contains:

- `entityId`: stable selected item identity;
- `canonicalUrl`: HTTPS URL on an owner-configured hostname whose path matches an inspected public HTML route;
- `preferredPresentation`: `current-agent-app`;
- `context`: empty by default; explicitly allowlisted short, non-sensitive item fields only.

The request does not include the user's search prompt, conversation, credentials, session state, contact information, or precise location. A pending request is a request only; it is not a navigation result.

## Host responsibilities

Implement `HostAdapter.openExperience(request)` in the target application's supported integration surface. The adapter should:

1. preserve the canonical destination and item identity exactly;
2. ask the host to open the real first-party page in its current agentic application when supported;
3. leave normal browser authentication, CSP, permissions, and user confirmation in force;
4. report the actual presentation surface only after the host confirms it;
5. return `unsupported` when embedded presentation is unavailable, so the caller can offer the canonical link as an external fallback;
6. return `denied` or `failed` without claiming an open when the host or site blocks the action.

AgentSurface core does not call a browser, start a navigation, or assume that a host supports an embedded browser.

## Outcomes

| Status | Meaning |
|---|---|
| `opened-in-current-app` | The host confirmed the exact canonical URL in its current app surface. |
| `opened-in-companion-app` | The host confirmed the exact URL in a companion surface. |
| `opened-externally` | The host confirmed the exact URL in an external browser. |
| `unsupported` | No in-app presentation was available; the canonical link is returned as a fallback. |
| `denied` | The user, host, site, authentication, or security policy denied the request. |
| `failed` | The host could not confirm the exact destination or encountered an error. |

For any `opened-*` outcome, the result must include `openedUrl` exactly equal to `request.canonicalUrl`. The core converts a mismatched or missing URL into `failed`. `unsupported` returns `fallbackUrl` equal to the canonical URL and does not claim that it opened.

## Capability and support claims

Host implementations must detect capabilities through documented host APIs. Do not infer embedded-browser support from a website manifest, MCP transport, user-agent string, or successful external launch. Publish a support matrix by host version and desktop/mobile platform. A fake adapter passing the conformance suite checks the contract only; it does not qualify any real host.

## Conformance and dogfooding

Run `src/handoff/hostAdapter.conformance.test.ts` for exact destination preservation, truthful outcomes, unsupported fallback, context filtering, and authentication behavior. Then test the named host on every claimed platform with a real selected catalog item. Record the actual surface, redirect behavior, CSP/auth restrictions, user prompts, fallback, and failures. Never report the fake adapter as a real integration.
