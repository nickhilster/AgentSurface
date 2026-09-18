import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ownershipHeader, writeOwned } from "./ownership.js";

describe("writeOwned", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "agentsurface-ownership-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes a new file that does not exist yet", () => {
    const target = join(dir, "out.md");
    const result = writeOwned(target, ownershipHeader("model.json") + "content", false);
    expect(result).toEqual({ written: true, conflict: false });
    expect(readFileSync(target, "utf-8")).toContain("content");
  });

  it("overwrites a file that carries AgentSurface's own ownership header", () => {
    const target = join(dir, "out.md");
    writeFileSync(target, ownershipHeader("model.json") + "old content", "utf-8");
    const result = writeOwned(target, ownershipHeader("model.json") + "new content", false);
    expect(result).toEqual({ written: true, conflict: false });
    expect(readFileSync(target, "utf-8")).toContain("new content");
  });

  it("refuses to overwrite a pre-existing file with no AgentSurface ownership header", () => {
    const target = join(dir, "out.md");
    writeFileSync(target, "# Hand-authored content\nDo not touch.\n", "utf-8");
    const result = writeOwned(target, ownershipHeader("model.json") + "generated content", false);
    expect(result).toEqual({ written: false, conflict: true });
    expect(readFileSync(target, "utf-8")).toBe("# Hand-authored content\nDo not touch.\n");
  });

  it("overwrites a non-owned file when overwriteHumanOwned is explicitly set", () => {
    const target = join(dir, "out.md");
    writeFileSync(target, "hand-authored", "utf-8");
    const result = writeOwned(target, ownershipHeader("model.json") + "generated", true);
    expect(result).toEqual({ written: true, conflict: false });
    expect(readFileSync(target, "utf-8")).toContain("generated");
  });
});
