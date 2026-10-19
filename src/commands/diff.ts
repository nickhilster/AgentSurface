import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config.js";
import { assertModelVersion } from "../lib/modelVersion.js";
import { checkOwned, OWNERSHIP_HEADER_PREFIX } from "../lib/ownership.js";
import { CapabilityRecord, RouteRecord } from "../types/model.js";
import { projectLlmsTxt, projectPageArtifact, projectPublicRoutesManifest, routePathToGeneratedFile, type ProjectedArtifact } from "./generate.js";

export interface DiffChange {
  path: string;
  detail: string;
}

export interface DiffResult {
  changes: {
    create: DiffChange[];
    update: DiffChange[];
    delete: DiffChange[];
    conflict: DiffChange[];
    unchecked: DiffChange[];
  };
}

export interface DiffOptions {
  repoRoot: string;
  serverBaseUrl?: string;
}

export async function runDiff(opts: DiffOptions): Promise<DiffResult> {
  const config = loadConfig(opts.repoRoot);
  assertModelVersion(opts.repoRoot);
  const modelDir = join(opts.repoRoot, ".agentsurface", "model");
  const modelPath = join(modelDir, "routes.json");
  if (!existsSync(modelPath)) throw new Error(`No model found at ${modelPath}. Run "agentsurface inspect" first.`);
  const routes = JSON.parse(readFileSync(modelPath, "utf-8")) as RouteRecord[];
  const capabilitiesPath = join(modelDir, "capabilities.json");
  const capabilities = existsSync(capabilitiesPath) ? JSON.parse(readFileSync(capabilitiesPath, "utf-8")) as CapabilityRecord[] : [];
  const changes: DiffResult["changes"] = { create: [], update: [], delete: [], conflict: [], unchecked: [] };

  const pageArtifacts: ProjectedArtifact[] = [];
  const pendingRoutes = routes.filter((route) => route.contentType === "page" &&
    (route.classification === "public-static" || route.classification === "public-dynamic") &&
    route.dynamicSegments.length === 0 && route.contentBoundaryTag !== null && route.surfaceType !== "human-gated");
  const pageRoot = config.output.markdownDir
    ? join(opts.repoRoot, config.output.markdownDir)
    : join(opts.repoRoot, ".agentsurface", "generated", "pages");
  const uncertainPaths = new Set<string>();

  for (const route of pendingRoutes) {
    const expectedPath = routePathToGeneratedFile(pageRoot, route.path);
    if (!opts.serverBaseUrl) {
      changes.unchecked.push({ path: expectedPath, detail: "page content requires --server to render" });
      uncertainPaths.add(expectedPath);
      continue;
    }
    try {
      const response = await fetch(new URL(route.path, opts.serverBaseUrl));
      if (!response.ok) {
        changes.unchecked.push({ path: expectedPath, detail: `page render returned HTTP ${response.status}` });
        uncertainPaths.add(expectedPath);
        continue;
      }
      const artifact = projectPageArtifact(opts.repoRoot, config, route, await response.text());
      if (!artifact) {
        changes.unchecked.push({ path: expectedPath, detail: "rendered page did not contain its configured content boundary" });
        uncertainPaths.add(expectedPath);
        continue;
      }
      pageArtifacts.push(artifact);
    } catch {
      changes.unchecked.push({ path: expectedPath, detail: "page render request could not be completed" });
      uncertainPaths.add(expectedPath);
    }
  }

  const generatedRoutes = new Set<string>();
  for (const artifact of pageArtifacts) {
    if (!checkOwned(artifact.path, config.ownership.overwriteHumanOwned).conflict) {
      const route = routes.find((candidate) => routePathToGeneratedFile(pageRoot, candidate.path) === artifact.path);
      if (route) generatedRoutes.add(route.path);
    }
  }
  const baseArtifacts = [projectLlmsTxt(opts.repoRoot, config, routes, capabilities, generatedRoutes)];
  if (config.output.markdownDir) {
    baseArtifacts.push(projectPublicRoutesManifest(opts.repoRoot, config, routes, generatedRoutes));
  }

  for (const artifact of [...pageArtifacts, ...baseArtifacts]) classifyArtifact(artifact, config.ownership.overwriteHumanOwned, changes);

  const proposedPaths = new Set([...pageArtifacts, ...baseArtifacts].map((artifact) => artifact.path));
  for (const file of listMarkdownFiles(pageRoot)) {
    if (proposedPaths.has(file) || uncertainPaths.has(file)) continue;
    if (readFileSync(file, "utf-8").startsWith(OWNERSHIP_HEADER_PREFIX)) {
      changes.delete.push({ path: file, detail: "AgentSurface-owned Markdown has no current eligible route projection" });
    }
  }

  return { changes };
}

function classifyArtifact(artifact: ProjectedArtifact, overwriteHumanOwned: boolean, changes: DiffResult["changes"]): void {
  if (!existsSync(artifact.path)) {
    changes.create.push({ path: artifact.path, detail: "projected output does not exist" });
    return;
  }
  if (checkOwned(artifact.path, overwriteHumanOwned).conflict) {
    changes.conflict.push({ path: artifact.path, detail: "existing file is human-owned and would not be overwritten" });
    return;
  }
  if (readFileSync(artifact.path, "utf-8") !== artifact.content) {
    changes.update.push({ path: artifact.path, detail: "projected content differs from the existing AgentSurface-owned output" });
  }
}

function listMarkdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...listMarkdownFiles(path));
    else if (path.endsWith(".md")) files.push(path);
  }
  return files;
}
