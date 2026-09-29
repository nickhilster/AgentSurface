import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ViteStaticAdapter } from "./viteStatic.js";

describe("ViteStaticAdapter", () => {
  let repoRoot: string;
  const adapter = new ViteStaticAdapter();

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-vite-test-"));
    writeFile("vite.config.ts", "export default {};");
    writeFile("package.json", JSON.stringify({ devDependencies: { vite: "^6.0.0" } }));
  });

  afterEach(() => rmSync(repoRoot, { recursive: true, force: true }));

  function writeFile(relPath: string, content: string) {
    const abs = join(repoRoot, relPath);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, content, "utf-8");
  }

  it("detects Vite from project config and package metadata", async () => {
    const detection = await adapter.detect({ rootDir: repoRoot });
    expect(detection).toEqual({ framework: "vite-static", confidence: 1, evidence: ["vite.config.ts", "package.json"] });
  });

  it("discovers a static page and records its HTML source and main boundary", async () => {
    writeFile("public/about/index.html", "<title>About</title><main>About us</main>");
    const route = (await adapter.inspectRoutes({ rootDir: repoRoot })).find((r) => r.path === "/about/");
    expect(route?.sourceFiles).toEqual(["public/about/index.html"]);
    expect(route?.contentBoundaryTag).toBe("main");
    expect(route?.surfaceType).toBe("static-content");
  });

  it("marks a soft-gated static page human-gated without exposing its main body", async () => {
    writeFile("public/private/index.html", "<main><h1>Private</h1></main><script src='/shared/soft-gate.js'></script>");
    const route = (await adapter.inspectRoutes({ rootDir: repoRoot })).find((r) => r.path === "/private/");
    expect(route?.classification).toBe("public-static");
    expect(route?.surfaceType).toBe("human-gated");
    expect(route?.contentBoundaryTag).toBeNull();
  });

  it("discovers only literal React route branches and excludes query modes and dev paths", async () => {
    writeFile("src/App.tsx", `const pathname = window.location.pathname;\nif (capture) return <Capture />;\nif (pathname === '/free-boardy') return <FreeBoardy />;\nif (pathname === '/meet-side-panel') return <MeetSidePanel />;\n`);
    const routes = await adapter.inspectRoutes({ rootDir: repoRoot });
    expect(routes.map((r) => r.path)).toContain("/free-boardy");
    expect(routes.map((r) => r.path)).toContain("/meet-side-panel");
    expect(routes.map((r) => r.path)).not.toContain("/?capture=1");
    expect(routes.map((r) => r.path)).not.toContain("/.figma/make/kit.html");
    expect(routes.find((r) => r.path === "/meet-side-panel")?.surfaceType).toBe("interactive");
  });

  it("gives a static HTML route precedence over a duplicate React route", async () => {
    writeFile("public/free-boardy/index.html", "<main>static page</main>");
    writeFile("src/App.tsx", `if (pathname === '/free-boardy') return <FreeBoardy />;`);
    const routes = await adapter.inspectRoutes({ rootDir: repoRoot });
    expect(routes.filter((r) => r.path === "/free-boardy/")).toHaveLength(1);
    expect(routes.find((r) => r.path === "/free-boardy/")?.sourceFiles).toEqual(["public/free-boardy/index.html"]);
  });
});
