import { existsSync } from "node:fs";
import { basename } from "node:path";
import { writeConfig } from "../config.js";
import { AgentSurfaceConfig, DEFAULT_CONFIG } from "../types/config.js";

export interface InitOptions {
  repoRoot: string;
  siteName?: string;
  hostnames?: string[];
}

export function runInit(opts: InitOptions): { path: string; created: boolean } {
  const configFile = ".agentsurface/config.yaml";
  const alreadyExists = existsSync(`${opts.repoRoot}/${configFile}`);
  if (alreadyExists) {
    // init must not silently clobber an existing config's customizations.
    throw new Error(
      `${configFile} already exists. init does not overwrite an existing config; edit it directly or remove it first.`
    );
  }

  const config: AgentSurfaceConfig = {
    ...DEFAULT_CONFIG,
    site: {
      name: opts.siteName ?? basename(opts.repoRoot),
      hostnames: opts.hostnames ?? [],
    },
  };

  return writeConfig(opts.repoRoot, config);
}
