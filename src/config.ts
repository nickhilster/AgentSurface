import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import yaml from "js-yaml";
import { AgentSurfaceConfig, DEFAULT_CONFIG } from "./types/config.js";

export function configPath(repoRoot: string): string {
  return join(repoRoot, ".agentsurface", "config.yaml");
}

export function loadConfig(repoRoot: string): AgentSurfaceConfig {
  const p = configPath(repoRoot);
  if (!existsSync(p)) {
    throw new Error(`No AgentSurface config found at ${p}. Run "agentsurface init" first.`);
  }
  const raw = readFileSync(p, "utf-8");
  const parsed = yaml.load(raw) as AgentSurfaceConfig;
  return { ...DEFAULT_CONFIG, ...parsed };
}

export function writeConfig(repoRoot: string, config: AgentSurfaceConfig): { path: string; created: boolean } {
  const p = configPath(repoRoot);
  const created = !existsSync(p);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, yaml.dump(config), "utf-8");
  return { path: p, created };
}
