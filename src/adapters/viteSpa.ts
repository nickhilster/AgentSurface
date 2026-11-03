import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import type {
  DetectionResult,
  FrameworkAdapter,
  ProvenanceRecord,
  RepoContext,
  RouteRecord,
} from "../types/model.js";

type StandalonePage = {
  path: string;
  componentName: string;
  componentFile: string | null;
};

/**
 * Adapter for Vite React SPAs that declare routes in a standalonePages map.
 * It only models explicit route definitions, never arbitrary rendered links.
 */
export class ViteSpaAdapter implements FrameworkAdapter {
  readonly name = "vite-react-spa";

  async detect(repo: RepoContext): Promise<DetectionResult> {
    const evidence: string[] = [];
    const packagePath = join(repo.rootDir, "package.json");
    const mainFile = findMainFile(repo.rootDir);
    const packageText = safeRead(packagePath);

    if (packageText) {
      try {
        const pkg = JSON.parse(packageText) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps.vite) evidence.push("package.json:vite");
        if (deps.react) evidence.push("package.json:react");
      } catch {
        // A malformed package file is not enough evidence for detection.
      }
    }

    if (mainFile) evidence.push(relative(repo.rootDir, mainFile).split(sep).join("/"));
    const mainText = mainFile ? safeRead(mainFile) : "";
    if (mainText.includes("standalonePages")) evidence.push("explicit standalonePages route map");

    const hasVite = evidence.includes("package.json:vite");
    const hasReact = evidence.includes("package.json:react");
    if (hasVite && hasReact && mainFile && mainText.includes("standalonePages")) {
      return { framework: this.name, confidence: 1.0, evidence };
    }
    if (hasVite && mainFile) return { framework: this.name, confidence: 0.5, evidence };
    return { framework: "unknown", confidence: 0, evidence: [] };
  }

  async inspectRoutes(repo: RepoContext): Promise<RouteRecord[]> {
    const mainFile = findMainFile(repo.rootDir);
    if (!mainFile) return [];

    const pages = parseStandalonePages(repo.rootDir, mainFile, safeRead(mainFile));
    const excluded = repo.excludeRoutes ?? [];

    return pages
      .filter((page) => !excluded.some((prefix) => matchesPrefix(page.path, prefix)))
      .map((page) => {
        const mainSource = relative(repo.rootDir, mainFile).split(sep).join("/");
        const componentSource = page.componentFile
          ? relative(repo.rootDir, page.componentFile).split(sep).join("/")
          : null;
        const sourceFiles = componentSource ? [mainSource, componentSource] : [mainSource];
        const hasBoundary = Boolean(page.componentFile && /<main[\s>]/i.test(safeRead(page.componentFile)));
        const provenance: ProvenanceRecord[] = [{
          subject: "route:" + page.path,
          claim: "route-exists",
          source: mainSource,
          method: "framework-route-parser",
          confidence: 1.0,
        }];

        if (hasBoundary && componentSource) {
          provenance.push({
            subject: "route:" + page.path,
            claim: "content-boundary-tag:main",
            source: componentSource,
            method: "framework-route-parser",
            confidence: 1.0,
          });
        }

        return {
          path: page.path,
          classification: "public-static" as const,
          contentType: "page" as const,
          sourceFiles,
          agentReadableAlternate: null,
          canonicalUrl: null,
          dynamicSegments: [],
          redirectsTo: null,
          contentBoundaryTag: hasBoundary ? "main" : null,
          provenance,
          confidence: hasBoundary ? 1.0 : 0.7,
        };
      });
  }
}

function findMainFile(repoRoot: string): string | null {
  for (const relativePath of ["src/main.tsx", "src/main.ts", "src/main.jsx", "src/main.js"]) {
    const absolutePath = join(repoRoot, relativePath);
    if (existsSync(absolutePath)) return absolutePath;
  }
  return null;
}

function parseStandalonePages(repoRoot: string, mainFile: string, mainText: string): StandalonePage[] {
  const start = mainText.indexOf("const standalonePages");
  if (start < 0) return [];
  const end = mainText.indexOf("const RootPage", start);
  const routeMap = mainText.slice(start, end < 0 ? mainText.length : end);
  const imports = new Map<string, string>();
  const importPattern = /import\s+([A-Za-z_$][\w$]*)\s+from\s+["']([^"']+)["']/g;
  let importMatch: RegExpExecArray | null;
  while ((importMatch = importPattern.exec(mainText)) !== null) {
    const resolved = resolveLocalImport(repoRoot, mainFile, importMatch[2]);
    if (resolved) imports.set(importMatch[1], resolved);
  }

  const pages: StandalonePage[] = [];
  const routePattern = /["'](\/[^"']*)["']\s*:\s*([A-Za-z_$][\w$]*)/g;
  let routeMatch: RegExpExecArray | null;
  while ((routeMatch = routePattern.exec(routeMap)) !== null) {
    pages.push({
      path: routeMatch[1] || "/",
      componentName: routeMatch[2],
      componentFile: imports.get(routeMatch[2]) ?? null,
    });
  }
  return pages;
}

function resolveLocalImport(repoRoot: string, fromFile: string, importPath: string): string | null {
  if (!importPath.startsWith(".")) return null;
  const base = join(dirname(fromFile), importPath);
  for (const extension of [".tsx", ".ts", ".jsx", ".js"]) {
    if (existsSync(base + extension)) return base + extension;
    const indexFile = join(base, "index" + extension);
    if (existsSync(indexFile)) return indexFile;
  }
  return null;
}

function matchesPrefix(path: string, prefix: string): boolean {
  const normalized = prefix.replace(/\/+$/, "") || "/";
  return normalized === "/" ? path === "/" : path === normalized || path.startsWith(normalized + "/");
}

function safeRead(path: string): string {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return "";
  }
}
