import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadConfig } from "../config.js";
import { extractContentBoundary, htmlToMarkdown } from "../lib/htmlToMarkdown.js";
import { assertModelVersion } from "../lib/modelVersion.js";
import { OWNERSHIP_HEADER_PREFIX } from "../lib/ownership.js";
import type { RouteRecord } from "../types/model.js";

export interface ValidateOptions {
  repoRoot: string;
  /** If provided, re-fetches live pages to check for content drift against generated output. */
  serverBaseUrl?: string;
  /**
   * Explicit operator acknowledgement that validate is intentionally running without
   * `serverBaseUrl`, and therefore without drift/reachability checking. Without this,
   * omitting serverBaseUrl is a validation failure rather than a silent, meaningless
   * pass — see §1.5.
   */
  acknowledgeNoServer?: boolean;
}

export interface ValidationFailure {
  check: "route-parity" | "discovery-integrity" | "ownership-safety" | "drift" | "capability-truthfulness";
  path: string;
  message: string;
}

/** A check that could not be completed — distinct from both pass and fail. See §1.4. */
export interface UncheckedRecord {
  check: string;
  path: string;
  reason: string;
}

export interface ValidateResult {
  failures: ValidationFailure[];
  unchecked: UncheckedRecord[];
  checkedGeneratedFiles: number;
  checkedDiscoveryLinks: number;
}

export async function runValidate(opts: ValidateOptions): Promise<ValidateResult> {
  loadConfig(opts.repoRoot); // ensures init has run; throws otherwise
  assertModelVersion(opts.repoRoot);

  const modelPath = join(opts.repoRoot, ".agentsurface", "model", "routes.json");
  if (!existsSync(modelPath)) {
    throw new Error(`No model found at ${modelPath}. Run "agentsurface inspect" first.`);
  }
  const routes: RouteRecord[] = JSON.parse(readFileSync(modelPath, "utf-8"));
  const routesByPath = new Map(routes.map((r) => [normalizeRoutePath(r.path), r]));

  const failures: ValidationFailure[] = [];
  const unchecked: UncheckedRecord[] = [];
  const generatedDir = configMarkdownDir(opts.repoRoot);
  const generatedFiles = generatedDir && existsSync(generatedDir) ? listMarkdownFiles(generatedDir) : [];

  // --- Route parity + ownership safety ---
  for (const file of generatedFiles) {
    const routePath = generatedFileToRoutePath(generatedDir, file);
    const route = routesByPath.get(normalizeRoutePath(routePath));

    if (!route) {
      failures.push({
        check: "route-parity",
        path: routePath,
        message: `generated file ${file} has no corresponding route in the current model — stale output from a removed/renamed route`,
      });
      continue;
    }
    if (route.classification !== "public-static" && route.classification !== "public-dynamic") {
      failures.push({
        check: "route-parity",
        path: routePath,
        message: `route is now classified "${route.classification}" but a generated public file still exists for it — regenerate to remove`,
      });
    }

    const content = readFileSync(file, "utf-8");
    if (!content.startsWith(OWNERSHIP_HEADER_PREFIX)) {
      failures.push({
        check: "ownership-safety",
        path: routePath,
        message: `${file} does not carry AgentSurface's ownership header — may have been hand-edited or is not actually AgentSurface-owned`,
      });
    }
  }

  // --- Discovery integrity: llms.txt links must resolve to real generated files ---
  const config = loadConfig(opts.repoRoot);
  const llmsTxtPath = join(opts.repoRoot, config.output.dir, "llms.txt");
  let checkedDiscoveryLinks = 0;
  if (existsSync(llmsTxtPath)) {
    const llmsTxt = readFileSync(llmsTxtPath, "utf-8");
    // llmstxt.org v2 link entries are "[name](url)", optionally followed by ": notes".
    // Only entries pointing at a .md path are discovery links to a generated alternate;
    // this must parse any spec-conformant file, including one AgentSurface did not
    // generate itself, not just AgentSurface's own previous output format. See §1.7.
    const mdRefs = [...llmsTxt.matchAll(/\[[^\]]*\]\(([^)\s]+\.md)\)/g)].map((m) => m[1]);
    for (const ref of mdRefs) {
      checkedDiscoveryLinks++;
      const abs = config.output.markdownDir
        ? resolve(opts.repoRoot, config.output.dir, "." + ref)
        : join(generatedDir, ref === "/index.md" ? "index.md" : ref.replace(/^\//, ""));
      if (!existsSync(abs)) {
        failures.push({
          check: "discovery-integrity",
          path: ref,
          message: `llms.txt references ${ref}, but ${abs} does not exist`,
        });
      }
    }
  } else {
    failures.push({ check: "discovery-integrity", path: `/${config.output.dir === "." ? "" : config.output.dir + "/"}llms.txt`, message: `${llmsTxtPath} does not exist` });
  }

  if (config.output.markdownDir) {
    const manifestPath = join(opts.repoRoot, config.output.dir, "agentsurface", "routes.json");
    if (!existsSync(manifestPath)) {
      failures.push({ check: "discovery-integrity", path: manifestPath, message: "public route manifest is missing" });
    } else {
      let manifest: { meta?: { generatedBy?: string }; routes?: Array<{ path?: string; title?: string; htmlUrl?: string; markdownUrl?: string | null; surfaceType?: string; sourceFiles?: string[]; requirements?: unknown[] }> };
      try {
        manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      } catch {
        manifest = {};
        failures.push({ check: "discovery-integrity", path: manifestPath, message: "public route manifest is not valid JSON" });
      }
      if (manifest.meta?.generatedBy !== "AgentSurface" || !Array.isArray(manifest.routes)) {
        failures.push({ check: "ownership-safety", path: manifestPath, message: "public route manifest lacks AgentSurface ownership metadata or routes array" });
      } else {
        const intended = routes.filter((route) => route.contentType === "page" && route.classification === "public-static" && route.dynamicSegments.length === 0);
        const publicEntries = new Map(manifest.routes.filter((entry) => typeof entry.path === "string").map((entry) => [normalizeRoutePath(entry.path!), entry]));
        for (const route of intended) {
          const entry = publicEntries.get(normalizeRoutePath(route.path));
          if (!entry) {
            failures.push({ check: "route-parity", path: route.path, message: "public route is missing from the route manifest" });
            continue;
          }
          if (!entry.title || !entry.htmlUrl || !entry.surfaceType || !Array.isArray(entry.sourceFiles) || !Array.isArray(entry.requirements)) {
            failures.push({ check: "discovery-integrity", path: route.path, message: "route manifest entry is missing required metadata" });
          }
          for (const sourceFile of entry.sourceFiles ?? []) {
            if (!existsSync(join(opts.repoRoot, sourceFile))) failures.push({ check: "discovery-integrity", path: sourceFile, message: "manifest source file does not exist" });
          }
          if (entry.markdownUrl !== null && entry.markdownUrl !== undefined) {
            if (!entry.markdownUrl.startsWith("/") || entry.markdownUrl.includes("..")) {
              failures.push({ check: "discovery-integrity", path: entry.markdownUrl, message: "Markdown URL must be a local absolute path without traversal" });
            } else {
              const publicRoot = resolve(opts.repoRoot, config.output.dir);
              const target = resolve(publicRoot, "." + entry.markdownUrl);
              if (!target.startsWith(publicRoot) || !existsSync(target)) {
                failures.push({ check: "discovery-integrity", path: entry.markdownUrl, message: "route manifest Markdown target does not resolve to a local file" });
              }
            }
          }
          if (opts.serverBaseUrl && entry.markdownUrl === null) {
            let routeUrl: URL;
            try { routeUrl = new URL(entry.htmlUrl!, opts.serverBaseUrl); } catch { routeUrl = new URL(route.path, opts.serverBaseUrl); }
            const localUrl = new URL(routeUrl.pathname, opts.serverBaseUrl);
            checkedDiscoveryLinks++;
            try {
              const response = await fetch(localUrl);
              if (!response.ok) failures.push({ check: "discovery-integrity", path: route.path, message: "HTML-only route returned HTTP " + response.status });
            } catch (err) {
              unchecked.push({ check: "discovery-integrity", path: route.path, reason: `could not reach ${localUrl}: ${err instanceof Error ? err.message : String(err)}` });
            }
          }
        }
        for (const entry of manifest.routes) {
          if (entry.path && !intended.some((route) => normalizeRoutePath(route.path) === normalizeRoutePath(entry.path!))) {
            failures.push({ check: "route-parity", path: entry.path, message: "manifest entry has no matching public route in the current model" });
          }
        }
      }
    }
  }

  // --- Drift / reachability: re-fetch live content and diff against what's on disk ---
  if (opts.serverBaseUrl) {
    for (const file of generatedFiles) {
      const routePath = generatedFileToRoutePath(generatedDir, file);
      const route = routesByPath.get(normalizeRoutePath(routePath));
      if (!route || !route.contentBoundaryTag) continue; // not a drift candidate

      const url = new URL(routePath, opts.serverBaseUrl).toString();
      try {
        const res = await fetch(url);
        if (!res.ok) {
          // A previously-generated route that now 404s/500s is exactly the state a
          // maintainer most needs to hear about — it must not pass silently. See §1.4.
          failures.push({
            check: "drift",
            path: routePath,
            message: `live route returned HTTP ${res.status} — generated content may be stale or the route may no longer exist`,
          });
          continue;
        }
        const html = await res.text();
        const fragment = extractContentBoundary(html, route.contentBoundaryTag);
        if (fragment === null) {
          failures.push({
            check: "drift",
            path: routePath,
            message: `rendered HTML no longer contains a well-formed <${route.contentBoundaryTag}> boundary — the content boundary vanished since generation`,
          });
          continue;
        }
        const freshMarkdown = htmlToMarkdown(fragment);

        const onDisk = readFileSync(file, "utf-8");
        const onDiskMarkdown = onDisk.slice(onDisk.indexOf("-->") + 3).trim();
        if (freshMarkdown.trim() !== onDiskMarkdown) {
          failures.push({
            check: "drift",
            path: routePath,
            message: `live rendered content no longer matches generated output — source changed since last "agentsurface generate"`,
          });
        }
      } catch (err) {
        // The server itself could not be reached for this route — genuinely unknown,
        // not a pass. Third state alongside pass/fail; see §1.4.
        unchecked.push({
          check: "drift",
          path: routePath,
          reason: `could not reach ${url}: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  } else if (opts.acknowledgeNoServer) {
    unchecked.push({
      check: "drift",
      path: "*",
      reason: "drift/reachability checking explicitly skipped (no --server, acknowledged)",
    });
  } else {
    // No --server and no explicit acknowledgement: validate must not report a clean,
    // meaningful-looking pass having checked nothing that matters most. See §1.5.
    failures.push({
      check: "drift",
      path: "*",
      message: `drift and reachability checking were skipped: no --server was provided. Pass ` +
        `--server <url> to check live content, or --no-drift-check to explicitly ` +
        `acknowledge running without it.`,
    });
  }

  return { failures, unchecked, checkedGeneratedFiles: generatedFiles.length, checkedDiscoveryLinks };
}

function listMarkdownFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      out.push(...listMarkdownFiles(abs));
    } else if (entry.endsWith(".md")) {
      out.push(abs);
    }
  }
  return out;
}

function generatedFileToRoutePath(generatedDir: string, file: string): string {
  const rel = file.slice(generatedDir.length).replace(/\\/g, "/").replace(/\.md$/, "");
  return rel === "/index" ? "/" : rel;
}

function normalizeRoutePath(path: string): string {
  return path === "/" ? "/" : "/" + path.replace(/^\/+|\/+$/g, "");
}

function configMarkdownDir(repoRoot: string): string {
  const config = loadConfig(repoRoot);
  return config.output.markdownDir ? join(repoRoot, config.output.markdownDir) : join(repoRoot, ".agentsurface", "generated", "pages");
}
