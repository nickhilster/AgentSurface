import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runInit } from "./init.js";

describe("init", () => {
  let repoRoot = "";
  afterEach(() => { if (repoRoot) rmSync(repoRoot, { recursive: true, force: true }); });

  it("initDoesNotOverwriteExistingConfig", () => {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-init-test-"));
    const configPath = join(repoRoot, ".agentsurface", "config.yaml");
    const existing = "version: '0.1'\nsite:\n  name: hand edited\n";
    mkdirSync(join(repoRoot, ".agentsurface"), { recursive: true });
    writeFileSync(configPath, existing);

    expect(() => runInit({ repoRoot })).toThrow(/does not overwrite/i);
    expect(readFileSync(configPath, "utf-8")).toBe(existing);
    expect(existsSync(configPath)).toBe(true);
  });

  it("rejects an invalid hostname before writing config", () => {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-init-host-test-"));
    expect(() => runInit({ repoRoot, hostnames: ["https://example.com/path"] })).toThrow(/site\.hostnames/);
    expect(existsSync(join(repoRoot, ".agentsurface", "config.yaml"))).toBe(false);
  });
});
