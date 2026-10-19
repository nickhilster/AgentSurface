import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { writeConfig } from "../config.js";
import { MODEL_VERSION, writeModelMeta } from "../lib/modelVersion.js";
import { ownershipHeader } from "../lib/ownership.js";
import { DEFAULT_CONFIG } from "../types/config.js";
import type { CanonicalSiteModel, RouteRecord } from "../types/model.js";
import { runGenerate } from "./generate.js";
import { runDiff } from "./diff.js";

describe("runDiff", () => {
  let repoRoot = "";
  afterEach(() => { if (repoRoot) rmSync(repoRoot, { recursive: true, force: true }); vi.unstubAllGlobals(); });

  function setup() {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-diff-test-"));
    writeConfig(repoRoot, { ...DEFAULT_CONFIG, site: { name: "Test", hostnames: [] } });
    const route: RouteRecord = {
      path: "/about", classification: "public-static", contentType: "page", sourceFiles: ["app/about/page.tsx"],
      agentReadableAlternate: null, canonicalUrl: null, dynamicSegments: [], redirectsTo: null,
      contentBoundaryTag: "main", provenance: [], confidence: 1,
    };
    const model: CanonicalSiteModel = {
      version: MODEL_VERSION, generatedAt: new Date().toISOString(),
      site: { name: "Test", framework: "next-app-router", frameworkConfidence: 1, rootDir: repoRoot, hostnames: [] },
      routes: [route], entities: [], capabilities: [], constraints: [], provenance: [], unknowns: [],
    };
    mkdirSync(join(repoRoot, ".agentsurface", "model"), { recursive: true });
    writeModelMeta(repoRoot, model);
    writeFileSync(join(repoRoot, ".agentsurface", "model", "routes.json"), JSON.stringify([route]));
    writeFileSync(join(repoRoot, ".agentsurface", "model", "capabilities.json"), "[]");
  }

  it("diffDoesNotWriteFiles", async () => {
    setup();

    const result = await runDiff({ repoRoot });

    expect(result.changes.create.some((change) => change.path.endsWith("llms.txt"))).toBe(true);
    expect(result.changes.unchecked.some((change) => change.path.endsWith("about.md"))).toBe(true);
    expect(existsSync(join(repoRoot, "public", "llms.txt"))).toBe(false);
    expect(existsSync(join(repoRoot, ".agentsurface", "generated", "pages", "about.md"))).toBe(false);
  });

  it("diffReportsOwnedOutputUpdate", async () => {
    setup();
    mkdirSync(join(repoRoot, "public"), { recursive: true });
    writeFileSync(join(repoRoot, "public", "llms.txt"), ownershipHeader("old model") + "old", "utf-8");

    const result = await runDiff({ repoRoot });

    expect(result.changes.update.some((change) => change.path.endsWith("llms.txt"))).toBe(true);
  });

  it("diffReportsHumanOwnedConflict", async () => {
    setup();
    mkdirSync(join(repoRoot, "public"), { recursive: true });
    const file = join(repoRoot, "public", "llms.txt");
    const handAuthored = "# Human file\n";
    writeFileSync(file, handAuthored, "utf-8");

    const result = await runDiff({ repoRoot });

    expect(result.changes.conflict.some((change) => change.path === file)).toBe(true);
    expect(readFileSync(file, "utf-8")).toBe(handAuthored);
  });

  it("shares generated page projection with generate", async () => {
    setup();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<main><h1>About</h1></main>", { status: 200 })));

    const preview = await runDiff({ repoRoot, serverBaseUrl: "https://example.test" });
    expect(preview.changes.create.some((change) => change.path.endsWith("about.md"))).toBe(true);
    await runGenerate({ repoRoot, serverBaseUrl: "https://example.test" });
    const afterGenerate = await runDiff({ repoRoot, serverBaseUrl: "https://example.test" });

    expect(afterGenerate.changes.create).toEqual([]);
    expect(afterGenerate.changes.update).toEqual([]);
  });

  it("reports stale owned Markdown as a delete candidate without deleting it", async () => {
    setup();
    writeFileSync(join(repoRoot, ".agentsurface", "model", "routes.json"), "[]");
    const stalePath = join(repoRoot, ".agentsurface", "generated", "pages", "old.md");
    mkdirSync(join(stalePath, ".."), { recursive: true });
    writeFileSync(stalePath, ownershipHeader("old") + "Old content\n");

    const result = await runDiff({ repoRoot });

    expect(result.changes.delete.some((change) => change.path === stalePath)).toBe(true);
    expect(existsSync(stalePath)).toBe(true);
  });
});
