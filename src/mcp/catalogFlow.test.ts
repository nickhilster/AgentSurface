import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import yaml from "js-yaml";
import { afterEach, describe, expect, it, vi } from "vitest";
import { bindOpenApiCatalogProvider } from "../catalog/providers/openApiCatalogProvider.js";
import { loadConfig, writeConfig } from "../config.js";
import { DEFAULT_CONFIG } from "../types/config.js";
import { createCatalogMcpServer } from "./server.js";

describe("fixture catalog search-to-detail flow", () => {
  let repoRoot = "";
  let client: Client | undefined;
  let server: ReturnType<typeof createCatalogMcpServer> | undefined;
  afterEach(async () => {
    await client?.close(); await server?.close();
    vi.unstubAllGlobals();
    if (repoRoot) rmSync(repoRoot, { recursive: true, force: true });
  });

  it("returns a bounded shortlist then retrieves the selected canonical item", async () => {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-catalog-flow-"));
    mkdirSync(join(repoRoot, ".agentsurface"), { recursive: true });
    const partProperties = { id: { type: "string" }, name: { type: "string" }, price: { type: "number" } };
    const spec = {
      openapi: "3.0.3", servers: [{ url: "https://api.example.test/v1" }],
      paths: {
        "/parts": { get: {
          operationId: "searchParts",
          parameters: [
            { name: "q", in: "query", schema: { type: "string" } },
            { name: "price_lte", in: "query", schema: { type: "number" } },
            { name: "limit", in: "query", schema: { type: "integer" } },
          ],
          responses: { "200": { description: "ok", content: { "application/json": { schema: { type: "object", properties: { items: { type: "array", items: { type: "object", properties: partProperties } } } } } } } },
        } },
        "/parts/{id}": { get: {
          operationId: "getPart", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "ok", content: { "application/json": { schema: { type: "object", properties: partProperties } } } } },
        } },
      },
    };
    writeFileSync(join(repoRoot, "openapi.yaml"), yaml.dump(spec));
    writeConfig(repoRoot, {
      ...DEFAULT_CONFIG,
      catalogs: [{
        id: "parts", entityKind: "product", scope: "public", source: { kind: "openapi", file: "openapi.yaml" },
        searchOperation: "searchParts", detailOperation: "getPart",
        fieldAllowlist: [{ name: "price", sourceField: "price", type: "number", operators: ["lte"] }],
        canonicalRoute: "/parts/{id}", maxResults: 10, freshness: { class: "unknown" },
      }],
    });

    const fixtures = [
      { id: "1", name: "Steel bolt", price: 8 },
      { id: "2", name: "Steel nut", price: 12 },
      { id: "3", name: "Plastic washer", price: 2 },
    ];
    const calls: string[] = [];
    let sourceResponseBytes = 0;
    vi.stubGlobal("fetch", vi.fn(async (request: unknown, init?: RequestInit) => {
      const url = new URL(String(request));
      calls.push(`${init?.method}:${url.pathname}${url.search}`);
      const id = url.pathname.split("/").pop();
      const body = url.pathname.endsWith("/parts")
        ? { items: fixtures.filter((item) => item.name.toLowerCase().includes(url.searchParams.get("q")!.toLowerCase()) && item.price <= Number(url.searchParams.get("price_lte"))), nextCursor: null }
        : fixtures.find((item) => item.id === id);
      const text = JSON.stringify(body);
      sourceResponseBytes += Buffer.byteLength(text);
      return new Response(text, { status: 200, headers: { "content-type": "application/json" } });
    }));

    const provider = await bindOpenApiCatalogProvider(repoRoot, loadConfig(repoRoot), "parts");
    server = createCatalogMcpServer(new Map([["parts", provider]]));
    client = new Client({ name: "catalog-fixture-dogfood", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    // Natural-language need: “steel part under CAD 10” → text query plus supported price ceiling.
    const shortlist = await client.callTool({ name: "search_catalog", arguments: {
      catalogId: "parts", query: "steel", filters: [{ field: "price", operator: "lte", value: 10 }], limit: 100,
    } });
    const selected = await client.callTool({ name: "get_catalog_item", arguments: { catalogId: "parts", id: "1" } });
    const shortlistBytes = Buffer.byteLength(JSON.stringify(shortlist.structuredContent));

    expect(shortlist.structuredContent).toMatchObject({ items: [{ id: "1", label: "Steel bolt", canonicalPageUrl: "/parts/1" }] });
    expect(selected.structuredContent).toMatchObject({ item: { id: "1", fields: { price: 8 }, provenance: [{ source: "openapi.yaml:price" }] } });
    expect(calls).toEqual(["GET:/v1/parts?q=steel&price_lte=10&limit=10", "GET:/v1/parts/1"]);
    expect(sourceResponseBytes).toBe(110);
    expect(shortlistBytes).toBe(323);
  });
});
