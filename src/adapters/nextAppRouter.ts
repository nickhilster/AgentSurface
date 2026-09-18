import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import type {
  CapabilityRecord,
  DetectionResult,
  FrameworkAdapter,
  ProvenanceRecord,
  RepoContext,
  RouteRecord,
} from "../types/model.js";

/**
 * Adapter for Next.js App Router repos. Only implements what is needed to
 * inspect teambotics-website truthfully — see docs/ARCHITECTURE.md's adapter
 * boundary: adapters expose verifiable facts, not project-wide policy.
 */
export class NextAppRouterAdapter implements FrameworkAdapter {
  readonly name = "next-app-router";

  async detect(repo: RepoContext): Promise<DetectionResult> {
    const evidence: string[] = [];
    const configCandidates = ["next.config.ts", "next.config.js", "next.config.mjs"];
    let foundConfig: string | null = null;
    for (const candidate of configCandidates) {
      if (existsSync(join(repo.rootDir, candidate))) {
        foundConfig = candidate;
        evidence.push(candidate);
        break;
      }
    }

    const appDir = join(repo.rootDir, "app");
    const hasAppDir = existsSync(appDir) && statSync(appDir).isDirectory();
    if (hasAppDir) evidence.push("app/");

    if (foundConfig && hasAppDir) {
      return { framework: "next-app-router", confidence: 1.0, evidence };
    }
    if (foundConfig || hasAppDir) {
      return { framework: "next-app-router", confidence: 0.5, evidence };
    }
    return { framework: "unknown", confidence: 0, evidence: [] };
  }

  async inspectRoutes(repo: RepoContext): Promise<RouteRecord[]> {
    const appDir = join(repo.rootDir, "app");
    if (!existsSync(appDir)) return [];

    const redirects = parseNextConfigRedirects(repo.rootDir);
    const excludeDirs = new Set(repo.excludeDirs ?? []);

    const routes: RouteRecord[] = [];
    walkAppDir(appDir, appDir, [], excludeDirs, (segments, absDir) => {
      const pageFile = join(absDir, "page.tsx");
      if (!existsSync(pageFile)) return;

      const { urlPath, dynamicSegments } = segmentsToUrlPath(segments);
      const sourceFile = relative(repo.rootDir, pageFile).split(sep).join("/");

      const provenance: ProvenanceRecord[] = [
        {
          subject: `route:${urlPath}`,
          claim: "route-exists",
          source: sourceFile,
          method: "framework-route-parser",
          confidence: 1.0,
        },
      ];

      // Check for a config-level redirect that supersedes this route's real content.
      const redirect = redirects.find((r) => matchesRedirectSource(r.source, urlPath));
      if (redirect) {
        routes.push({
          path: urlPath,
          classification: "unknown",
          contentType: "redirect",
          sourceFiles: [sourceFile],
          agentReadableAlternate: null,
          canonicalUrl: null,
          dynamicSegments,
          redirectsTo: redirect.destination,
          contentBoundaryTag: null,
          provenance: [
            ...provenance,
            {
              subject: `route:${urlPath}`,
              claim: `redirects-to:${redirect.destination}`,
              source: "next.config.ts",
              method: "config-redirect",
              confidence: 1.0,
            },
          ],
          confidence: 1.0,
        });
        return;
      }

      const pageText = safeRead(pageFile);
      const isNoindex = /robots:\s*{\s*index:\s*false/.test(pageText);

      // Only the top-level /admin/** tree is backed by the confirmed password check at
      // app/api/admin/login/route.ts. A route elsewhere that merely has "admin" as *some*
      // segment (e.g. /poko/admin) is not protected by that same mechanism — asserting
      // otherwise would be exactly the false inference OPERATE.md forbids. Each such
      // sub-tree would need its own confirmed auth evidence to earn "authenticated".
      const isTopLevelAdminRoute = segments[0]?.toLowerCase() === "admin";
      const hasAdminLoginRoute = existsSync(join(repo.rootDir, "app", "api", "admin", "login", "route.ts"));
      const pathHasNestedAdminSegment = !isTopLevelAdminRoute && segments.some((s) => s.toLowerCase() === "admin");

      let classification: RouteRecord["classification"] = "public-static";
      // Tracks the confidence of the *classification claim specifically*, not just
      // "route exists" (which is always 1.0 from the framework parser). The route's
      // overall confidence must reflect this, not silently default to 1.0.
      let classificationConfidence = 1.0;
      if (isTopLevelAdminRoute && hasAdminLoginRoute) {
        classification = "authenticated";
        classificationConfidence = 1.0;
        provenance.push({
          subject: `route:${urlPath}`,
          claim: "authenticated",
          source: "app/api/admin/login/route.ts",
          method: "auth-check-detected",
          confidence: 1.0,
        });
      } else if (pathHasNestedAdminSegment && isNoindex) {
        classification = "private-internal";
        classificationConfidence = 0.7;
        provenance.push({
          subject: `route:${urlPath}`,
          claim: "private-internal",
          source: sourceFile,
          method: "metadata-robots-noindex",
          confidence: 0.7,
        });
      } else if (isNoindex) {
        // noindex without an admin path segment or confirmed auth: don't assume private,
        // but don't assume public either. Surface as unknown rather than fabricate.
        classification = "unknown";
        classificationConfidence = 0.4;
        provenance.push({
          subject: `route:${urlPath}`,
          claim: "noindex-unclassified",
          source: sourceFile,
          method: "metadata-robots-noindex",
          confidence: 0.4,
        });
      }

      const contentBoundaryTag = findContentBoundaryTag(repo.rootDir, absDir, pageText);
      if (contentBoundaryTag) {
        provenance.push({
          subject: `route:${urlPath}`,
          claim: `content-boundary-tag:${contentBoundaryTag.tag}`,
          source: contentBoundaryTag.foundIn,
          method: "framework-route-parser",
          confidence: 1.0,
        });
      }

      routes.push({
        path: urlPath,
        classification,
        contentType: "page",
        sourceFiles: [sourceFile],
        agentReadableAlternate: null,
        canonicalUrl: null,
        dynamicSegments,
        redirectsTo: null,
        contentBoundaryTag: contentBoundaryTag?.tag ?? null,
        provenance,
        confidence: classificationConfidence,
      });
    });

    return routes;
  }

  async inspectCapabilities(repo: RepoContext): Promise<CapabilityRecord[]> {
    const apiDir = join(repo.rootDir, "app", "api");
    if (!existsSync(apiDir)) return [];

    const capabilities: CapabilityRecord[] = [];
    walkApiDir(apiDir, apiDir, [], (segments, absDir) => {
      const routeFile = join(absDir, "route.ts");
      if (!existsSync(routeFile)) return;
      const sourceFile = relative(repo.rootDir, routeFile).split(sep).join("/");
      const apiPath = `/api/${segments.join("/")}`;
      const isAdmin = segments[0] === "admin";
      const routeText = safeRead(routeFile);
      const hasGet = /export\s+(async\s+)?function\s+GET/.test(routeText);
      const isMutating = /export\s+(async\s+)?function\s+(POST|PUT|PATCH|DELETE)/.test(routeText);

      capabilities.push({
        name: apiPath,
        description: `API route at ${apiPath}`,
        // Readable/operable per SPEC.md: an API existing does not make it agent-operable.
        // We only ever classify these as "readable" candidates here; no operable capability
        // is generated from this inspection pass, per OPERATE.md's non-negotiable boundary.
        kind: "readable",
        backingImplementation: sourceFile,
        authRequired: isAdmin,
        sideEffects: isMutating,
        constraints: isAdmin ? ["requires admin session cookie (see lib/adminAuth)"] : [],
        provenance: [
          {
            subject: `capability:${apiPath}`,
            claim: hasGet ? "has-GET-handler" : "no-GET-handler-found",
            source: sourceFile,
            method: "framework-route-parser",
            confidence: 1.0,
          },
        ],
        confidence: 1.0,
      });
    });

    return capabilities;
  }
}

/**
 * Finds a deterministic content boundary (currently: a "<main" tag) for a page.
 * Checks the page file itself first, then walks up the app/ layout chain, resolving
 * the JSX wrapper component each layout.tsx renders around {children} and checking
 * that component's own source. This mirrors how Next.js actually composes a page's
 * real rendered output, so it catches boundaries defined in shared shell components
 * (e.g. SiteShell, PokoShell) rather than only ones inlined directly in page.tsx.
 * Stops and returns null (not a guess) if no <main> is found anywhere in the chain.
 */
function findContentBoundaryTag(
  repoRoot: string,
  pageDir: string,
  pageText: string
): { tag: string; foundIn: string } | null {
  if (/<main[\s>]/i.test(pageText)) {
    return { tag: "main", foundIn: relative(repoRoot, join(pageDir, "page.tsx")).split(sep).join("/") };
  }

  const appDir = join(repoRoot, "app");
  let dir = pageDir;
  const visitedComponentFiles = new Set<string>();

  while (dir.startsWith(appDir)) {
    const layoutFile = join(dir, "layout.tsx");
    if (existsSync(layoutFile)) {
      const layoutText = safeRead(layoutFile);
      if (/<main[\s>]/i.test(layoutText)) {
        return { tag: "main", foundIn: relative(repoRoot, layoutFile).split(sep).join("/") };
      }

      const wrapperComponentName = extractChildrenWrapperComponent(layoutText);
      if (wrapperComponentName) {
        const resolved = resolveImportedComponentFile(repoRoot, layoutFile, layoutText, wrapperComponentName);
        if (resolved && !visitedComponentFiles.has(resolved)) {
          visitedComponentFiles.add(resolved);
          const componentText = safeRead(resolved);
          if (/<main[\s>]/i.test(componentText)) {
            return { tag: "main", foundIn: relative(repoRoot, resolved).split(sep).join("/") };
          }
        }
      }
    }
    if (dir === appDir) break;
    dir = dirname(dir);
  }

  return null;
}

/** Finds the component name a layout.tsx renders directly around {children}, e.g. `<SiteShell ...>{children}</SiteShell>`. */
function extractChildrenWrapperComponent(layoutText: string): string | null {
  const match = layoutText.match(/<([A-Z][A-Za-z0-9]*)\b[^>]*>\s*\{children\}\s*<\/\1>/);
  return match ? match[1] : null;
}

function resolveImportedComponentFile(
  repoRoot: string,
  fromFile: string,
  fileText: string,
  componentName: string
): string | null {
  const importRegex = new RegExp(`import\\s*\\{[^}]*\\b${componentName}\\b[^}]*\\}\\s*from\\s*["']([^"']+)["']`);
  const match = fileText.match(importRegex);
  if (!match) return null;
  const importPath = match[1];

  let basePath: string;
  if (importPath.startsWith("@/")) {
    basePath = join(repoRoot, importPath.slice(2));
  } else if (importPath.startsWith(".")) {
    basePath = join(dirname(fromFile), importPath);
  } else {
    return null; // external package import, not a local component we can inspect
  }

  for (const ext of [".tsx", ".ts"]) {
    if (existsSync(basePath + ext)) return basePath + ext;
  }
  return null;
}

function safeRead(path: string): string {
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return "";
  }
}

function walkAppDir(
  root: string,
  dir: string,
  segments: string[],
  excludeDirs: Set<string>,
  onDir: (segments: string[], absDir: string) => void
): void {
  if (excludeDirs.has(dir)) return;
  onDir(segments, dir);

  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry === "node_modules" || entry.startsWith(".") || entry === "api") continue;
    const abs = join(dir, entry);
    let isDir = false;
    try {
      isDir = statSync(abs).isDirectory();
    } catch {
      continue;
    }
    if (!isDir) continue;

    // Route groups (parens) don't contribute a URL segment.
    const isRouteGroup = entry.startsWith("(") && entry.endsWith(")");
    const nextSegments = isRouteGroup ? segments : [...segments, entry];
    walkAppDir(root, abs, nextSegments, excludeDirs, onDir);
  }
}

function walkApiDir(
  root: string,
  dir: string,
  segments: string[],
  onDir: (segments: string[], absDir: string) => void
): void {
  onDir(segments, dir);
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const abs = join(dir, entry);
    let isDir = false;
    try {
      isDir = statSync(abs).isDirectory();
    } catch {
      continue;
    }
    if (!isDir) continue;
    walkApiDir(root, abs, [...segments, entry], onDir);
  }
}

function segmentsToUrlPath(segments: string[]): { urlPath: string; dynamicSegments: string[] } {
  const dynamicSegments: string[] = [];
  const parts = segments.map((seg) => {
    const dynMatch = seg.match(/^\[(\.\.\.)?([^\]]+)\]$/);
    if (dynMatch) {
      dynamicSegments.push(dynMatch[2]);
      return `[${dynMatch[2]}]`;
    }
    return seg;
  });
  const urlPath = "/" + parts.join("/");
  return { urlPath: urlPath === "/" ? "/" : urlPath.replace(/\/+/g, "/"), dynamicSegments };
}

interface RedirectEntry {
  source: string;
  destination: string;
  permanent: boolean;
}

/**
 * Statically extracts the redirects() array from next.config.ts via regex rather than
 * executing the file, per SPEC.md's preference for deterministic parsing over inference
 * or arbitrary code execution.
 */
function parseNextConfigRedirects(rootDir: string): RedirectEntry[] {
  const candidates = ["next.config.ts", "next.config.js", "next.config.mjs"];
  let text = "";
  for (const c of candidates) {
    const p = join(rootDir, c);
    if (existsSync(p)) {
      text = safeRead(p);
      break;
    }
  }
  if (!text) return [];

  const entries: RedirectEntry[] = [];
  const blockRegex = /{\s*source:\s*["']([^"']+)["'],\s*destination:\s*["']([^"']+)["'],\s*permanent:\s*(true|false)\s*,?\s*}/g;
  let match: RegExpExecArray | null;
  while ((match = blockRegex.exec(text)) !== null) {
    entries.push({ source: match[1], destination: match[2], permanent: match[3] === "true" });
  }
  return entries;
}

function matchesRedirectSource(redirectSource: string, urlPath: string): boolean {
  if (redirectSource === urlPath) return true;
  const wildcard = redirectSource.replace(/:path\*$/, "");
  if (redirectSource.endsWith(":path*") && urlPath.startsWith(wildcard.replace(/\/$/, ""))) {
    return true;
  }
  return false;
}
