import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config.js";
import { NextAppRouterAdapter } from "../adapters/nextAppRouter.js";
import type { CanonicalSiteModel, FrameworkAdapter } from "../types/model.js";

export interface InspectOptions {
  repoRoot: string;
}

const ADAPTERS: FrameworkAdapter[] = [new NextAppRouterAdapter()];

export async function runInspect(opts: InspectOptions): Promise<CanonicalSiteModel> {
  const config = loadConfig(opts.repoRoot);

  let bestAdapter: FrameworkAdapter | null = null;
  let bestConfidence = 0;
  let bestFrameworkName = "unknown";
  for (const adapter of ADAPTERS) {
    const detection = await adapter.detect({ rootDir: opts.repoRoot });
    if (detection.confidence > bestConfidence) {
      bestAdapter = adapter;
      bestConfidence = detection.confidence;
      bestFrameworkName = detection.framework;
    }
  }

  const unknowns: string[] = [];
  const routes = bestAdapter ? await bestAdapter.inspectRoutes({ rootDir: opts.repoRoot }) : [];
  const capabilities = bestAdapter?.inspectCapabilities
    ? await bestAdapter.inspectCapabilities({ rootDir: opts.repoRoot })
    : [];

  if (!bestAdapter) {
    unknowns.push("No framework adapter matched this repository; routes/capabilities could not be inspected.");
  }

  for (const route of routes) {
    // Redirect routes are fully resolved by their config-redirect provenance; the
    // placeholder "unknown" classification on them just means "moot, not applicable",
    // not an actual gap. Only flag real unresolved classifications here.
    if (route.classification === "unknown" && route.contentType !== "redirect") {
      unknowns.push(`route ${route.path}: classification could not be determined with confidence (see provenance).`);
    }
  }

  const model: CanonicalSiteModel = {
    version: "0.1",
    generatedAt: new Date().toISOString(),
    site: {
      name: config.site.name,
      framework: bestFrameworkName,
      frameworkConfidence: bestConfidence,
      rootDir: opts.repoRoot,
      hostnames: config.site.hostnames,
    },
    routes,
    entities: [],
    capabilities,
    constraints: [],
    provenance: [],
    unknowns,
  };

  writeModel(opts.repoRoot, model);
  return model;
}

function writeModel(repoRoot: string, model: CanonicalSiteModel): void {
  const modelDir = join(repoRoot, ".agentsurface", "model");
  mkdirSync(modelDir, { recursive: true });

  writeFileSync(join(modelDir, "site.json"), JSON.stringify(model.site, null, 2) + "\n", "utf-8");
  writeFileSync(join(modelDir, "routes.json"), JSON.stringify(model.routes, null, 2) + "\n", "utf-8");
  writeFileSync(join(modelDir, "entities.json"), JSON.stringify(model.entities, null, 2) + "\n", "utf-8");
  writeFileSync(join(modelDir, "capabilities.json"), JSON.stringify(model.capabilities, null, 2) + "\n", "utf-8");
  writeFileSync(join(modelDir, "constraints.json"), JSON.stringify(model.constraints, null, 2) + "\n", "utf-8");
  writeFileSync(
    join(modelDir, "provenance.json"),
    JSON.stringify(
      {
        siteWide: model.provenance,
        unknowns: model.unknowns,
        generatedAt: model.generatedAt,
      },
      null,
      2
    ) + "\n",
    "utf-8"
  );
}
