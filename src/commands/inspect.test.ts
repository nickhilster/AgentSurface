import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeConfig } from "../config.js";
import { DEFAULT_CONFIG } from "../types/config.js";
import { runInspect } from "./inspect.js";

describe("inspect owner route overrides", () => {
  let repoRoot = "";
  afterEach(() => { if (repoRoot) rmSync(repoRoot, { recursive: true, force: true }); });

  it("applies owner overrides with owner-declared provenance", async () => {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-inspect-overrides-"));
    writeFileSync(join(repoRoot, "vite.config.ts"), "export default {};");
    writeFileSync(join(repoRoot, "package.json"), JSON.stringify({ devDependencies: { vite: "^6.0.0" } }));
    mkdirSync(join(repoRoot, "public", "about"), { recursive: true });
    writeFileSync(join(repoRoot, "public", "about", "index.html"), "<h1>About</h1>");
    writeConfig(repoRoot, {
      ...DEFAULT_CONFIG,
      site: { name: "Test", hostnames: [] },
      routes: { exclude: [], overrides: [{ path: "/about", classification: "authenticated", contentBoundaryTag: "article" }] },
    });

    const model = await runInspect({ repoRoot });
    const route = model.routes.find((candidate) => candidate.path === "/about/");
    expect(route?.classification).toBe("authenticated");
    expect(route?.contentBoundaryTag).toBe("article");
    expect(route?.provenance).toContainEqual(expect.objectContaining({
      method: "owner-config",
      source: ".agentsurface/config.yaml:routes.overrides",
      confidence: 1,
    }));
  });
});
