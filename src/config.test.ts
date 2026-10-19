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
});
