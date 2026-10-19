import { describe, expect, it, vi } from "vitest";
import type { DestinationResolution } from "../lib/destinations.js";
import { createPendingHandoffRequest, dispatchHandoff } from "./handoff.js";
import type { HostAdapter } from "../types/handoff.js";

const destination: DestinationResolution = {
  valid: true,
  destination: { entityId: "sku:1", canonicalUrl: "https://shop.example.test/products/1", routePath: "/products/1" },
};

describe("host-neutral experience handoff", () => {
  it("reportsOnlyConfirmedPresentation", async () => {
    const request = createPendingHandoffRequest(destination);
    expect(request.status).toBe("pending");
    const adapter: HostAdapter = { openExperience: vi.fn(async () => ({ status: "opened-in-current-app" as const })) };
    await expect(dispatchHandoff(adapter, request.request)).resolves.toMatchObject({ status: "failed" });
    expect(adapter.openExperience).toHaveBeenCalledWith(expect.objectContaining({ canonicalUrl: destination.destination.canonicalUrl }));
  });

  it("dropsUnapprovedContext", () => {
    const request = createPendingHandoffRequest(destination, { trim: "blue", query: "secret search", email: "user@example.test" }, ["trim", "query", "email"]);
    expect(request.request.context).toEqual({ trim: "blue" });
  });

  it("unsupportedHostGetsCanonicalFallback", async () => {
    const request = createPendingHandoffRequest(destination);
    const adapter: HostAdapter = { openExperience: vi.fn(async () => ({ status: "unsupported" as const })) };
    await expect(dispatchHandoff(adapter, request.request)).resolves.toEqual({
      status: "unsupported", fallbackUrl: destination.destination.canonicalUrl, message: "Host could not present the page in-app; use the canonical link." ,
    });
  });

  it("requiresTheHostToConfirmTheExactDestination", async () => {
    const request = createPendingHandoffRequest(destination);
    const adapter: HostAdapter = { openExperience: async () => ({ status: "opened-in-current-app", openedUrl: "https://shop.example.test/products/other" }) };
    await expect(dispatchHandoff(adapter, request.request)).resolves.toMatchObject({ status: "failed" });
  });
});
