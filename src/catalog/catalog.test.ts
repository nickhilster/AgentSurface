import { describe, expect, it, vi } from "vitest";
import type { CatalogRecord } from "../types/model.js";
import { createCatalogProvider } from "./catalog.js";
import type { CatalogBackend, CatalogItemDetail } from "./types.js";

const catalog: CatalogRecord = {
  id: "parts", entityKind: "product", scope: "public",
  source: { kind: "openapi", file: "openapi.yaml" },
  searchOperation: "searchParts", detailOperation: "getPart", canonicalRoute: "/parts/{id}",
  fields: [
    { name: "price", type: "number", filterable: true, sortable: true, operators: ["eq", "lte", "gte"] },
    { name: "brand", type: "string", filterable: true, sortable: false, operators: ["eq", "contains"] },
  ],
  searchMode: "read-api", supportsQuery: true, supportsSorting: true, supportsPagination: true,
  maxResults: 2, freshness: { class: "unknown" }, provenance: [],
};

function item(overrides: Partial<CatalogItemDetail> = {}): CatalogItemDetail {
  return {
    id: "sku:1", label: "Part one", canonicalPageUrl: "/parts/1", fields: { price: 10, brand: "A" },
    provenance: [], freshness: { class: "unknown" }, ...overrides,
  };
}

function backend(items: CatalogItemDetail[] = [item()]): CatalogBackend {
  return { search: vi.fn(async () => ({ items, nextCursor: null })), getById: vi.fn(async () => items[0] ?? null) };
}

describe("provider-neutral catalog contract", () => {
  it("rejectsUnsupportedFilter", async () => {
    const provider = createCatalogProvider(catalog, backend());
    await expect(provider.search({ limit: 1, filters: [{ field: "secret", operator: "eq", value: "x" }] })).rejects.toThrow(/unsupported field/);
    await expect(provider.search({ limit: 1, filters: [{ field: "price", operator: "contains", value: "10" }] })).rejects.toThrow(/unsupported operator/);
  });

  it("clampsResultLimit", async () => {
    const source = backend();
    const provider = createCatalogProvider(catalog, source);
    const result = await provider.search({ limit: 999 });
    expect(source.search).toHaveBeenCalledWith(expect.objectContaining({ limit: 2 }));
    expect(result.items).toHaveLength(1);
  });

  it("preservesUnknownDynamicFields", async () => {
    const provider = createCatalogProvider(catalog, backend([item({ fields: { price: null, brand: "A", injected: "private" } })]));
    const result = await provider.search({ limit: 1 });
    expect(result.items[0].fields).toEqual({ price: null, brand: "A" });
    expect(result.items[0]).not.toHaveProperty("price");
  });

  it("doesNotInferOrTransmitLocation", async () => {
    const source = backend();
    const provider = createCatalogProvider(catalog, source, { allowedMarkets: ["CA-ON"] });
    await provider.search({ limit: 1 });
    expect(source.search).toHaveBeenCalledWith(expect.not.objectContaining({ market: expect.anything() }));
    await expect(provider.search({ limit: 1, market: "US" })).rejects.toThrow(/market/);
    await provider.search({ limit: 1, market: "CA-ON" });
    expect(source.search).toHaveBeenLastCalledWith(expect.objectContaining({ market: "CA-ON" }));
  });

  it("rejectsUnresolvableDestination", async () => {
    const provider = createCatalogProvider(catalog, backend([
      item({ id: "valid", canonicalPageUrl: "/parts/ok" }),
      item({ id: "external", canonicalPageUrl: "https://attacker.example/parts/1" }),
      item({ id: "protocol-relative", canonicalPageUrl: "//attacker.example/parts/2" }),
    ]));
    const result = await provider.search({ limit: 3 });
    expect(result.items.map((candidate) => candidate.id)).toEqual(["valid"]);
  });
});
