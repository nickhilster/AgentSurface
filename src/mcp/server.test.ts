import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CatalogProvider } from "../catalog/types.js";
import { createCatalogMcpServer } from "./server.js";

const item = {
  id: "sku:1", label: "Widget", canonicalPageUrl: "/products/1", fields: { price: 10 },
  provenance: [{ subject: "entity:sku:1.price", claim: "source-price", source: "api.yaml:price", method: "openapi-contract" as const, confidence: 1 }],
  freshness: { class: "unknown" as const },
};

function provider(): CatalogProvider {
  return {
    search: vi.fn(async (input) => ({ items: [{ ...item }], nextCursor: null, freshness: { class: "unknown" as const } })),
    getById: vi.fn(async () => item),
  };
}

describe("catalog MCP tools", () => {
  let server: ReturnType<typeof createCatalogMcpServer> | undefined;
  let client: Client | undefined;
  afterEach(async () => { await client?.close(); await server?.close(); client = undefined; server = undefined; });

  async function connect(source: CatalogProvider = provider()) {
    server = createCatalogMcpServer(new Map([["parts", source]]));
    client = new Client({ name: "agentsurface-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    return { client, source };
  }

  it("mcpSearchIsBoundedReadOnly", async () => {
    const { client: connected, source } = await connect();
    const result = await connected.callTool({ name: "search_catalog", arguments: { catalogId: "parts", limit: 100 } });
    expect(result.structuredContent).toMatchObject({ items: [{ id: "sku:1" }] });
    expect(source.search).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
    const tools = await connected.listTools();
    const searchTool = tools.tools.find((tool) => tool.name === "search_catalog");
    expect(searchTool?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    const invalid = await connected.callTool({ name: "search_catalog", arguments: { catalogId: "parts", limit: 101 } });
    expect(invalid.isError).toBe(true);
  });

  it("mcpGetItemReturnsProvenance", async () => {
    const { client: connected } = await connect();
    const result = await connected.callTool({ name: "get_catalog_item", arguments: { catalogId: "parts", id: "sku:1" } });
    expect(result.structuredContent).toMatchObject({ item: { canonicalPageUrl: "/products/1", provenance: [{ source: "api.yaml:price" }] } });
  });

  it("mcpDoesNotExposeTransactions", async () => {
    const { client: connected } = await connect();
    const { tools } = await connected.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual(["get_catalog_item", "search_catalog"]);
    expect(tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
  });
});
