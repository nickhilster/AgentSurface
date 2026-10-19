import { describe, expect, it, vi } from "vitest";
import { createPendingHandoffRequest, dispatchHandoff } from "./handoff.js";
import type { ExperienceHandoffRequest, HostAdapter } from "../types/handoff.js";
import type { DestinationResolution } from "../lib/destinations.js";

const resolution: DestinationResolution = {
  valid: true,
  destination: { entityId: "vehicle:1", canonicalUrl: "https://dealer.example.test/used/1", routePath: "/used/1" },
};
const request = createPendingHandoffRequest(resolution).request;

describe("host adapter conformance harness", () => {
  it("preservesExactCanonicalDestination", async () => {
    const openExperience = vi.fn(async (received: ExperienceHandoffRequest) => ({ status: "opened-in-current-app" as const, openedUrl: received.canonicalUrl }));
    const result = await dispatchHandoff({ openExperience }, request);
    expect(openExperience).toHaveBeenCalledWith(request);
    expect(result).toEqual({ status: "opened-in-current-app", openedUrl: request.canonicalUrl });
  });

  it("reportsActualSurface", async () => {
    const adapter: HostAdapter = { openExperience: async () => ({ status: "opened-in-companion-app", openedUrl: request.canonicalUrl }) };
    await expect(dispatchHandoff(adapter, request)).resolves.toMatchObject({ status: "opened-in-companion-app" });
  });

  it("fallsBackWhenInAppUnsupported", async () => {
    const adapter: HostAdapter = { openExperience: async () => ({ status: "unsupported" }) };
    await expect(dispatchHandoff(adapter, request)).resolves.toMatchObject({ status: "unsupported", fallbackUrl: request.canonicalUrl });
  });

  it("doesNotCarrySensitiveContext", async () => {
    const pending = createPendingHandoffRequest(resolution, { trim: "SV", prompt: "find a vehicle", postalCode: "M5V" }, ["trim", "prompt", "postalCode"]);
    expect(pending.request.context).toEqual({ trim: "SV" });
    const received: ExperienceHandoffRequest[] = [];
    await dispatchHandoff({ openExperience: async (value) => { received.push(value); return { status: "unsupported" }; } }, pending.request);
    expect(received[0].context).toEqual({ trim: "SV" });
  });

  it("doesNotBypassAuthentication", async () => {
    const authRequest = { ...request, canonicalUrl: "https://dealer.example.test/account/vehicle/1" };
    const adapter: HostAdapter = { openExperience: vi.fn(async () => ({ status: "denied" as const, message: "The site requires sign-in in the host browser." })) };
    const result = await dispatchHandoff(adapter, authRequest);
    expect(result.status).toBe("denied");
    expect(result).not.toHaveProperty("openedUrl");
  });

  it("rejectsAnIntentionallyIncorrectAdapterThatClaimsTheWrongPage", async () => {
    const incorrect: HostAdapter = { openExperience: async () => ({ status: "opened-in-current-app", openedUrl: "https://dealer.example.test/used/2" }) };
    await expect(dispatchHandoff(incorrect, request)).resolves.toMatchObject({ status: "failed" });
  });
});
