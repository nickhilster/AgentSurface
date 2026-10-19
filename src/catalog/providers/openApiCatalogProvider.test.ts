import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import yaml from "js-yaml";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig, writeConfig } from "../../config.js";
import { DEFAULT_CONFIG } from "../../types/config.js";
import type { CatalogConfig } from "../../types/config.js";
import { bindOpenApiCatalogProvider, inspectCatalogs } from "./openApiCatalogProvider.js";

const configEntry: CatalogConfig = {
  id: "parts", entityKind: "product", scope: "public" as const,
  source: { kind: "openapi" as const, file: "openapi.yaml" },
  searchOperation: "searchParts", detailOperation: "getPart",
  fieldAllowlist: [{ name: "price", sourceField: "price", type: "number" as const, operators: ["eq", "lte"] as const }],
  canonicalRoute: "/parts/{id}", maxResults: 10, freshness: { class: "unknown" as const },
};

function apiSpec(overrides: Record<string, unknown> = {}) {
  return {
    openapi: "3.0.3",
    servers: [{ url: "https://api.example.test/v1" }],
    paths: {
      "/parts": { get: {
        operationId: "searchParts",
        parameters: [
          { name: "price", in: "query", schema: { type: "number" } },
          { name: "price_lte", in: "query", schema: { type: "number" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
        ],
        responses: { "200": { description: "ok", content: { "application/json": { schema: {
          type: "object", properties: { items: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, price: { type: "number" } } } } },
        } } } } },
      } },
      "/parts/{id}": { get: {
        operationId: "getPart",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "ok", content: { "application/json": { schema: {
          type: "object", properties: { id: { type: "string" }, name: { type: "string" }, price: { type: "number" } },
        } } } } },
      } },
    },
    ...overrides,
  };
}

describe("declared OpenAPI catalog binding", () => {
  let repoRoot = "";
  afterEach(() => { if (repoRoot) rmSync(repoRoot, { recursive: true, force: true }); vi.unstubAllGlobals(); });

  async function inspect(spec: unknown, catalogDeclaration: CatalogConfig = configEntry, entities: import("../../types/model.js").EntityRecord[] = []) {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-openapi-catalog-"));
    mkdirSync(join(repoRoot, ".agentsurface"), { recursive: true });
    writeFileSync(join(repoRoot, "openapi.yaml"), yaml.dump(spec));
    writeConfig(repoRoot, { ...DEFAULT_CONFIG, site: { name: "Test", hostnames: ["example.test"] }, catalogs: [catalogDeclaration] });
    const unknowns: string[] = [];
    const catalogs = await inspectCatalogs(repoRoot, loadConfig(repoRoot), unknowns, entities);
    return { catalogs, unknowns };
  }

  it("mapsDeclaredSearchOperation", async () => {
    const result = await inspect(apiSpec());
    expect(result.catalogs).toHaveLength(1);
    expect(result.catalogs[0]).toMatchObject({
      id: "parts", searchMode: "read-api", source: { kind: "openapi", file: "openapi.yaml" },
      searchOperation: "searchParts", detailOperation: "getPart", canonicalRoute: "/parts/{id}",
    });
  });

  it("mapsDeclaredDetailOperation", async () => {
    const result = await inspect(apiSpec());
    expect(result.catalogs[0].detailOperation).toBe("getPart");
    expect(result.catalogs[0].fields).toContainEqual(expect.objectContaining({ name: "price", operators: ["eq", "lte"] }));
  });

  it("rejectsMutationOperation", async () => {
    const spec = apiSpec();
    (spec.paths as Record<string, Record<string, unknown>>)["/parts"].get = undefined;
    (spec.paths as Record<string, Record<string, unknown>>)["/parts"].post = {
      operationId: "searchParts", responses: { "200": { description: "ok" } },
    };
    const result = await inspect(spec);
    expect(result.catalogs).toEqual([]);
    expect(result.unknowns.join(" ")).toMatch(/searchParts.*GET|GET.*searchParts/i);
  });

  it("rejectsAuthRequiredOperation", async () => {
    const spec = apiSpec({ security: [{ bearerAuth: [] }] });
    const result = await inspect(spec);
    expect(result.catalogs).toEqual([]);
    expect(result.unknowns.join(" ")).toMatch(/security|auth/i);
  });

  it("reportsUnsupportedResponseSchema", async () => {
    const spec = apiSpec();
    const search = (spec.paths as Record<string, Record<string, Record<string, unknown>>>)["/parts"].get;
    search.responses = { "200": { description: "ok", content: { "application/json": { schema: { type: "string" } } } } };
    const result = await inspect(spec);
    expect(result.catalogs).toEqual([]);
    expect(result.unknowns.join(" ")).toMatch(/schema|response/i);
  });

  it("labelsJsonLdCatalogAsStatic", async () => {
    const declaration: CatalogConfig = {
      id: "static-parts", entityKind: "product" as const, scope: "public" as const,
      source: { kind: "static-jsonld" as const },
      fieldAllowlist: [{ name: "price", sourceField: "price.amount", type: "number", operators: ["eq"] }],
      canonicalRoute: "/parts/{id}", maxResults: 10, freshness: { class: "static" as const },
    };
    const result = await inspect({}, declaration, [{
      id: "sku:1", kind: "product", label: "Part", sourceFiles: ["public/parts/index.html"],
      provenance: [], attributes: [], market: [], locale: null, canonicalPageUrl: "/parts/1",
    }]);
    expect(result.catalogs[0]).toMatchObject({ source: { kind: "static-jsonld" }, searchMode: "static-index", freshness: { class: "static" } });
    expect(result.catalogs[0].searchOperation).toBeNull();
  });

  it("callsOnlyDeclaredReadOperations", async () => {
    await inspect(apiSpec());
    const calls: Array<{ url: string; method: string; redirect?: string; accept?: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: init?.method ?? "GET", redirect: init?.redirect, accept: new Headers(init?.headers).get("accept") ?? undefined });
      const body = url.includes("/parts?")
        ? { items: [{ id: "1", name: "Part one", price: 8 }], nextCursor: null }
        : { id: "1", name: "Part one", price: 8 };
      return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    }));

    const provider = await bindOpenApiCatalogProvider(repoRoot, loadConfig(repoRoot), "parts");
    const results = await provider.search({ limit: 999, filters: [{ field: "price", operator: "lte", value: 10 }] });
    const detail = await provider.getById("1");

    expect(results.items[0]).toMatchObject({ id: "1", canonicalPageUrl: "/parts/1", fields: { price: 8 } });
    expect(detail).toMatchObject({ id: "1", label: "Part one", canonicalPageUrl: "/parts/1" });
    expect(calls).toEqual([
      { url: "https://api.example.test/v1/parts?price_lte=10&limit=10", method: "GET", redirect: "error", accept: "application/json" },
      { url: "https://api.example.test/v1/parts/1", method: "GET", redirect: "error", accept: "application/json" },
    ]);
  });
});
