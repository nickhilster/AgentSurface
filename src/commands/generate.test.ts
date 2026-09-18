import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeConfig } from "../config.js";
import { writeModelMeta } from "../lib/modelVersion.js";
import { DEFAULT_CONFIG } from "../types/config.js";
import type { CapabilityRecord, CanonicalSiteModel, RouteRecord } from "../types/model.js";
import { runGenerate } from "./generate.js";

/**
 * Regression tests for the Phase 0 correctness debt recorded in
 * docs/PLAN-v1-product.md §1. generate.ts had zero test coverage before this file, per
 * §1's own diagnosis of why these defects survived the v0.1 dogfood run.
 */
describe("runGenerate", () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-generate-test-"));
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  function setUpConfig(overrides: Partial<typeof DEFAULT_CONFIG> = {}) {
    writeConfig(repoRoot, {
      ...DEFAULT_CONFIG,
      site: { name: "Test Site", hostnames: [] },
      ...overrides,
    });
  }

  function setUpModel(routes: RouteRecord[], capabilities: CapabilityRecord[] = []) {
    const modelDir = join(repoRoot, ".agentsurface", "model");
    mkdirSync(modelDir, { recursive: true });
    const model: CanonicalSiteModel = {
      version: "0.1",
      generatedAt: new Date().toISOString(),
      site: { name: "Test Site", framework: "next-app-router", frameworkConfidence: 1, rootDir: repoRoot, hostnames: [] },
      routes,
      entities: [],
      capabilities,
      constraints: [],
      provenance: [],
      unknowns: [],
    };
    writeModelMeta(repoRoot, model);
    writeFileSync(join(modelDir, "routes.json"), JSON.stringify(routes, null, 2), "utf-8");
    writeFileSync(join(modelDir, "capabilities.json"), JSON.stringify(capabilities, null, 2), "utf-8");
  }

  function publicRoute(path: string, overrides: Partial<RouteRecord> = {}): RouteRecord {
    return {
      path,
      classification: "public-static",
      contentType: "page",
      sourceFiles: [`app${path === "/" ? "" : path}/page.tsx`],
      agentReadableAlternate: null,
      canonicalUrl: null,
      dynamicSegments: [],
      redirectsTo: null,
      contentBoundaryTag: "main",
      provenance: [],
      confidence: 1.0,
      ...overrides,
    };
  }

  function mockFetchOk(html: string) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(html, { status: 200 }))
    );
  }

  const PAGE_HTML = "<html><body><main><h1>About</h1><p>Hello.</p></main></body></html>";

  // --- §1.1: no hardcoded, site-specific claims ---

  it("does not emit a hardcoded /api/values claim when the model has no capabilities", async () => {
    setUpConfig();
    setUpModel([publicRoute("/about")]);
    mockFetchOk(PAGE_HTML);

    await runGenerate({ repoRoot, serverBaseUrl: "http://localhost:3000" });

    const llmsTxt = readFileSync(join(repoRoot, "public", "llms.txt"), "utf-8");
    expect(llmsTxt).not.toContain("/api/values");
    expect(llmsTxt).not.toContain("## Structured data");
  });

  it("derives structured-data entries from real CapabilityRecords when present", async () => {
    setUpConfig();
    const capability: CapabilityRecord = {
      name: "Site search",
      description: "Full-text search API",
      kind: "readable",
      backingImplementation: "/api/search",
      authRequired: false,
      sideEffects: false,
      constraints: [],
      provenance: [],
      confidence: 1.0,
    };
    setUpModel([publicRoute("/about")], [capability]);
    mockFetchOk(PAGE_HTML);

    await runGenerate({ repoRoot, serverBaseUrl: "http://localhost:3000" });

    const llmsTxt = readFileSync(join(repoRoot, "public", "llms.txt"), "utf-8");
    expect(llmsTxt).toContain("/api/search");
    expect(llmsTxt).toContain("Site search");
  });

  // --- §1.2: llms.txt honours ownership ---

  it("refuses to overwrite a pre-existing, non-AgentSurface-owned llms.txt", async () => {
    setUpConfig();
    setUpModel([publicRoute("/about")]);
    mockFetchOk(PAGE_HTML);

    const publicDir = join(repoRoot, "public");
    mkdirSync(publicDir, { recursive: true });
    const handAuthored = "# My hand-written llms.txt\n\nDo not touch.\n";
    writeFileSync(join(publicDir, "llms.txt"), handAuthored, "utf-8");

    const result = await runGenerate({ repoRoot, serverBaseUrl: "http://localhost:3000" });

    expect(result.llmsTxt).toEqual({ written: false, conflict: true });
    expect(readFileSync(join(publicDir, "llms.txt"), "utf-8")).toBe(handAuthored);
  });

  // --- §1.3: config.output.dir is honoured ---

  it("writes llms.txt under config.output.dir instead of a hardcoded public/", async () => {
    setUpConfig({ output: { dir: "static" } });
    setUpModel([publicRoute("/about")]);
    mockFetchOk(PAGE_HTML);

    await runGenerate({ repoRoot, serverBaseUrl: "http://localhost:3000" });

    expect(existsSync(join(repoRoot, "static", "llms.txt"))).toBe(true);
    expect(existsSync(join(repoRoot, "public", "llms.txt"))).toBe(false);
  });

  // --- §1.6: infra-missing is fatal; modeled skips are not ---

  it("exits with an error when the server cannot be reached for any candidate route", async () => {
    setUpConfig();
    setUpModel([publicRoute("/about")]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    await expect(runGenerate({ repoRoot, serverBaseUrl: "http://localhost:3000" })).rejects.toThrow(/could not be reached/i);
  });

  it("does not throw when every route is legitimately skipped for a modeled reason", async () => {
    setUpConfig();
    setUpModel([publicRoute("/products/[slug]", { dynamicSegments: ["slug"], contentBoundaryTag: null })]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("should not be called");
      })
    );

    const result = await runGenerate({ repoRoot, serverBaseUrl: "http://localhost:3000" });
    expect(result.generated).toEqual([]);
    expect(result.skipped[0].fatal).toBe(false);
  });

  // --- §1.7: spec-conformant llms.txt ---

  it("emits llmstxt.org v2 format, not AgentSurface's own invented 'Markdown:' suffix", async () => {
    setUpConfig();
    setUpModel([publicRoute("/about")]);
    mockFetchOk(PAGE_HTML);

    await runGenerate({ repoRoot, serverBaseUrl: "http://localhost:3000" });

    const llmsTxt = readFileSync(join(repoRoot, "public", "llms.txt"), "utf-8");
    expect(llmsTxt).not.toContain("Markdown:");
    expect(llmsTxt).toMatch(/-\s\[about]\(\/about\.md\)/);
  });

  // --- §1.8: model version is checked before use ---

  it("refuses to run against a model with no version metadata", async () => {
    setUpConfig();
    const modelDir = join(repoRoot, ".agentsurface", "model");
    mkdirSync(modelDir, { recursive: true });
    writeFileSync(join(modelDir, "routes.json"), JSON.stringify([publicRoute("/about")]), "utf-8");
    // Deliberately no meta.json written.

    await expect(runGenerate({ repoRoot, serverBaseUrl: "http://localhost:3000" })).rejects.toThrow(/agentsurface inspect/i);
  });
});
