import { describe, expect, it } from "vitest";
import type { CatalogConfig } from "../../types/config.js";
import type { CatalogRecord, ProductRecord } from "../../types/model.js";
import { createStaticJsonLdCatalogProvider } from "./staticJsonLdCatalogProvider.js";

const declaration: CatalogConfig = {
  id: "parts", entityKind: "product", scope: "public", source: { kind: "static-jsonld" },
  fieldAllowlist: [
    { name: "name", sourceField: "label", type: "string", operators: ["contains"] },
    { name: "price", sourceField: "price.amount", type: "number", operators: ["gte"], sortable: true },
  ],
  canonicalRoute: "/parts/{id}", maxResults: 10, freshness: { class: "static" },
};

const record: CatalogRecord = {
  id: "parts", entityKind: "product", scope: "public", source: { kind: "static-jsonld", file: "public/**/*.html" },
  searchOperation: null, detailOperation: null, canonicalRoute: "/parts/{id}",
  fields: declaration.fieldAllowlist.map(({ name, type, operators, sortable }) => ({ name, type, operators, sortable: sortable ?? false, filterable: true })),
  searchMode: "static-index", supportsQuery: true, supportsSorting: true, supportsPagination: true,
  maxResults: 10, freshness: { class: "static" }, provenance: [],
};

const products: ProductRecord[] = [
  { id: "sku:1", kind: "product", label: "Steel bolt", sourceFiles: ["public/parts/1/index.html"], provenance: [], attributes: [], price: { amount: 5, currency: "CAD", kind: "offer", freshness: { class: "unknown" }, provenance: [] }, availability: { value: "InStock", freshness: { class: "unknown" }, provenance: [] }, market: [], locale: null, canonicalPageUrl: "/parts/sku-1" },
  { id: "sku:2", kind: "product", label: "Steel nut", sourceFiles: ["public/parts/2/index.html"], provenance: [], attributes: [], market: [], locale: null, canonicalPageUrl: "/parts/sku-2" },
];

describe("static JSON-LD provider", () => {
  it("searches only configured static products and preserves missing values", async () => {
    const provider = createStaticJsonLdCatalogProvider(declaration, record, products);
    const result = await provider.search({ query: "steel", filters: [{ field: "price", operator: "gte", value: 4 }], limit: 5 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: "sku:1", canonicalPageUrl: "/parts/sku-1", fields: { name: "Steel bolt", price: 5 }, freshness: { class: "static" } });
    const missingPrice = await provider.getById("sku:2");
    expect(missingPrice?.fields.price).toBeNull();
  });
});
