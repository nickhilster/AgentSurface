import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeConfig } from "../config.js";
import { runCatalogManifest } from "./catalogManifest.js";
import { writeModelMeta } from "../lib/modelVersion.js";
import { DEFAULT_CONFIG } from "../types/config.js";
import type { CatalogRecord } from "../types/model.js";

const catalog: CatalogRecord = {
  id: "parts", entityKind: "product", scope: "public", source: { kind: "openapi", file: "openapi.yaml" },
  searchOperation: "searchParts", detailOperation: "getPart", canonicalRoute: "/parts/{id}",
  fields: [{ name: "price", type: "number", filterable: true, sortable: false, operators: ["lte"], unit: "CAD" }],
  searchMode: "read-api", supportsQuery: false, supportsSorting: false, supportsPagination: true,
  maxResults: 15, freshness: { class: "unknown" }, provenance: [],
};

describe("public catalog manifest", () => {
  let repoRoot = "";
  afterEach(() => { if (repoRoot) rmSync(repoRoot, { recursive: true, force: true }); });

  function setup(catalogs: CatalogRecord[] = [catalog]) {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-catalog-manifest-"));
    writeConfig(repoRoot, { ...DEFAULT_CONFIG, site: { name: "Test", hostnames: [] }, output: { dir: "public", markdownDir: undefined } });
    const modelDir = join(repoRoot, ".agentsurface", "model");
    mkdirSync(modelDir, { recursive: true });
    writeModelMeta(repoRoot, {
      version: "0.2", generatedAt: new Date().toISOString(), site: { name: "Test", framework: "unknown", frameworkConfidence: 0, rootDir: repoRoot, hostnames: [] },
      routes: [], entities: [], catalogs, capabilities: [], constraints: [], provenance: [], unknowns: [],
    });
    writeFileSync(join(modelDir, "catalogs.json"), JSON.stringify(catalogs));
  }

  it("manifestListsOnlyAllowlistedCatalogFields", () => {
    setup([
      catalog,
      { ...catalog, id: "private", scope: "unknown", fields: [{ name: "secret", type: "string", filterable: true, sortable: false, operators: ["eq"] }] },
    ]);
    const result = runCatalogManifest(repoRoot);
    expect(result.manifest.catalogs).toHaveLength(1);
    expect(result.manifest.catalogs[0].search.fields).toEqual([{ name: "price", type: "number", filterable: true, sortable: false, operators: ["lte"], unit: "CAD" }]);
    const saved = JSON.parse(readFileSync(result.path, "utf-8"));
    expect(saved._agentSurface.generatedBy).toBe("AgentSurface");
  });

  it("manifestHasCanonicalDestinationRule", () => {
    setup();
    const result = runCatalogManifest(repoRoot);
    expect(result.manifest.catalogs[0].itemPage).toEqual({ routeTemplate: "/parts/{id}", origin: "same-origin", pageKind: "canonical-html" });
    expect(result.manifest.catalogs[0].search.readOnly).toBe(true);
    expect(result.path.endsWith(join("public", ".well-known", "agentsurface.json"))).toBe(true);
  });

  it("leavesHumanOwnedManifestUntouched", () => {
    setup();
    const target = join(repoRoot, "public", ".well-known", "agentsurface.json");
    mkdirSync(join(repoRoot, "public", ".well-known"), { recursive: true });
    writeFileSync(target, "{\"owner\":\"human\"}\n", "utf-8");
    const result = runCatalogManifest(repoRoot);
    expect(result.conflict).toBe(true);
    expect(JSON.parse(readFileSync(target, "utf-8"))).toEqual({ owner: "human" });
  });
});
