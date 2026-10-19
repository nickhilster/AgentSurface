import type { DestinationResolution } from "../lib/destinations.js";
import type { ExperienceHandoffRequest, ExperienceHandoffResult, HostAdapter, PendingHandoffRequest } from "../types/handoff.js";

const SENSITIVE_CONTEXT_KEY = /(?:token|secret|password|credential|auth|email|phone|address|postal|zip|location|latitude|longitude|conversation|prompt|query|message|cookie)/i;

export function createPendingHandoffRequest(
  resolution: DestinationResolution,
  contextCandidates: Record<string, unknown> = {},
  allowedContextKeys: string[] = []
): PendingHandoffRequest {
  if (!resolution.valid) throw new Error(`Cannot create handoff request: ${resolution.reason}`);
  const allowed = new Set(allowedContextKeys);
  const context: Record<string, string> = {};
  for (const [key, value] of Object.entries(contextCandidates)) {
    if (!allowed.has(key) || SENSITIVE_CONTEXT_KEY.test(key) || typeof value !== "string" || !value.trim() || value.length > 128 || /[\u0000-\u001f]/.test(value)) continue;
    context[key] = value.trim();
  }
  return {
    status: "pending",
    request: {
      entityId: resolution.destination.entityId,
      canonicalUrl: resolution.destination.canonicalUrl,
      preferredPresentation: "current-agent-app",
      context,
    },
  };
}

export async function dispatchHandoff(adapter: HostAdapter, request: ExperienceHandoffRequest): Promise<ExperienceHandoffResult> {
  if (!isSafeHandoffRequest(request)) return { status: "failed", message: "Handoff request has an invalid canonical destination." };
  const outcome = await adapter.openExperience(request);
  const statuses = new Set(["opened-in-current-app", "opened-in-companion-app", "opened-externally", "unsupported", "denied", "failed"]);
  if (!outcome || !statuses.has(outcome.status)) return { status: "failed", message: "Host returned an unrecognized presentation outcome." };
  if (outcome.status === "unsupported") {
    return { status: "unsupported", fallbackUrl: request.canonicalUrl, message: "Host could not present the page in-app; use the canonical link." };
  }
  if (outcome.status.startsWith("opened-") && outcome.openedUrl !== request.canonicalUrl) {
    return { status: "failed", message: "Host did not confirm opening the exact canonical destination." };
  }
  if (!outcome.status.startsWith("opened-") && outcome.openedUrl !== undefined) {
    return { status: "failed", message: "Host returned an opened URL without an opened outcome." };
  }
  return outcome;
}

function isSafeHandoffRequest(request: ExperienceHandoffRequest): boolean {
  if (!request || typeof request.entityId !== "string" || !request.entityId || request.preferredPresentation !== "current-agent-app") return false;
  try {
    const url = new URL(request.canonicalUrl);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash && !url.port;
  } catch { return false; }
}
