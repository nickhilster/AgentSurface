/**
 * Every reader of the on-disk model (.agentsurface/model/) must check its version
 * before trusting it. Without this, additive schema changes produce models that older
 * binaries mis-read and newer binaries accept silently — a machine-readable source of
 * truth that nothing verifies is not trustworthy. See docs/PLAN-v1-product.md §1.8.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CanonicalSiteModel } from "../types/model.js";

export const MODEL_VERSION: CanonicalSiteModel["version"] = "0.1";

interface ModelMeta {
  version: string;
  generatedAt: string;
}

function metaPath(repoRoot: string): string {
  return join(repoRoot, ".agentsurface", "model", "meta.json");
}

export function writeModelMeta(repoRoot: string, model: CanonicalSiteModel): void {
  const dir = join(repoRoot, ".agentsurface", "model");
  mkdirSync(dir, { recursive: true });
  const meta: ModelMeta = { version: model.version, generatedAt: model.generatedAt };
  writeFileSync(metaPath(repoRoot), JSON.stringify(meta, null, 2) + "\n", "utf-8");
}

/**
 * Throws an actionable error if the on-disk model is missing version metadata or was
 * written by a different AgentSurface model version than this build expects. Callers
 * (generate, validate) must call this before reading routes.json/capabilities.json.
 */
export function assertModelVersion(repoRoot: string): void {
  const p = metaPath(repoRoot);
  if (!existsSync(p)) {
    throw new Error(
      `No model version metadata found at ${p}. The model at .agentsurface/model/ was ` +
        `either written by an older AgentSurface version that did not record one, or ` +
        `"agentsurface inspect" has not been run. Run "agentsurface inspect" to (re)generate it.`
    );
  }
  const meta = JSON.parse(readFileSync(p, "utf-8")) as ModelMeta;
  if (meta.version !== MODEL_VERSION) {
    throw new Error(
      `Model at .agentsurface/model/ was written by AgentSurface model version ` +
        `"${meta.version}", but this build expects "${MODEL_VERSION}". Run ` +
        `"agentsurface inspect" to regenerate it with the current version.`
    );
  }
}
