import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeConfig } from "../config.js";
import { writeModelMeta } from "../lib/modelVersion.js";
import { ownershipHeader } from "../lib/ownership.js";
import { DEFAULT_CONFIG } from "../types/config.js";
import type { CanonicalSiteModel, RouteRecord } from "../types/model.js";
import { runValidate } from "./validate.js";

/**
 * Regression tests for the Phase 0 correctness debt recorded in
 * docs/PLAN-v1-product.md §1. validate.ts had zero test coverage before this file.
 */
describe("runValidate", () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-validate-test-"));
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  function setUpConfig() {
    writeConfig(repoRoot, { ...DEFAULT_CONFIG, site: { name: "Test Site", hostnames: [] } });
  }

  const aboutRoute: RouteRecord = {
    path: "/about",
    classification: "public-static",
    contentType: "page",
    sourceFiles: ["app/about/page.tsx"],
    agentReadableAlternate: null,
    canonicalUrl: null,
    dynamicSegments: [],
    redirectsTo: null,
    contentBoundaryTag: "main",
    provenance: [],
    confidence: 1.0,
  };

  function setUpModel(routes: RouteRecord[]) {
    const modelDir = join(repoRoot, ".agentsurface", "model");
    mkdirSync(modelDir, { recursive: true });
    const model: CanonicalSiteModel = {
      version: "0.1",
      generatedAt: new Date().toISOString(),
      site: { name: "Test Site", framework: "next-app-router", frameworkConfidence: 1, rootDir: repoRoot, hostnames: [] },
      routes,
      entities: [],
      capabilities: [],
      constraints: [],
      provenance: [],
      unknowns: [],
    };
    writeModelMeta(repoRoot, model);
    writeFileSync(join(modelDir, "routes.json"), JSON.stringify(routes, null, 2), "utf-8");
    writeFileSync(join(modelDir, "capabilities.json"), "[]", "utf-8");
  }

  function setUpGeneratedPage(routePath: string, markdownBody: string) {
    const generatedDir = join(repoRoot, ".agentsurface", "generated", "pages");
    mkdirSync(generatedDir, { recursive: true });
    const file = join(generatedDir, (routePath === "/" ? "/index" : routePath) + ".md");
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, ownershipHeader(".agentsurface/model/routes.json") + markdownBody + "\n", "utf-8");
  }

  function setUpLlmsTxt(content: string) {
    const publicDir = join(repoRoot, "public");
    mkdirSync(publicDir, { recursive: true });
    writeFileSync(join(publicDir, "llms.txt"), content, "utf-8");
  }

  const MATCHING_HTML = "<html><body><main><h1>About</h1></main></body></html>";
  const MATCHING_MARKDOWN = "# About";

  function baseFixture() {
    setUpConfig();
    setUpModel([aboutRoute]);
    setUpGeneratedPage("/about", MATCHING_MARKDOWN);
    setUpLlmsTxt(`# Test Site\n\n- [About](/about.md)\n`);
  }

  // --- §1.4: silent passes on the states that matter most ---

  it("reports a drift failure, not a silent pass, when a live route now 404s/500s", async () => {
    baseFixture();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Not Found", { status: 404 })));

    const result = await runValidate({ repoRoot, serverBaseUrl: "http://localhost:3000" });

    expect(result.failures.some((f) => f.check === "drift" && f.path === "/about")).toBe(true);
    expect(result.unchecked.some((u) => u.path === "/about")).toBe(false);
  });

  it("reports a drift failure, not a silent pass, when the content boundary vanishes", async () => {
    baseFixture();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html><body>no boundary here</body></html>", { status: 200 })));

    const result = await runValidate({ repoRoot, serverBaseUrl: "http://localhost:3000" });

    expect(result.failures.some((f) => f.check === "drift" && f.path === "/about")).toBe(true);
  });

  it("reports an unreachable server as unchecked, not as a pass and not as a failure", async () => {
    baseFixture();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    const result = await runValidate({ repoRoot, serverBaseUrl: "http://localhost:3000" });

    expect(result.unchecked.some((u) => u.check === "drift" && u.path === "/about")).toBe(true);
    expect(result.failures.some((f) => f.path === "/about")).toBe(false);
  });

  it("passes cleanly when live content matches generated output exactly", async () => {
    baseFixture();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(MATCHING_HTML, { status: 200 })));

    const result = await runValidate({ repoRoot, serverBaseUrl: "http://localhost:3000" });

    expect(result.failures.some((f) => f.check === "drift")).toBe(false);
  });

  // --- §1.5: validate without --server must not silently report success ---

  it("fails when run with no --server and no explicit acknowledgement", async () => {
    baseFixture();

    const result = await runValidate({ repoRoot });

    expect(result.failures.some((f) => f.check === "drift" && f.path === "*")).toBe(true);
  });

  it("does not fail, but reports unchecked, when the operator explicitly acknowledges skipping drift checking", async () => {
    baseFixture();

    const result = await runValidate({ repoRoot, acknowledgeNoServer: true });

    expect(result.failures.some((f) => f.check === "drift" && f.path === "*")).toBe(false);
    expect(result.unchecked.some((u) => u.check === "drift" && u.path === "*")).toBe(true);
  });

  // --- §1.7: discovery integrity must parse spec-conformant llms.txt, not just AgentSurface's own format ---

  it("validates discovery links in a spec-conformant llms.txt that AgentSurface did not generate", async () => {
    setUpConfig();
    setUpModel([aboutRoute]);
    setUpGeneratedPage("/about", MATCHING_MARKDOWN);
    // No "Markdown:" suffix anywhere — a plain, hand-authored, llmstxt.org v2 file.
    setUpLlmsTxt(`# Test Site\n\n> A hand-written summary.\n\n## Docs\n\n- [About](/about.md): the about page\n`);

    const result = await runValidate({ repoRoot, acknowledgeNoServer: true });

    expect(result.checkedDiscoveryLinks).toBe(1);
    expect(result.failures.some((f) => f.check === "discovery-integrity")).toBe(false);
  });

  // --- §1.8: model version is checked before use ---

  it("refuses to run against a model written by a different model version", async () => {
    setUpConfig();
    const modelDir = join(repoRoot, ".agentsurface", "model");
    mkdirSync(modelDir, { recursive: true });
    writeFileSync(join(modelDir, "meta.json"), JSON.stringify({ version: "9.9", generatedAt: new Date().toISOString() }), "utf-8");
    writeFileSync(join(modelDir, "routes.json"), JSON.stringify([aboutRoute]), "utf-8");

    await expect(runValidate({ repoRoot, acknowledgeNoServer: true })).rejects.toThrow(/agentsurface inspect/i);
  });
});
