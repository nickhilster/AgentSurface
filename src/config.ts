import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import yaml from "js-yaml";
import { AgentSurfaceConfig, CatalogConfig, CatalogFieldConfig, DEFAULT_CONFIG, RouteOverride } from "./types/config.js";
import type { CatalogOperator, CatalogScalarType } from "./types/model.js";

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
  const catalogInput = root.catalogs ?? [];
  if (!Array.isArray(catalogInput)) throw new Error("catalogs must be an array.");
  const catalogs = catalogInput.map((entry, index) => validateCatalog(entry, index));
  const catalogIds = new Set<string>();
  for (const catalog of catalogs) {
    if (catalogIds.has(catalog.id)) throw new Error(`catalogs contains duplicate id "${catalog.id}".`);
    catalogIds.add(catalog.id);
  }

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
    catalogs,
    output: { dir: outputDir, markdownDir },
    ownership: { overwriteHumanOwned },
  };
}

function validateCatalog(value: unknown, index: number): CatalogConfig {
  const path = `catalogs[${index}]`;
  const entry = asRecord(value, path);
  assertAllowedKeys(entry, ["id", "entityKind", "scope", "source", "searchOperation", "detailOperation", "fieldAllowlist", "canonicalRoute", "maxResults", "freshness", "marketPolicy"], path);
  const id = requiredString(entry.id, `${path}.id`, /^[a-z][a-z0-9-]{0,62}$/);
  if (!["product", "service", "content"].includes(String(entry.entityKind))) throw new Error(`${path}.entityKind must be product, service, or content.`);
  if (entry.scope !== "public") throw new Error(`${path}.scope must explicitly be public.`);
  const source = asRecord(entry.source, `${path}.source`);
  assertAllowedKeys(source, ["kind", "file"], `${path}.source`);
  if (source.kind !== "openapi" && source.kind !== "static-jsonld") throw new Error(`${path}.source.kind must be openapi or static-jsonld.`);
  let normalizedSource: CatalogConfig["source"];
  let searchOperation: string | undefined;
  let detailOperation: string | undefined;
  if (source.kind === "openapi") {
    assertAllowedKeys(source, ["kind", "file"], `${path}.source`);
    normalizedSource = { kind: "openapi", file: normalizeRelativeDirectory(source.file, `${path}.source.file`) };
    searchOperation = requiredString(entry.searchOperation, `${path}.searchOperation`, /^[A-Za-z][A-Za-z0-9_.-]*$/);
    detailOperation = requiredString(entry.detailOperation, `${path}.detailOperation`, /^[A-Za-z][A-Za-z0-9_.-]*$/);
  } else {
    assertAllowedKeys(source, ["kind"], `${path}.source`);
    if (entry.searchOperation !== undefined || entry.detailOperation !== undefined) throw new Error(`${path}.searchOperation and detailOperation are not supported for static-jsonld.`);
    normalizedSource = { kind: "static-jsonld" };
  }
  if (!Array.isArray(entry.fieldAllowlist) || entry.fieldAllowlist.length === 0) throw new Error(`${path}.fieldAllowlist must contain at least one explicitly allowlisted field.`);
  const fieldAllowlist = entry.fieldAllowlist.map((field, fieldIndex) => validateCatalogField(field, `${path}.fieldAllowlist[${fieldIndex}]`));
  if (new Set(fieldAllowlist.map((field) => field.name)).size !== fieldAllowlist.length) throw new Error(`${path}.fieldAllowlist contains duplicate names.`);
  const canonicalRoute = validateCatalogRoute(entry.canonicalRoute, `${path}.canonicalRoute`);
  if (!Number.isInteger(entry.maxResults) || (entry.maxResults as number) < 1 || (entry.maxResults as number) > 100) {
    throw new Error(`${path}.maxResults must be an integer from 1 to 100.`);
  }
  const freshnessInput = asRecord(entry.freshness, `${path}.freshness`);
  assertAllowedKeys(freshnessInput, ["class", "observedAt", "maxAgeSeconds"], `${path}.freshness`);
  if (!["live", "periodic", "static", "unknown"].includes(String(freshnessInput.class))) throw new Error(`${path}.freshness.class must be live, periodic, static, or unknown.`);
  if (freshnessInput.maxAgeSeconds !== undefined && (!Number.isInteger(freshnessInput.maxAgeSeconds) || (freshnessInput.maxAgeSeconds as number) < 0)) throw new Error(`${path}.freshness.maxAgeSeconds must be a non-negative integer.`);
  const marketPolicy = entry.marketPolicy === undefined ? undefined : validateMarketPolicy(entry.marketPolicy, `${path}.marketPolicy`);
  return {
    id, entityKind: entry.entityKind as CatalogConfig["entityKind"], scope: "public",
    source: normalizedSource, ...(searchOperation ? { searchOperation } : {}), ...(detailOperation ? { detailOperation } : {}),
    fieldAllowlist, canonicalRoute, maxResults: entry.maxResults as number,
    freshness: {
      class: freshnessInput.class as CatalogConfig["freshness"]["class"],
      ...(typeof freshnessInput.observedAt === "string" ? { observedAt: freshnessInput.observedAt } : {}),
      ...(typeof freshnessInput.maxAgeSeconds === "number" ? { maxAgeSeconds: freshnessInput.maxAgeSeconds } : {}),
    },
    ...(marketPolicy ? { marketPolicy } : {}),
  };
}

function validateCatalogField(value: unknown, path: string): CatalogFieldConfig {
  const entry = asRecord(value, path);
  assertAllowedKeys(entry, ["name", "sourceField", "type", "operators", "filterable", "sortable", "unit"], path);
  const name = requiredString(entry.name, `${path}.name`, /^[a-z][a-zA-Z0-9_]{0,62}$/);
  const sourceField = requiredString(entry.sourceField, `${path}.sourceField`, /^[a-zA-Z_$][\w$.-]{0,127}$/);
  const types: CatalogScalarType[] = ["string", "number", "integer", "boolean", "date"];
  if (!types.includes(entry.type as CatalogScalarType)) throw new Error(`${path}.type is not a supported scalar type.`);
  const operators: CatalogOperator[] = ["eq", "contains", "gt", "gte", "lt", "lte", "in"];
  if (!Array.isArray(entry.operators) || entry.operators.some((operator) => !operators.includes(operator as CatalogOperator))) throw new Error(`${path}.operators contains an unsupported operator.`);
  const filterable = entry.filterable ?? true;
  const sortable = entry.sortable ?? false;
  if (typeof filterable !== "boolean" || typeof sortable !== "boolean") throw new Error(`${path}.filterable and sortable must be booleans.`);
  if (entry.unit !== undefined && (typeof entry.unit !== "string" || entry.unit.length > 32)) throw new Error(`${path}.unit must be a short string.`);
  return { name, sourceField, type: entry.type as CatalogScalarType, operators: entry.operators as CatalogOperator[], filterable, sortable, ...(entry.unit ? { unit: entry.unit as string } : {}) };
}

function validateMarketPolicy(value: unknown, path: string): NonNullable<CatalogConfig["marketPolicy"]> {
  const entry = asRecord(value, path);
  assertAllowedKeys(entry, ["allowedMarkets", "locationRequired"], path);
  if (!Array.isArray(entry.allowedMarkets) || entry.allowedMarkets.some((market) => typeof market !== "string" || !/^[A-Z0-9-]{2,8}$/.test(market))) throw new Error(`${path}.allowedMarkets must be an array of explicit market codes.`);
  if (typeof entry.locationRequired !== "boolean") throw new Error(`${path}.locationRequired must be a boolean.`);
  return { allowedMarkets: entry.allowedMarkets as string[], locationRequired: entry.locationRequired };
}

function validateCatalogRoute(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[%?#]/.test(value) || /(^|\/)\.{1,2}(\/|$)/.test(value)) {
    throw new Error(`${path} must be a canonical same-site route template.`);
  }
  return value;
}

function requiredString(value: unknown, path: string, pattern: RegExp): string {
  if (typeof value !== "string" || !pattern.test(value)) throw new Error(`${path} is missing or invalid.`);
  return value;
}

function assertAllowedKeys(value: Record<string, unknown>, allowed: string[], path: string): void {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${path}.${key} is not supported.`);
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
