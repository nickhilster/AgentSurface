import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_CONFIG } from "../types/config.js";
import type { CatalogProvider } from "../catalog/types.js";
import type { RouteRecord } from "../types/model.js";
import { createCatalogMcpServer } from "./server.js";

const publicRoute: RouteRecord = {
  path: "/products/[id]", classification: "public-static", contentType: "page", sourceFiles: ["app/products/[id]/page.tsx"],
  agentReadableAlternate: "/products/1.md", canonicalUrl: null, dynamicSegments: ["id"], redirectsTo: null,
  contentBoundaryTag: "main", provenance: [], confidence: 1,
};

function makeItem(canonicalPageUrl = "/products/1") {
  return { id: "sku:1", label: "Widget", canonicalPageUrl, fields: {}, provenance: [], freshness: { class: "unknown" as const } };
}

function makeProvider(item = makeItem()): CatalogProvider {
  return { search: async () => ({ items: [item], nextCursor: null, freshness: { class: "unknown" } }), getById: async () => item };
}

describe("MCP canonical page resolution", () => {
  let server: ReturnType<typeof createCatalogMcpServer> | undefined;
  let client: Client | undefined;
  afterEach(async () => { await client?.close(); await server?.close(); client = undefined; server = undefined; });

  async function connect(item = makeItem()) {
    const config = { ...DEFAULT_CONFIG, site: { name: "Test", hostnames: ["shop.example.test"] } };
    server = createCatalogMcpServer(new Map([["parts", makeProvider(item)]]), new Map([["parts", { config, routes: [publicRoute] }]]));
    client = new Client({ name: "handoff-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    return client;
  }

  it("toolReturnsExactSelectedEntity", async () => {
    const connected = await connect();
    const result = await connected.callTool({ name: "resolve_item_page", arguments: { catalogId: "parts", id: "sku:1" } });
    expect(result.structuredContent).toMatchObject({
      status: "pending",
      request: { entityId: "sku:1", canonicalUrl: "https://shop.example.test/products/1", preferredPresentation: "current-agent-app" },
    });
  });

  it("toolDoesNotReturnMarkdownAlternate", async () => {
    const connected = await connect();
    const result = await connected.callTool({ name: "resolve_item_page", arguments: { catalogId: "parts", id: "sku:1" } });
    expect(JSON.stringify(result.structuredContent)).not.toContain(".md");
    expect(JSON.stringify(result.structuredContent)).toContain("/products/1");
  });

  it("toolRejectsInvalidDestination", async () => {
    const connected = await connect(makeItem("https://evil.test/products/1"));
    const result = await connected.callTool({ name: "resolve_item_page", arguments: { catalogId: "parts", id: "sku:1" } });
    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.structuredContent ?? {})).not.toContain("evil.test");
  });

  it("toolDoesNotClaimNavigation", async () => {
    const connected = await connect();
    const result = await connected.callTool({ name: "resolve_item_page", arguments: { catalogId: "parts", id: "sku:1" } });
    const data = result.structuredContent as Record<string, unknown>;
    expect(data.status).toBe("pending");
    expect(data).not.toHaveProperty("openedUrl");
    expect((await connected.listTools()).tools.map((tool) => tool.name)).toContain("resolve_item_page");
  });
});
