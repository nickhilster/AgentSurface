import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MODEL_VERSION, assertModelVersion, writeModelMeta } from "./modelVersion.js";
import type { CanonicalSiteModel } from "../types/model.js";

function fakeModel(): CanonicalSiteModel {
  return {
    version: MODEL_VERSION,
    generatedAt: new Date().toISOString(),
    site: { name: "Test", framework: "unknown", frameworkConfidence: 0, rootDir: "/", hostnames: [] },
    routes: [],
    entities: [],
    capabilities: [],
    constraints: [],
    provenance: [],
    unknowns: [],
  };
}

describe("model version guard", () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-modelversion-test-"));
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it("passes when meta.json matches the current model version", () => {
    writeModelMeta(repoRoot, fakeModel());
    expect(() => assertModelVersion(repoRoot)).not.toThrow();
  });

  it("throws an actionable error when no meta.json exists (model never inspected, or predates version tracking)", () => {
    expect(() => assertModelVersion(repoRoot)).toThrow(/agentsurface inspect/i);
  });

  it("throws an actionable error when meta.json records a different model version", () => {
    const modelDir = join(repoRoot, ".agentsurface", "model");
    mkdirSync(modelDir, { recursive: true });
    writeFileSync(join(modelDir, "meta.json"), JSON.stringify({ version: "9.9", generatedAt: new Date().toISOString() }), "utf-8");
    expect(() => assertModelVersion(repoRoot)).toThrow(/agentsurface inspect/i);
  });
});
