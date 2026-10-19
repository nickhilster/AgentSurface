import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import yaml from "js-yaml";
import { AgentSurfaceConfig, DEFAULT_CONFIG, RouteOverride } from "./types/config.js";

export function configPath(repoRoot: string): string {
  return join(repoRoot, ".agentsurface", "config.yaml");
}

export function loadConfig(repoRoot: string): AgentSurfaceConfig {
  const p = configPath(repoRoot);
  if (!existsSync(p)) {
    throw new Error(`No AgentSurface config found at ${p}. Run "agentsurface init" first.`);
  }
  const raw = readFileSync(p, "utf-8");
  return validateConfig(yaml.load(raw));
}

/** Validate untrusted YAML config and fill fields introduced after v0.1 defaults. */
export function validateConfig(value: unknown): AgentSurfaceConfig {
  const root = asRecord(value, "config");
  if (root.version !== undefined && root.version !== DEFAULT_CONFIG.version) {
    throw new Error(`config.version must be "${DEFAULT_CONFIG.version}".`);
  }
  const siteInput = optionalRecord(root.site, "site");
  const routesInput = optionalRecord(root.routes, "routes");
  const outputInput = optionalRecord(root.output, "output");
  const ownershipInput = optionalRecord(root.ownership, "ownership");

  const name = siteInput.name ?? DEFAULT_CONFIG.site.name;
  if (typeof name !== "string") throw new Error("site.name must be a string.");
  const hostnamesInput = siteInput.hostnames ?? DEFAULT_CONFIG.site.hostnames;
  if (!Array.isArray(hostnamesInput)) throw new Error("site.hostnames must be an array of hostnames.");
  const hostnames = hostnamesInput.map((hostname, i) => normalizeHostname(hostname, `site.hostnames[${i}]`));

  const excludeInput = routesInput.exclude ?? DEFAULT_CONFIG.routes.exclude;
  if (!Array.isArray(excludeInput) || excludeInput.some((path) => typeof path !== "string")) {
    throw new Error("routes.exclude must be an array of route paths.");
  }
  const exclude = excludeInput.map((path, i) => normalizeRoutePath(path, `routes.exclude[${i}]`));
  const overrideInput = routesInput.overrides ?? [];
  if (!Array.isArray(overrideInput)) throw new Error("routes.overrides must be an array.");
  const overrides = overrideInput.map((entry, i) => validateRouteOverride(entry, i));
  const seenOverridePaths = new Set<string>();
  for (const override of overrides) {
    if (seenOverridePaths.has(override.path)) throw new Error(`routes.overrides contains duplicate path "${override.path}".`);
    seenOverridePaths.add(override.path);
  }

  const outputDir = normalizeRelativeDirectory(outputInput.dir ?? DEFAULT_CONFIG.output.dir, "output.dir");
  const markdownDirValue = outputInput.markdownDir ?? DEFAULT_CONFIG.output.markdownDir;
  const markdownDir = markdownDirValue === undefined
    ? undefined
    : normalizeRelativeDirectory(markdownDirValue, "output.markdownDir");
  const overwriteHumanOwned = ownershipInput.overwriteHumanOwned ?? DEFAULT_CONFIG.ownership.overwriteHumanOwned;
  if (typeof overwriteHumanOwned !== "boolean") throw new Error("ownership.overwriteHumanOwned must be a boolean.");

  return {
    version: DEFAULT_CONFIG.version,
    site: { name, hostnames },
    routes: { exclude, overrides },
    output: { dir: outputDir, markdownDir },
    ownership: { overwriteHumanOwned },
  };
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${path} must be an object.`);
  return value as Record<string, unknown>;
}

function optionalRecord(value: unknown, path: string): Record<string, unknown> {
  return value === undefined ? {} : asRecord(value, path);
}

function normalizeHostname(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0 || /[/:?#@\\]/.test(value)) {
    throw new Error(`${path} must be a hostname without a scheme, path, credentials, or port.`);
  }
  let parsed: URL;
  try { parsed = new URL(`https://${value}`); } catch { throw new Error(`${path} must be a valid hostname.`); }
  if (parsed.hostname !== value.toLowerCase() || parsed.port || parsed.pathname !== "/") {
    throw new Error(`${path} must be a hostname without a scheme, path, credentials, or port.`);
  }
  return parsed.hostname.toLowerCase().replace(/\.$/, "");
}

function normalizeRelativeDirectory(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0 || value.includes("\\") || value.includes(":") || value.startsWith("/")) {
    throw new Error(`${path} must be a non-empty relative path using forward slashes.`);
  }
  const segments = value.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`${path} must not contain empty, ".", or ".." path segments.`);
  }
  return segments.join("/");
}

function normalizeRoutePath(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[%?#]/.test(value)) {
    throw new Error(`${path} must be a canonical route path beginning with one slash and without query or fragment.`);
  }
  if (value !== "/" && (value.endsWith("/") || value.slice(1).split("/").some((part) => part === "." || part === ".." || part === ""))) {
    throw new Error(`${path} must be normalized and must not contain empty, ".", or ".." path segments.`);
  }
  return value;
}

function validateRouteOverride(value: unknown, index: number): RouteOverride {
  const path = `routes.overrides[${index}]`;
  const entry = asRecord(value, path);
  const allowed = new Set(["path", "classification", "contentBoundaryTag"]);
  for (const key of Object.keys(entry)) {
    if (!allowed.has(key)) throw new Error(`${path}.${key} is not supported; owner overrides cannot set confidence or provenance.`);
  }
  const routePath = normalizeRoutePath(entry.path, `${path}.path`);
  const classifications = ["public-static", "public-dynamic", "transactional", "authenticated", "private-internal", "unsafe-to-expose", "unknown"];
  if (entry.classification !== undefined && !classifications.includes(String(entry.classification))) {
    throw new Error(`${path}.classification must be a supported content classification.`);
  }
  if (entry.contentBoundaryTag !== undefined && (typeof entry.contentBoundaryTag !== "string" || !/^[a-z][a-z0-9-]*$/i.test(entry.contentBoundaryTag))) {
    throw new Error(`${path}.contentBoundaryTag must be a valid HTML tag name.`);
  }
  if (entry.classification === undefined && entry.contentBoundaryTag === undefined) {
    throw new Error(`${path} must declare classification or contentBoundaryTag.`);
  }
  return {
    path: routePath,
    ...(entry.classification === undefined ? {} : { classification: entry.classification as RouteOverride["classification"] }),
    ...(entry.contentBoundaryTag === undefined ? {} : { contentBoundaryTag: entry.contentBoundaryTag as string }),
  };
}

export function writeConfig(repoRoot: string, config: AgentSurfaceConfig): { path: string; created: boolean } {
  const p = configPath(repoRoot);
  const created = !existsSync(p);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, yaml.dump(config), "utf-8");
  return { path: p, created };
}
