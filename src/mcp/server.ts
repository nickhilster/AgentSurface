import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod/v4";
import type { CatalogProvider, CatalogSearchResponse } from "../catalog/types.js";

const scalar = z.union([z.string().max(256), z.number().finite(), z.boolean()]);
const filter = z.object({
  field: z.string().min(1).max(63),
  operator: z.enum(["eq", "contains", "gt", "gte", "lt", "lte", "in"]),
  value: z.union([scalar, z.array(scalar).min(1).max(50)]),
});

export function createCatalogMcpServer(providers: Map<string, CatalogProvider>): McpServer {
  if (providers.size === 0) throw new Error("No verified public catalogs are available. Run agentsurface inspect and configure a catalog first.");
  const server = new McpServer({ name: "agentsurface-catalog", version: "0.2.0" });
  server.registerTool("search_catalog", {
    title: "Search public catalog",
    description: "Read-only search over an owner-verified public catalog. Results are bounded, preserve unknowns, include provenance and freshness, and link to the first-party item page.",
    inputSchema: z.object({
      catalogId: z.string().min(1).max(63),
      query: z.string().max(256).optional(),
      filters: z.array(filter).max(20).optional(),
      sort: z.object({ field: z.string().min(1).max(63), direction: z.enum(["asc", "desc"]) }).optional(),
      limit: z.number().int().min(1).max(100).default(10),
      cursor: z.string().max(2048).optional(),
      market: z.string().max(32).optional(),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ catalogId, query, filters, sort, limit, cursor, market }) => {
    const provider = providers.get(catalogId);
    if (!provider) return toolError(`Unknown or unavailable catalog "${catalogId}".`);
    try {
      const result = await provider.search({ query, filters, sort, limit, cursor, market });
      return structuredResult(result, result);
    } catch (error) {
      return toolError(error instanceof Error ? error.message : "Catalog search failed.");
    }
  });
  server.registerTool("get_catalog_item", {
    title: "Get public catalog item",
    description: "Read-only retrieval of one verified public catalog item, including its source provenance, freshness, and canonical first-party page destination.",
    inputSchema: z.object({ catalogId: z.string().min(1).max(63), id: z.string().min(1).max(256) }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  }, async ({ catalogId, id }) => {
    const provider = providers.get(catalogId);
    if (!provider) return toolError(`Unknown or unavailable catalog "${catalogId}".`);
    try {
      const item = await provider.getById(id);
      return item ? structuredResult({ item }, { item }) : toolError(`Catalog item "${id}" was not found.`);
    } catch (error) {
      return toolError(error instanceof Error ? error.message : "Catalog item retrieval failed.");
    }
  });
  return server;
}

function structuredResult(data: object, structuredContent: object) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
    structuredContent,
  };
}

function toolError(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export type { CatalogSearchResponse };
