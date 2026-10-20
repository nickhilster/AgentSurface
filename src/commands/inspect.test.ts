import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeConfig } from "../config.js";
import { DEFAULT_CONFIG } from "../types/config.js";
import { runInspect } from "./inspect.js";

describe("inspect owner route overrides", () => {
  let repoRoot = "";
  afterEach(() => { if (repoRoot) rmSync(repoRoot, { recursive: true, force: true }); });

  it("applies owner overrides with owner-declared provenance", async () => {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-inspect-overrides-"));
    writeFileSync(join(repoRoot, "vite.config.ts"), "export default {};");
    writeFileSync(join(repoRoot, "package.json"), JSON.stringify({ devDependencies: { vite: "^6.0.0" } }));
    mkdirSync(join(repoRoot, "public", "about"), { recursive: true });
    writeFileSync(join(repoRoot, "public", "about", "index.html"), "<h1>About</h1>");
    writeConfig(repoRoot, {
      ...DEFAULT_CONFIG,
      site: { name: "Test", hostnames: [] },
      routes: { exclude: [], overrides: [{ path: "/about", classification: "authenticated", contentBoundaryTag: "article" }] },
    });

    const model = await runInspect({ repoRoot });
    const route = model.routes.find((candidate) => candidate.path === "/about/");
    expect(route?.classification).toBe("authenticated");
    expect(route?.contentBoundaryTag).toBe("article");
    expect(route?.provenance).toContainEqual(expect.objectContaining({
      method: "owner-config",
      source: ".agentsurface/config.yaml:routes.overrides",
      confidence: 1,
    }));
  });

  it("inspectWritesEmptyCatalogListWhenNoneConfigured", async () => {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-inspect-catalog-empty-"));
    writeFileSync(join(repoRoot, "vite.config.ts"), "export default {};");
    writeFileSync(join(repoRoot, "package.json"), JSON.stringify({ devDependencies: { vite: "^6.0.0" } }));
    writeConfig(repoRoot, { ...DEFAULT_CONFIG, site: { name: "Test", hostnames: ["example.test"] } });

    const model = await runInspect({ repoRoot });

    expect(model.catalogs).toEqual([]);
    expect(model.entities).toEqual([]);
    expect(JSON.parse(readFileSync(join(repoRoot, ".agentsurface", "model", "catalogs.json"), "utf-8"))).toEqual([]);
    expect(existsSync(join(repoRoot, ".agentsurface", "model", "entities.json"))).toBe(true);
  });

  it("mapsSchemaOrgProductFieldsWithProvenance", async () => {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-inspect-jsonld-"));
    writeFileSync(join(repoRoot, "vite.config.ts"), "export default {};");
    writeFileSync(join(repoRoot, "package.json"), JSON.stringify({ devDependencies: { vite: "^6.0.0" } }));
    mkdirSync(join(repoRoot, "public", "widget"), { recursive: true });
    writeFileSync(join(repoRoot, "public", "widget", "index.html"), `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      "@id": "https://example.test/widget#product",
      sku: "SKU-1",
      name: "Widget",
      description: "A public test product.",
      brand: { "@type": "Brand", name: "Example" },
      offers: { "@type": "Offer", price: "49.99", priceCurrency: "CAD", availability: "https://schema.org/InStock" },
    })}</script><main>Widget</main>`);
    writeConfig(repoRoot, { ...DEFAULT_CONFIG, site: { name: "Test", hostnames: ["example.test"] } });

    const model = await runInspect({ repoRoot });
    const product = model.entities.find((entity) => entity.kind === "product");

    expect(product).toMatchObject({
      id: "sku:SKU-1",
      kind: "product",
      label: "Widget",
      description: "A public test product.",
      price: { amount: 49.99, currency: "CAD", kind: "offer" },
      canonicalPageUrl: "/widget/",
    });
    expect(product && "attributes" in product ? product.attributes : []).toContainEqual(expect.objectContaining({ name: "brand", value: "Example", type: "string" }));
    expect(product?.provenance).toContainEqual(expect.objectContaining({
      claim: "product:name:Widget",
      source: "public/widget/index.html",
      method: "schema-org-jsonld",
    }));
  });

  it("uses each product's own inspected URL on a category page and leaves unresolved products without a destination", async () => {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-inspect-jsonld-category-"));
    writeFileSync(join(repoRoot, "vite.config.ts"), "export default {};");
    writeFileSync(join(repoRoot, "package.json"), JSON.stringify({ devDependencies: { vite: "^6.0.0" } }));
    mkdirSync(join(repoRoot, "public", "category"), { recursive: true });
    mkdirSync(join(repoRoot, "public", "products", "one"), { recursive: true });
    mkdirSync(join(repoRoot, "public", "products", "two"), { recursive: true });
    const product = (sku: string, name: string, url?: string) => ({
      "@context": "https://schema.org", "@type": "Product", sku, name, ...(url ? { url } : {}),
    });
    writeFileSync(join(repoRoot, "public", "category", "index.html"), `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org", "@graph": [
        product("SKU-ONE", "One", "/products/one/"),
        product("SKU-TWO", "Two"),
        product("SKU-CATEGORY", "Category route", "/category/"),
        product("SKU-EXTERNAL", "External route", "https://outside.test/products/one/"),
      ],
    })}</script>`);
    writeFileSync(join(repoRoot, "public", "products", "one", "index.html"), "<h1>One</h1>");
    writeFileSync(join(repoRoot, "public", "products", "two", "index.html"), "<h1>Two</h1>");
    writeConfig(repoRoot, { ...DEFAULT_CONFIG, site: { name: "Test", hostnames: ["example.test"] } });

    const model = await runInspect({ repoRoot });
    const one = model.entities.find((entity) => entity.kind === "product" && entity.id === "sku:SKU-ONE");
    const two = model.entities.find((entity) => entity.kind === "product" && entity.id === "sku:SKU-TWO");
    const category = model.entities.find((entity) => entity.kind === "product" && entity.id === "sku:SKU-CATEGORY");
    const external = model.entities.find((entity) => entity.kind === "product" && entity.id === "sku:SKU-EXTERNAL");
    expect(one && "canonicalPageUrl" in one ? one.canonicalPageUrl : undefined).toBe("/products/one/");
    expect(two && "canonicalPageUrl" in two ? two.canonicalPageUrl : undefined).toBeNull();
    expect(category && "canonicalPageUrl" in category ? category.canonicalPageUrl : undefined).toBeNull();
    expect(external && "canonicalPageUrl" in external ? external.canonicalPageUrl : undefined).toBeNull();
  });

  it("doesNotTreatJsonLdOfferAsLiveAvailability", async () => {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-inspect-jsonld-freshness-"));
    writeFileSync(join(repoRoot, "vite.config.ts"), "export default {};");
    writeFileSync(join(repoRoot, "package.json"), JSON.stringify({ devDependencies: { vite: "^6.0.0" } }));
    mkdirSync(join(repoRoot, "public", "widget"), { recursive: true });
    writeFileSync(join(repoRoot, "public", "widget", "index.html"), `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org", "@type": "Product", sku: "SKU-2", name: "Widget 2",
      offers: { "@type": "Offer", price: "99.99", priceCurrency: "CAD", availability: "https://schema.org/InStock" },
    })}</script><main>Widget 2</main>`);
    writeConfig(repoRoot, { ...DEFAULT_CONFIG, site: { name: "Test", hostnames: ["example.test"] } });

    const model = await runInspect({ repoRoot });

    expect(model.catalogs).toEqual([]);
    const product = model.entities.find((entity) => entity.kind === "product");
    expect(product && "availability" in product ? product.availability : undefined).toMatchObject({ value: "https://schema.org/InStock", freshness: { class: "unknown" } });
    expect(product && "canonicalPageUrl" in product ? product.canonicalPageUrl : undefined).toBeNull();
  });

  it("createsStaticJsonLdCatalogOnlyWhenOwnerConfigured", async () => {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-inspect-jsonld-catalog-"));
    writeFileSync(join(repoRoot, "vite.config.ts"), "export default {};");
    writeFileSync(join(repoRoot, "package.json"), JSON.stringify({ devDependencies: { vite: "^6.0.0" } }));
    mkdirSync(join(repoRoot, "public", "parts"), { recursive: true });
    writeFileSync(join(repoRoot, "public", "parts", "index.html"), `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org", "@type": "Product", sku: "PART-1", name: "Part one",
    })}</script><main>Part one</main>`);
    writeConfig(repoRoot, {
      ...DEFAULT_CONFIG,
      site: { name: "Test", hostnames: [] },
      catalogs: [{
        id: "parts", entityKind: "product", scope: "public", source: { kind: "static-jsonld" },
        fieldAllowlist: [{ name: "name", sourceField: "label", type: "string", operators: ["eq"] }],
        canonicalRoute: "/parts/{id}", maxResults: 10, freshness: { class: "static" },
      }],
    });

    const model = await runInspect({ repoRoot });

    expect(model.catalogs).toHaveLength(1);
    expect(model.catalogs[0]).toMatchObject({ searchMode: "static-index", source: { kind: "static-jsonld" }, freshness: { class: "static" } });
    expect(model.catalogs[0].provenance).toContainEqual(expect.objectContaining({ method: "owner-config" }));
  });
});
