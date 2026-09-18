import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config.js";
import { extractContentBoundary, htmlToMarkdown } from "../lib/htmlToMarkdown.js";
import { assertModelVersion } from "../lib/modelVersion.js";
import { ownershipHeader, writeOwned } from "../lib/ownership.js";
import type { CapabilityRecord, RouteRecord } from "../types/model.js";

export interface GenerateOptions {
  repoRoot: string;
  /** Base URL of a running instance of the target site, used to fetch real rendered HTML. */
  serverBaseUrl: string;
}

export interface GenerateSkip {
  path: string;
  reason: string;
  /**
   * True when the route was skipped because generation infrastructure was missing
   * (the server could not be reached at all), as opposed to a legitimate modeled reason
   * (dynamic route, non-public classification, no content boundary). Callers use this to
   * distinguish "nothing to generate" from "generation was attempted and failed".
   */
  fatal: boolean;
}

export interface GenerateResult {
  generated: string[];
  skipped: GenerateSkip[];
  llmsTxt: { written: boolean; conflict: boolean };
}

export async function runGenerate(opts: GenerateOptions): Promise<GenerateResult> {
  const config = loadConfig(opts.repoRoot);
  assertModelVersion(opts.repoRoot);

  const modelPath = join(opts.repoRoot, ".agentsurface", "model", "routes.json");
  if (!existsSync(modelPath)) {
    throw new Error(`No model found at ${modelPath}. Run "agentsurface inspect" first.`);
  }
  const routes: RouteRecord[] = JSON.parse(readFileSync(modelPath, "utf-8"));

  const capabilitiesPath = join(opts.repoRoot, ".agentsurface", "model", "capabilities.json");
  const capabilities: CapabilityRecord[] = existsSync(capabilitiesPath)
    ? JSON.parse(readFileSync(capabilitiesPath, "utf-8"))
    : [];

  const generatedDir = join(opts.repoRoot, ".agentsurface", "generated", "pages");
  mkdirSync(generatedDir, { recursive: true });

  const result: GenerateResult = { generated: [], skipped: [], llmsTxt: { written: false, conflict: false } };

  for (const route of routes) {
    if (route.contentType !== "page") {
      continue; // redirects and unknown content types are never mirrored
    }
    if (route.classification !== "public-static" && route.classification !== "public-dynamic") {
      result.skipped.push({ path: route.path, reason: `classification "${route.classification}" is not public; excluded by default`, fatal: false });
      continue;
    }
    if (route.dynamicSegments.length > 0) {
      result.skipped.push({ path: route.path, reason: "dynamic route; content-source extraction not implemented in this slice", fatal: false });
      continue;
    }
    if (!route.contentBoundaryTag) {
      result.skipped.push({ path: route.path, reason: "no deterministic content boundary found in source; refusing to guess", fatal: false });
      continue;
    }

    const url = new URL(route.path, opts.serverBaseUrl).toString();
    let html: string;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        result.skipped.push({ path: route.path, reason: `fetch returned HTTP ${res.status}`, fatal: false });
        continue;
      }
      html = await res.text();
    } catch (err) {
      // The server itself could not be reached at all — this is not a per-route content
      // problem, it's missing generation infrastructure (see §1.6).
      result.skipped.push({ path: route.path, reason: `fetch failed: ${err instanceof Error ? err.message : String(err)}`, fatal: true });
      continue;
    }

    const fragment = extractContentBoundary(html, route.contentBoundaryTag);
    if (fragment === null) {
      result.skipped.push({ path: route.path, reason: `rendered HTML did not contain a well-formed <${route.contentBoundaryTag}> boundary`, fatal: false });
      continue;
    }

    const markdown = htmlToMarkdown(fragment);
    const outFile = routePathToGeneratedFile(generatedDir, route.path);
    const content = ownershipHeader(".agentsurface/model/routes.json") + markdown + "\n";

    const writeResult = writeOwned(outFile, content, config.ownership.overwriteHumanOwned);
    if (writeResult.conflict) {
      result.skipped.push({ path: route.path, reason: `${outFile} exists and is not AgentSurface-owned; refusing to overwrite`, fatal: false });
      continue;
    }

    result.generated.push(route.path);
  }

  if (result.generated.length === 0 && result.skipped.some((s) => s.fatal)) {
    throw new Error(
      `generate produced no output because the target server at "${opts.serverBaseUrl}" could ` +
        `not be reached for any candidate route. Start the site and pass --server <url>, or ` +
        `check the URL is correct.`
    );
  }

  result.llmsTxt = generateLlmsTxt(opts.repoRoot, config, routes, capabilities);

  return result;
}

function routePathToGeneratedFile(generatedDir: string, routePath: string): string {
  const clean = routePath === "/" ? "/index" : routePath;
  return join(generatedDir, clean + ".md");
}

function generateLlmsTxt(
  repoRoot: string,
  config: ReturnType<typeof loadConfig>,
  routes: RouteRecord[],
  capabilities: CapabilityRecord[]
): { written: boolean; conflict: boolean } {
  const publicPages = routes.filter(
    (r) => r.contentType === "page" && r.classification === "public-static" && r.dynamicSegments.length === 0
  );

  // llmstxt.org v2: the only required element is an H1 with the site/project name.
  // Everything else is optional. File-list entries are "[name](url)", optionally
  // followed by ": notes". No project-specific format is invented here.
  const lines: string[] = [];
  lines.push(`# ${config.site.name}`);
  lines.push("");
  lines.push("> Generated by AgentSurface from the current site structure. This is a discovery index, not a full content dump.");
  lines.push("");
  lines.push("## Pages");
  lines.push("");
  for (const r of publicPages) {
    const label = r.path === "/" ? "Home" : r.path.replace(/^\//, "");
    const hasAlternate = r.contentBoundaryTag !== null;
    const target = hasAlternate ? (r.path === "/" ? "/index.md" : r.path + ".md") : r.path;
    lines.push(`- [${label}](${target})`);
  }

  // Only list capabilities that carry a real, source-derived backing implementation —
  // never a literal route/URL invented for one specific site. See §1.1.
  const listable = capabilities.filter((c) => c.backingImplementation !== null);
  if (listable.length > 0) {
    lines.push("");
    lines.push("## Capabilities");
    lines.push("");
    for (const c of listable) {
      lines.push(`- [${c.name}](${c.backingImplementation}): ${c.description}`);
    }
  }
  lines.push("");

  const outPath = join(repoRoot, config.output.dir, "llms.txt");
  const content = ownershipHeader(".agentsurface/model/routes.json") + lines.join("\n") + "\n";
  return writeOwned(outPath, content, config.ownership.overwriteHumanOwned);
}
