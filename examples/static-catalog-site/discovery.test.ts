import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const discovery = await import("./discovery.js").catch(() => null) as null | {
  searchCatalog?: (items: Array<Record<string, unknown>>, params?: URLSearchParams) => { items: Array<Record<string, unknown>>; unsupportedFilters: string[]; invalidFilters: string[] };
  canonicalItemPath?: (item: Record<string, unknown>) => string | null;
  escapeHtml?: (value: string) => string;
};

const products: Array<Record<string, unknown>> = [
  { id: "stock-104", name: "2021 Toyota RAV4 XLE", make: "Toyota", model: "RAV4", year: 2021, priceCad: 32900, public: true, canonicalPath: "/products/stock-104-rav4-xle/" },
  { id: "stock-205", name: "2022 Honda CR-V EX-L", make: "Honda", model: "CR-V", year: 2022, priceCad: 35400, public: true, canonicalPath: "/products/stock-205-crv-exl/" },
  { id: "stock-308", name: "2020 Toyota Corolla SE", make: "Toyota", model: "Corolla", year: 2020, priceCad: 22400, public: true, canonicalPath: "/products/stock-308-corolla-se/" },
  { id: "stock-412", name: "2023 Mazda CX-5 GS", make: "Mazda", model: "CX-5", year: 2023, priceCad: 33700, public: true, canonicalPath: "/products/stock-412-cx5-gs/" },
  { id: "stock-517", name: "2021 Ford Escape SEL", make: "Ford", model: "Escape", year: 2021, priceCad: 27600, public: true, canonicalPath: "/products/stock-517-escape-sel/" },
  { id: "internal-900", name: "Unpublished Toyota RAV4", make: "Toyota", model: "RAV4", year: 2024, priceCad: 40000, public: false, canonicalPath: "/products/internal-900/" },
];

describe("static catalogue discovery helpers", () => {
  it("filtersBySupportedQueryAndFields", () => {
    const result = discovery?.searchCatalog?.(products, new URLSearchParams("q=rav4&make=Toyota&maxPrice=35000"));
    expect(result?.items.map((item) => item.id)).toEqual(["stock-104"]);
    expect(result?.unsupportedFilters).toEqual([]);
  });

  it("treats a blank submitted budget as no price filter", () => {
    const keywordOnly = discovery?.searchCatalog?.(products, new URLSearchParams("q=rav4&make=&maxPrice="));
    const emptyForm = discovery?.searchCatalog?.(products, new URLSearchParams("q=&make=&maxPrice="));
    expect(keywordOnly?.items.map((item) => item.id)).toEqual(["stock-104"]);
    expect(emptyForm?.items).toHaveLength(3);
  });

  it("reports an invalid budget instead of silently removing the price filter", () => {
    const result = discovery?.searchCatalog?.(products, new URLSearchParams("maxPrice=not-a-price"));
    expect(result?.items).toEqual([]);
    expect(result?.invalidFilters).toEqual(["maxPrice"]);
  });

  it("excludesNonPublicItems", () => {
    const result = discovery?.searchCatalog?.(products, new URLSearchParams("q=rav4"));
    expect(result?.items.map((item) => item.id)).toEqual(["stock-104"]);
  });

  it("capsUnfilteredResults", () => {
    const result = discovery?.searchCatalog?.(products);
    expect(result?.items).toHaveLength(3);
    expect(result?.items.length).toBeLessThan(products.length);
  });

  it("usesExactCanonicalItemLinks", () => {
    expect(discovery?.canonicalItemPath?.(products[0])).toBe("/products/stock-104-rav4-xle/");
  });

  it("rejectsMalformedCanonicalPath", () => {
    expect(discovery?.canonicalItemPath?.({ id: "stock-104", public: true, canonicalPath: "/cars/suv/toyota/" })).toBeNull();
    expect(discovery?.canonicalItemPath?.({ id: "stock-104", public: true, canonicalPath: "/products/stock-205-crv-exl/" })).toBeNull();
  });

  it("reportsUnsupportedFilters", () => {
    const result = discovery?.searchCatalog?.(products, new URLSearchParams("make=Toyota&dealerEmail=private%40example.test"));
    expect(result?.unsupportedFilters).toEqual(["dealerEmail"]);
    expect(result?.items.every((item) => item.make === "Toyota")).toBe(true);
  });

  it("escapesQueryText", () => {
    expect(discovery?.escapeHtml?.('<img src=x onerror="alert(1)">')).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("maps every published catalogue record to a detail page with the same identity", async () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const catalogue = JSON.parse(await readFile(resolve(root, "catalog.json"), "utf8")) as { items: Array<Record<string, unknown>> };
    for (const item of catalogue.items) {
      const path = discovery?.canonicalItemPath?.(item);
      expect(path, `invalid canonical path for ${String(item.id)}`).not.toBeNull();
      const pagePath = resolve(root, `.${path}`, "index.html");
      const page = await readFile(pagePath, "utf8");
      expect(page).toContain(`data-product-id="${item.id}"`);
      expect(page).toContain(`<link rel="canonical" href="${path}">`);
    }
  });

  it("rejects IDs that could change the canonical route shape", () => {
    expect(discovery?.canonicalItemPath?.({ id: "stock-104/../../cars", public: true, canonicalPath: "/products/stock-104/../../cars-rav4/" })).toBeNull();
  });
});
