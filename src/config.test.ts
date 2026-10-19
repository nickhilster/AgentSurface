import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig, writeConfig } from "./config.js";
import { DEFAULT_CONFIG } from "./types/config.js";

describe("AgentSurface output configuration", () => {
  let repoRoot = "";
  afterEach(() => { if (repoRoot) rmSync(repoRoot, { recursive: true, force: true }); });

  it("keeps public Markdown output optional for existing targets", () => {
    expect(DEFAULT_CONFIG.output.markdownDir).toBeUndefined();
  });

  it("loads an explicitly configured public Markdown directory", () => {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-config-test-"));
    writeConfig(repoRoot, { ...DEFAULT_CONFIG, output: { dir: "public", markdownDir: "public/agentsurface/pages" } });
    expect(loadConfig(repoRoot).output).toEqual({ dir: "public", markdownDir: "public/agentsurface/pages" });
  });

  it("loadConfigDefaultsExistingFields", () => {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-config-legacy-"));
    mkdirSync(join(repoRoot, ".agentsurface"), { recursive: true });
    writeFileSync(join(repoRoot, ".agentsurface", "config.yaml"), JSON.stringify({
      version: "0.1",
      site: { name: "Legacy", hostnames: [] },
    }));

    const config = loadConfig(repoRoot);
    expect(config.output.dir).toBe("public");
    expect(config.routes.exclude).toEqual([]);
    expect(config.ownership.overwriteHumanOwned).toBe(false);
  });

  it("loadConfigRejectsInvalidPathOrHostname", () => {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-config-invalid-"));
    mkdirSync(join(repoRoot, ".agentsurface"), { recursive: true });
    writeFileSync(join(repoRoot, ".agentsurface", "config.yaml"), JSON.stringify({
      version: "0.1",
      site: { name: "Bad", hostnames: ["https://example.com/private"] },
      output: { dir: "../outside" },
    }));

    expect(() => loadConfig(repoRoot)).toThrow(/output\.dir|site\.hostnames/);
  });

  it("loadConfigValidatesRouteOverrides", () => {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-config-overrides-"));
    mkdirSync(join(repoRoot, ".agentsurface"), { recursive: true });
    writeFileSync(join(repoRoot, ".agentsurface", "config.yaml"), JSON.stringify({
      version: "0.1",
      routes: { overrides: [{ path: "relative/path", classification: "public" }] },
    }));

    expect(() => loadConfig(repoRoot)).toThrow(/routes\.overrides/);

    writeFileSync(join(repoRoot, ".agentsurface", "config.yaml"), JSON.stringify({
      version: "0.1",
      routes: { overrides: [{ path: "/about", classification: "public-static", contentBoundaryTag: "main", confidence: 1 }] },
    }));
    expect(() => loadConfig(repoRoot)).toThrow(/confidence/);
  });

  it("normalizes hostname casing and loads valid owner route overrides", () => {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-config-valid-overrides-"));
    mkdirSync(join(repoRoot, ".agentsurface"), { recursive: true });
    writeFileSync(join(repoRoot, ".agentsurface", "config.yaml"), JSON.stringify({
      version: "0.1",
      site: { name: "Test", hostnames: ["EXAMPLE.COM."] },
      routes: { overrides: [{ path: "/about", classification: "public-static", contentBoundaryTag: "main" }] },
    }));

    const config = loadConfig(repoRoot);
    expect(config.site.hostnames).toEqual(["example.com"]);
    expect(config.routes.overrides).toEqual([{ path: "/about", classification: "public-static", contentBoundaryTag: "main" }]);
  });

  it("configAllowsExplicitPublicCatalog", () => {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-config-catalog-valid-"));
    mkdirSync(join(repoRoot, ".agentsurface"), { recursive: true });
    writeFileSync(join(repoRoot, ".agentsurface", "config.yaml"), JSON.stringify({
      version: "0.1",
      catalogs: [{
        id: "parts", entityKind: "product", scope: "public",
        source: { kind: "openapi", file: "openapi.yaml" },
        searchOperation: "searchParts", detailOperation: "getPart",
        fieldAllowlist: [{ name: "price", sourceField: "price", type: "number", operators: ["eq", "lte"] }],
        canonicalRoute: "/parts/{id}", maxResults: 12, freshness: { class: "unknown" },
      }],
    }));
    expect(loadConfig(repoRoot).catalogs[0]).toMatchObject({ id: "parts", scope: "public", maxResults: 12 });
  });

  it("configRejectsMissingSourceContract", () => {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-config-catalog-source-"));
    mkdirSync(join(repoRoot, ".agentsurface"), { recursive: true });
    writeFileSync(join(repoRoot, ".agentsurface", "config.yaml"), JSON.stringify({
      version: "0.1", catalogs: [{ id: "parts", entityKind: "product", scope: "public" }],
    }));
    expect(() => loadConfig(repoRoot)).toThrow(/catalogs\[0\]\.source/);
  });

  it("configRejectsPrivateOrUnallowlistedFields", () => {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-config-catalog-unsafe-"));
    mkdirSync(join(repoRoot, ".agentsurface"), { recursive: true });
    writeFileSync(join(repoRoot, ".agentsurface", "config.yaml"), JSON.stringify({
      version: "0.1", catalogs: [{
        id: "parts", entityKind: "product", scope: "private",
        source: { kind: "openapi", file: "openapi.yaml" },
        searchOperation: "searchParts", detailOperation: "getPart",
        fieldAllowlist: [{ name: "secret", sourceField: "secret", type: "string", operators: ["contains"] }],
        canonicalRoute: "/parts/{id}", maxResults: 10, freshness: { class: "unknown" }, token: "secret",
      }],
    }));
    expect(() => loadConfig(repoRoot)).toThrow(/catalogs\[0\]\.(scope|token)/);
  });

  it("rejectsUnsupportedCatalogOperatorsAndFieldProperties", () => {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-config-catalog-fields-"));
    mkdirSync(join(repoRoot, ".agentsurface"), { recursive: true });
    const config = {
      version: "0.1", catalogs: [{
        id: "parts", entityKind: "product", scope: "public",
        source: { kind: "openapi", file: "openapi.yaml" }, searchOperation: "searchParts", detailOperation: "getPart",
        fieldAllowlist: [{ name: "name", sourceField: "name", type: "string", operators: ["regex"] }],
        canonicalRoute: "/parts/{id}", maxResults: 10, freshness: { class: "unknown" },
      }],
    };
    writeFileSync(join(repoRoot, ".agentsurface", "config.yaml"), JSON.stringify(config));
    expect(() => loadConfig(repoRoot)).toThrow(/fieldAllowlist\[0\]\.operators/);
    (config.catalogs[0].fieldAllowlist[0] as Record<string, unknown>).isPrivate = true;
    (config.catalogs[0].fieldAllowlist[0] as Record<string, unknown>).operators = ["eq"];
    writeFileSync(join(repoRoot, ".agentsurface", "config.yaml"), JSON.stringify(config));
    expect(() => loadConfig(repoRoot)).toThrow(/fieldAllowlist\[0\]\.isPrivate/);
  });

  it("legacyConfigStillLoads", () => {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-config-catalog-legacy-"));
    mkdirSync(join(repoRoot, ".agentsurface"), { recursive: true });
    writeFileSync(join(repoRoot, ".agentsurface", "config.yaml"), JSON.stringify({ version: "0.1", site: { name: "Legacy" } }));
    expect(loadConfig(repoRoot).catalogs).toEqual([]);
  });
});
