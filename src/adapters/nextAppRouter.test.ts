import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextAppRouterAdapter } from "./nextAppRouter.js";

/**
 * These tests build a small synthetic Next.js app-router repo on disk, mirroring the
 * exact shape of the two real bugs found while dogfooding against teambotics-website:
 * (1) a nested "admin" path segment must not inherit the top-level /admin auth
 *     evidence it doesn't actually have, and (2) a content boundary defined in a
 *     shared shell component (not the page file itself) must still be found.
 */
describe("NextAppRouterAdapter", () => {
  let repoRoot: string;
  const adapter = new NextAppRouterAdapter();

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), "agentsurface-test-"));
    writeFileSync(join(repoRoot, "next.config.ts"), "export default {};\n");
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  function writeFile(relPath: string, content: string) {
    const abs = join(repoRoot, relPath);
    mkdirSync(join(abs, ".."), { recursive: true });
    writeFileSync(abs, content, "utf-8");
  }

  it("detects the next-app-router framework when config and app/ both exist", async () => {
    writeFile("app/page.tsx", "export default function Home() { return <div>hi</div>; }");
    const detection = await adapter.detect({ rootDir: repoRoot });
    expect(detection.framework).toBe("next-app-router");
    expect(detection.confidence).toBe(1.0);
  });

  it("classifies a top-level /admin/* route as authenticated only when the real login route exists", async () => {
    writeFile("app/admin/blog/page.tsx", "export default function P() { return <div />; }");
    writeFile("app/api/admin/login/route.ts", "export async function POST() {}");

    const routes = await adapter.inspectRoutes({ rootDir: repoRoot });
    const route = routes.find((r) => r.path === "/admin/blog");
    expect(route?.classification).toBe("authenticated");
    expect(route?.confidence).toBe(1.0);
  });

  it("does NOT classify a nested non-top-level admin path as authenticated just because /api/admin/login exists elsewhere", async () => {
    // Regression test for the real false-positive found dogfooding /poko/admin: it must not
    // borrow the top-level /admin auth evidence just because "admin" appears as some segment.
    writeFile(
      "app/poko/admin/page.tsx",
      `import type { Metadata } from "next";\nexport const metadata: Metadata = { robots: { index: false, follow: false } };\nexport default function P() { return <div />; }`
    );
    writeFile("app/api/admin/login/route.ts", "export async function POST() {}");

    const routes = await adapter.inspectRoutes({ rootDir: repoRoot });
    const route = routes.find((r) => r.path === "/poko/admin");
    expect(route?.classification).toBe("private-internal");
    expect(route?.confidence).toBe(0.7);
    expect(route?.classification).not.toBe("authenticated");
  });

  it("classifies a plain public page with no admin segment and no noindex as public-static at full confidence", async () => {
    writeFile("app/about/page.tsx", "export default function P() { return <main><p>hi</p></main>; }");
    const routes = await adapter.inspectRoutes({ rootDir: repoRoot });
    const route = routes.find((r) => r.path === "/about");
    expect(route?.classification).toBe("public-static");
    expect(route?.confidence).toBe(1.0);
  });

  it("marks a config-level redirect route with contentType redirect and does not fabricate a classification", async () => {
    writeFile("app/old-page/page.tsx", "export default function P() { return <div />; }");
    writeFile(
      "next.config.ts",
      `const nextConfig = { async redirects() { return [{ source: "/old-page", destination: "https://example.com", permanent: true }]; } }; export default nextConfig;\n`
    );

    const routes = await adapter.inspectRoutes({ rootDir: repoRoot });
    const route = routes.find((r) => r.path === "/old-page");
    expect(route?.contentType).toBe("redirect");
    expect(route?.redirectsTo).toBe("https://example.com");
  });

  it("finds a content boundary defined in a shared shell component via the layout chain, not just the page file", async () => {
    // Regression test for the real gap found dogfooding /poko: the <main> tag lived in
    // PokoShell.tsx, referenced from app/poko/layout.tsx, not in page.tsx itself.
    writeFile("components/shell/Shell.tsx", `export function Shell({ children }: any) { return <main>{children}</main>; }`);
    writeFile(
      "app/poko/layout.tsx",
      `import { Shell } from "@/components/shell/Shell";\nexport default function L({ children }: any) { return <Shell>{children}</Shell>; }`
    );
    writeFile("app/poko/page.tsx", "export default function P() { return <div>content, no main here directly</div>; }");

    const routes = await adapter.inspectRoutes({ rootDir: repoRoot });
    const route = routes.find((r) => r.path === "/poko");
    expect(route?.contentBoundaryTag).toBe("main");
  });

  it("leaves contentBoundaryTag null when no boundary exists anywhere in the layout chain, rather than guessing", async () => {
    writeFile("app/no-boundary/layout.tsx", `export default function L({ children }: any) { return <div>{children}</div>; }`);
    writeFile("app/no-boundary/page.tsx", "export default function P() { return <div>content</div>; }");

    const routes = await adapter.inspectRoutes({ rootDir: repoRoot });
    const route = routes.find((r) => r.path === "/no-boundary");
    expect(route?.contentBoundaryTag).toBeNull();
  });

  it("enumerates a dynamic [slug] segment and records it in dynamicSegments", async () => {
    writeFile("app/products/[slug]/page.tsx", "export default function P() { return <main />; }");
    const routes = await adapter.inspectRoutes({ rootDir: repoRoot });
    const route = routes.find((r) => r.path === "/products/[slug]");
    expect(route?.dynamicSegments).toEqual(["slug"]);
  });

  it("does not include app/api/** as page routes, and inspects them as capabilities instead", async () => {
    writeFile("app/api/values/route.ts", "export async function GET() { return new Response('{}'); }");
    const routes = await adapter.inspectRoutes({ rootDir: repoRoot });
    expect(routes.find((r) => r.path.includes("api"))).toBeUndefined();

    const capabilities = await adapter.inspectCapabilities!({ rootDir: repoRoot });
    const cap = capabilities.find((c) => c.name === "/api/values");
    expect(cap?.kind).toBe("readable");
    expect(cap?.authRequired).toBe(false);
  });

  it("marks app/api/admin/** capabilities as auth-required", async () => {
    writeFile("app/api/admin/login/route.ts", "export async function POST() { return new Response('{}'); }");
    const capabilities = await adapter.inspectCapabilities!({ rootDir: repoRoot });
    const cap = capabilities.find((c) => c.name === "/api/admin/login");
    expect(cap?.authRequired).toBe(true);
  });
});
