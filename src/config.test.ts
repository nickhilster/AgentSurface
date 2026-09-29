import { mkdtempSync, rmSync } from "node:fs";
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
});
