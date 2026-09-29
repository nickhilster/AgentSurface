import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import type { DetectionResult, FrameworkAdapter, RepoContext, RouteRecord } from "../types/model.js";

/** Deterministic discovery for Vite sites with public HTML and literal pathname branches. */
export class ViteStaticAdapter implements FrameworkAdapter {
  readonly name = "vite-static";

  async detect(repo: RepoContext): Promise<DetectionResult> {
    const config = ["vite.config.ts", "vite.config.js", "vite.config.mjs", "vite.config.mts", "vite.config.cts"]
      .find((file) => existsSync(join(repo.rootDir, file)));
    let hasViteDependency = false;
    try {
      const pkg = JSON.parse(readFileSync(join(repo.rootDir, "package.json"), "utf-8"));
      hasViteDependency = Boolean(pkg.dependencies?.vite || pkg.devDependencies?.vite || pkg.peerDependencies?.vite);
    } catch { /* a missing package file is not detection evidence */ }
    const evidence = [config, hasViteDependency ? "package.json" : null].filter((x): x is string => x !== null);
    if (config && hasViteDependency) return { framework: this.name, confidence: 1, evidence };
    if (config || hasViteDependency) return { framework: this.name, confidence: 0.5, evidence };
    return { framework: "unknown", confidence: 0, evidence: [] };
  }

  async inspectRoutes(repo: RepoContext): Promise<RouteRecord[]> {
    const routes = new Map<string, RouteRecord>();
    const publicDir = join(repo.rootDir, "public");
    if (existsSync(publicDir)) {
      walkHtml(publicDir, (file) => {
        if (!file.endsWith("index.html")) return;
        const source = relative(repo.rootDir, file).split(sep).join("/");
        const folder = relative(publicDir, join(file, ".." )).split(sep).join("/");
        const path = folder === "." ? "/" : `/${folder}/`;
        if (path.startsWith("/.figma/")) return;
        const html = safeRead(file);
        const gated = /\/shared\/soft-gate\.js(?:["'?\s>]|$)/i.test(html);
        routes.set(normalizePath(path), makeRoute(path, source, gated ? "human-gated" : "static-content", gated ? null : /<main[\s>]/i.test(html) ? "main" : null));
      });
    }

    const appFile = join(repo.rootDir, "src", "App.tsx");
    if (existsSync(appFile)) {
      const source = safeRead(appFile);
      for (const match of source.matchAll(/if\s*\(\s*pathname\s*===\s*["']([^"']+)["']\s*\)\s*\{?\s*return\s*<([A-Za-z_$][\w$]*)\b/g)) {
        const path = normalizePath(match[1]);
        if (path.startsWith("/.figma/") || path.includes("?")) continue;
        const route = makeRoute(path, "src/App.tsx", "interactive", null);
        // Static public files take precedence because Vite/Vercel serves them before the SPA rewrite.
        if (!routes.has(normalizePath(path))) routes.set(normalizePath(path), route);
      }
      if (/return\s*<Story\s*\/>/.test(source) && !routes.has("/")) {
        routes.set("/", makeRoute("/", "src/App.tsx", "interactive", null));
      }
    }
    return [...routes.values()].sort((a, b) => a.path.localeCompare(b.path));
  }
}

function makeRoute(path: string, source: string, surfaceType: NonNullable<RouteRecord["surfaceType"]>, contentBoundaryTag: string | null): RouteRecord {
  return {
    path,
    classification: "public-static",
    contentType: "page",
    sourceFiles: [source],
    agentReadableAlternate: null,
    canonicalUrl: null,
    dynamicSegments: [],
    redirectsTo: null,
    contentBoundaryTag,
    provenance: [{ subject: `route:${path}`, claim: `surface:${surfaceType}`, source, method: "framework-route-parser", confidence: 1 }],
    confidence: 1,
    surfaceType,
    accessRequirements: [],
  };
}

function normalizePath(path: string): string {
  if (path === "/") return path;
  return `/${path.replace(/^\/+|\/+$/g, "")}`;
}

function walkHtml(dir: string, visit: (file: string) => void): void {
  for (const name of readdirSync(dir)) {
    const file = join(dir, name);
    const stat = statSync(file);
    if (stat.isDirectory()) walkHtml(file, visit);
    else if (stat.isFile()) visit(file);
  }
}

function safeRead(path: string): string {
  try { return readFileSync(path, "utf-8"); } catch { return ""; }
}
