import { describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../types/config.js";
import type { RouteRecord } from "../types/model.js";
import { resolveCanonicalDestination } from "./destinations.js";

const route: RouteRecord = {
  path: "/products/[id]", classification: "public-static", contentType: "page", sourceFiles: ["app/products/[id]/page.tsx"],
  agentReadableAlternate: "/products/1.md", canonicalUrl: null, dynamicSegments: ["id"], redirectsTo: null,
  contentBoundaryTag: "main", provenance: [], confidence: 1,
};

const routes = [route];
const config = { ...DEFAULT_CONFIG, site: { name: "Test", hostnames: ["shop.example.test"] } };

describe("canonical item destinations", () => {
  it("rejectsUnapprovedOrigin", () => {
    expect(resolveCanonicalDestination({ id: "sku:1", canonicalPageUrl: "https://evil.test/products/1" }, config, routes)).toMatchObject({ valid: false });
  });

  it("rejectsCredentialsInUrl", () => {
    expect(resolveCanonicalDestination({ id: "sku:1", canonicalPageUrl: "https://user:pass@shop.example.test/products/1" }, config, routes)).toMatchObject({ valid: false, reason: expect.stringMatching(/credentials/) });
  });

  it("rejectsUnknownOrNonPublicRoute", () => {
    expect(resolveCanonicalDestination({ id: "sku:1", canonicalPageUrl: "/not-inspected/1" }, config, routes)).toMatchObject({ valid: false });
    expect(resolveCanonicalDestination({ id: "sku:1", canonicalPageUrl: "/products/1" }, config, [{ ...route, classification: "authenticated" }])).toMatchObject({ valid: false });
  });

  it("usesCanonicalHtmlDestination", () => {
    expect(resolveCanonicalDestination({ id: "sku:1", canonicalPageUrl: "/products/1" }, config, routes)).toEqual({
      valid: true,
      destination: { entityId: "sku:1", canonicalUrl: "https://shop.example.test/products/1", routePath: "/products/1" },
    });
  });
});
