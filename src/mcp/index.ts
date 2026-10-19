#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { loadConfig } from "../config.js";
import { assertModelVersion } from "../lib/modelVersion.js";
import { bindOpenApiCatalogProvider } from "../catalog/providers/openApiCatalogProvider.js";
import { createStaticJsonLdCatalogProvider } from "../catalog/providers/staticJsonLdCatalogProvider.js";
import type { CatalogProvider } from "../catalog/types.js";
import type { CatalogRecord, EntityRecord, ProductRecord } from "../types/model.js";
import { createCatalogMcpServer } from "./server.js";

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const config = loadConfig(repoRoot);
  assertModelVersion(repoRoot);
  const modelDir = join(repoRoot, ".agentsurface", "model");
  const catalogsPath = join(modelDir, "catalogs.json");
  const entitiesPath = join(modelDir, "entities.json");
  if (!existsSync(catalogsPath) || !existsSync(entitiesPath)) throw new Error("Catalog model files are missing. Run agentsurface inspect first.");
  const catalogs = JSON.parse(readFileSync(catalogsPath, "utf-8")) as CatalogRecord[];
  const entities = JSON.parse(readFileSync(entitiesPath, "utf-8")) as EntityRecord[];
  if (!Array.isArray(catalogs) || !Array.isArray(entities)) throw new Error("Catalog model files are invalid. Run agentsurface inspect again.");
  const products = entities.filter((entity): entity is ProductRecord => entity.kind === "product");
  const providers = new Map<string, CatalogProvider>();
  for (const catalog of catalogs) {
    const declaration = config.catalogs.find((entry) => entry.id === catalog.id);
    if (!declaration || catalog.scope !== "public") continue;
    if (declaration.source.kind === "static-jsonld" && catalog.source.kind === "static-jsonld") {
      providers.set(catalog.id, createStaticJsonLdCatalogProvider(declaration, catalog, products));
    } else if (declaration.source.kind === "openapi" && catalog.source.kind === "openapi") {
      providers.set(catalog.id, await bindOpenApiCatalogProvider(repoRoot, config, catalog.id));
    }
  }
  if (providers.size === 0) throw new Error("No verified public catalogs are available. Run agentsurface inspect and configure a catalog first.");
  await serveStdio(() => createCatalogMcpServer(providers));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
