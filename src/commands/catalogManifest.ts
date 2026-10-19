import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { loadConfig } from "../config.js";
import { assertModelVersion, MODEL_VERSION } from "../lib/modelVersion.js";
import { writeOwned } from "../lib/ownership.js";
import type { CatalogRecord } from "../types/model.js";

export interface CatalogManifestCatalog {
  id: string;
  entityKind: CatalogRecord["entityKind"];
  searchMode: "static-index" | "read-api";
  search: {
    readOnly: true;
    query: boolean;
    fields: Array<{ name: string; type: CatalogRecord["fields"][number]["type"]; filterable: boolean; sortable: boolean; operators: string[]; unit?: string }>;
    maxResults: number;
    pagination: boolean;
    sorting: boolean;
    freshness: CatalogRecord["freshness"];
  };
  itemPage: { routeTemplate: string; origin: "same-origin"; pageKind: "canonical-html" };
  marketPolicy: { allowedMarkets: string[]; locationRequired: boolean } | null;
}

export interface CatalogManifest {
  _agentSurface: { generatedBy: "AgentSurface"; modelVersion: typeof MODEL_VERSION };
  schemaVersion: "1";
  generatedAt: string;
  provenancePolicy: string;
  catalogs: CatalogManifestCatalog[];
}

export interface CatalogManifestResult {
  path: string;
  written: boolean;
  conflict: boolean;
  manifest: CatalogManifest;
}

export function projectCatalogManifest(catalogs: CatalogRecord[], generatedAt = new Date().toISOString()): CatalogManifest {
  return {
    _agentSurface: { generatedBy: "AgentSurface", modelVersion: MODEL_VERSION },
    schemaVersion: "1",
    generatedAt,
    provenancePolicy: "Every item result includes source provenance and freshness. Missing dynamic values remain unknown. Static index data is not live inventory.",
    catalogs: catalogs.filter((catalog) => catalog.scope === "public" && catalog.searchMode !== "none").map((catalog) => ({
      id: catalog.id,
      entityKind: catalog.entityKind,
      searchMode: catalog.searchMode as "static-index" | "read-api",
      search: {
        readOnly: true,
        query: catalog.supportsQuery,
        fields: catalog.fields.map((field) => ({
          name: field.name, type: field.type, filterable: field.filterable, sortable: field.sortable,
          operators: [...field.operators], ...(field.unit ? { unit: field.unit } : {}),
        })),
        maxResults: Math.min(100, Math.max(1, catalog.maxResults)),
        pagination: catalog.supportsPagination,
        sorting: catalog.supportsSorting,
        freshness: catalog.freshness,
      },
      itemPage: { routeTemplate: catalog.canonicalRoute, origin: "same-origin", pageKind: "canonical-html" },
      marketPolicy: catalog.marketPolicy ?? null,
    })),
  };
}

export function runCatalogManifest(repoRoot: string): CatalogManifestResult {
  const config = loadConfig(repoRoot);
  assertModelVersion(repoRoot);
  const modelDir = join(repoRoot, ".agentsurface", "model");
  const catalogsPath = join(modelDir, "catalogs.json");
  if (!existsSync(catalogsPath)) throw new Error(`No catalog model found at ${catalogsPath}. Run "agentsurface inspect" first.`);
  const catalogs = JSON.parse(readFileSync(catalogsPath, "utf-8")) as CatalogRecord[];
  if (!Array.isArray(catalogs)) throw new Error(`Catalog model at ${catalogsPath} must contain an array.`);
  const manifest = projectCatalogManifest(catalogs);
  const path = join(repoRoot, config.output.dir, ".well-known", "agentsurface.json");
  assertOutputPathWithinRepo(repoRoot, path);
  const result = writeOwned(path, JSON.stringify(manifest, null, 2) + "\n", config.ownership.overwriteHumanOwned);
  return { path, ...result, manifest };
}

function assertOutputPathWithinRepo(repoRoot: string, path: string): void {
  const root = resolve(repoRoot);
  const target = resolve(path);
  const relativeTarget = relative(root, target);
  if (relativeTarget === ".." || relativeTarget.startsWith(`..${sep}`) || resolve(root, relativeTarget) !== target) {
    throw new Error("catalog manifest output path resolves outside the repository.");
  }
  const rootReal = resolveExisting(root);
  let current = root;
  for (const segment of relativeTarget.split(sep).slice(0, -1)) {
    current = join(current, segment);
    if (!existsSync(current)) continue;
    const real = resolveExisting(current);
    const relativeReal = relative(rootReal, real);
    if (relativeReal === ".." || relativeReal.startsWith(`..${sep}`) || resolve(rootReal, relativeReal) !== real) {
      throw new Error("catalog manifest output path traverses a symlink outside the repository.");
    }
  }
}

function resolveExisting(path: string): string {
  try { return realpathSync(path); } catch { return resolve(path); }
}
