import { existsSync, realpathSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { isIP } from "node:net";
import yaml from "js-yaml";
import { createCatalogProvider } from "../catalog.js";
import type { CatalogBackend, CatalogItemDetail, CatalogSearchInput } from "../types.js";
import type { AgentSurfaceConfig, CatalogConfig } from "../../types/config.js";
import type { CatalogFieldConfig } from "../../types/config.js";
import type { CatalogField, CatalogRecord, EntityRecord, ProvenanceRecord } from "../../types/model.js";

type JsonRecord = Record<string, unknown>;
type OperationRef = { path: string; method: string; operation: JsonRecord };

/** Inspect only owner-declared sources. An unsupported source is recorded as unknown and omitted. */
export async function inspectCatalogs(
  repoRoot: string,
  config: AgentSurfaceConfig,
  unknowns: string[] = [],
  entities: EntityRecord[] = []
): Promise<CatalogRecord[]> {
  const records: CatalogRecord[] = [];
  for (const declaration of config.catalogs) {
    try {
      if (declaration.source.kind === "static-jsonld") {
        const products = entities.filter((entity) => entity.kind === "product");
        if (products.length === 0) {
          unknowns.push(`catalog ${declaration.id}: no public static Schema.org products were found.`);
          continue;
        }
        records.push(staticCatalog(declaration));
        continue;
      }
      records.push(inspectOpenApiCatalog(repoRoot, declaration));
    } catch (error) {
      unknowns.push(`catalog ${declaration.id}: ${error instanceof Error ? error.message : "source contract could not be verified."}`);
    }
  }
  return records;
}

/** Bind a previously verified owner declaration to lazy, credential-free HTTPS GET calls. */
export async function bindOpenApiCatalogProvider(repoRoot: string, config: AgentSurfaceConfig, catalogId: string) {
  const declaration = config.catalogs.find((entry) => entry.id === catalogId);
  if (!declaration || declaration.source.kind !== "openapi") throw new Error(`OpenAPI catalog "${catalogId}" is not configured.`);
  const record = inspectOpenApiCatalog(repoRoot, declaration);
  const document = parseDocument(readFileSync(join(repoRoot, declaration.source.file), "utf-8"));
  const server = firstPublicServer(document.servers);
  const search = findOperation(document, declaration.searchOperation!);
  const detail = findOperation(document, declaration.detailOperation!);
  if (!server || !search || !detail) throw new Error(`OpenAPI catalog "${catalogId}" could not be bound.`);
  const backend: CatalogBackend = {
    async search(input: CatalogSearchInput) {
      const params = queryParameterNames(search.operation, document);
      const url = operationUrl(server, search.path);
      if (input.query) setFirstParam(url, params, ["q", "query", "search"], input.query);
      for (const filter of input.filters ?? []) {
        const field = declaration.fieldAllowlist.find((candidate) => candidate.name === filter.field);
        if (!field) throw new Error(`unsupported field "${filter.field}".`);
        const name = filter.operator === "eq" ? field.sourceField : `${field.sourceField}_${filter.operator}`;
        if (!params.has(name)) throw new Error(`OpenAPI source has no query parameter "${name}".`);
        const values = Array.isArray(filter.value) ? filter.value : [filter.value];
        for (const value of values) url.searchParams.append(name, String(value));
      }
      if (input.sort) throw new Error("OpenAPI sort mapping is not configured for this catalog.");
      const limitName = ["limit", "pageSize", "page_size"].find((name) => params.has(name));
      if (!limitName) throw new Error("OpenAPI source has no bounded result parameter.");
      url.searchParams.set(limitName, String(input.limit));
      if (input.cursor) {
        const cursorName = params.has("cursor") ? "cursor" : params.has("page") ? "page" : null;
        if (!cursorName) throw new Error("OpenAPI source does not support pagination.");
        url.searchParams.set(cursorName, input.cursor);
      }
      if (input.market) {
        if (!params.has("market")) throw new Error("OpenAPI source does not support market filtering.");
        url.searchParams.set("market", input.market);
      }
      const data = await getJson(url);
      const rows = isRecord(data) && Array.isArray(data.items) ? data.items : null;
      if (!rows) throw new Error("OpenAPI search response did not contain an items array.");
      return { items: rows.flatMap((row) => {
        const item = normalizeSourceItem(row, declaration, declaration.fieldAllowlist);
        return item ? [item] : [];
      }), nextCursor: isRecord(data) && typeof data.nextCursor === "string" ? data.nextCursor : null };
    },
    async getById(id: string) {
      const parameterNames = pathParameters(detail.path);
      if (parameterNames.length !== 1 || !/^[A-Za-z0-9._~-]{1,128}$/.test(id)) return null;
      const path = detail.path.replace(`{${parameterNames[0]}}`, encodeURIComponent(id));
      const data = await getJson(operationUrl(server, path));
      return normalizeSourceItem(data, declaration, declaration.fieldAllowlist, id);
    },
  };
  return createCatalogProvider(record, backend, { allowedMarkets: declaration.marketPolicy?.allowedMarkets ?? [] });
}

function operationUrl(server: string, path: string): URL {
  return new URL(`${server.replace(/\/$/, "")}${path}`, server);
}

function setFirstParam(url: URL, available: Set<string>, candidates: string[], value: string): void {
  const name = candidates.find((candidate) => available.has(candidate));
  if (!name) throw new Error("OpenAPI search operation has no declared query parameter.");
  url.searchParams.set(name, value);
}

async function getJson(url: URL): Promise<unknown> {
  const response = await fetch(url, { method: "GET", headers: { accept: "application/json" }, redirect: "error" });
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > 5_000_000) throw new Error("OpenAPI response exceeds the 5 MB response bound.");
  const text = await response.text();
  if (!response.ok) throw new Error(`OpenAPI GET failed with HTTP ${response.status}.`);
  if (new TextEncoder().encode(text).byteLength > 5_000_000) throw new Error("OpenAPI response exceeds the 5 MB response bound.");
  try { return JSON.parse(text) as unknown; } catch { throw new Error("OpenAPI GET returned invalid JSON."); }
}

function normalizeSourceItem(value: unknown, declaration: CatalogConfig, fields: CatalogFieldConfig[], idOverride?: string): CatalogItemDetail | null {
  if (!isRecord(value)) return null;
  const idField = typeof value.id === "string" ? "id" : typeof value.sku === "string" ? "sku" : null;
  const id = idOverride ?? (idField ? String(value[idField]) : "");
  const label = [value.name, value.title, value.label].find((candidate) => typeof candidate === "string");
  const safeRouteId = /^[A-Za-z0-9._~-]{1,128}$/.test(id) ? id : null;
  const placeholders = [...declaration.canonicalRoute.matchAll(/\{([^{}]+)\}/g)];
  if (!id || typeof label !== "string" || !safeRouteId || placeholders.length !== 1) return null;
  const canonicalPageUrl = declaration.canonicalRoute.replace(`{${placeholders[0][1]}}`, safeRouteId);
  const projected: Record<string, string | number | boolean | null> = {};
  const provenance = fields.map((field) => ({
    subject: `entity:${id}.${field.name}`, claim: `catalog-field:${field.name}`,
    source: `${declaration.source.kind === "openapi" ? declaration.source.file : "public JSON-LD"}:${field.sourceField}`,
    method: declaration.source.kind === "openapi" ? "openapi-contract" as const : "schema-org-jsonld" as const,
    confidence: 1,
  }));
  for (const field of fields) {
    const fieldValue = nestedValue(value, field.sourceField.split("."));
    if (fieldValue === null || typeof fieldValue === "string" || typeof fieldValue === "number" && Number.isFinite(fieldValue) || typeof fieldValue === "boolean") projected[field.name] = fieldValue as string | number | boolean | null;
  }
  return {
    id, label, canonicalPageUrl, fields: projected, provenance,
    freshness: declaration.freshness.class === "live" || declaration.freshness.class === "periodic"
      ? { ...declaration.freshness, observedAt: new Date().toISOString() }
      : declaration.freshness,
    ...(typeof value.description === "string" ? { description: value.description } : {}),
  };
}

function nestedValue(record: JsonRecord, path: string[]): unknown {
  let current: unknown = record;
  for (const segment of path) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function inspectOpenApiCatalog(repoRoot: string, declaration: CatalogConfig): CatalogRecord {
  if (declaration.source.kind !== "openapi") throw new Error("OpenAPI source is required.");
  const file = declaration.source.file;
  const fullPath = resolve(repoRoot, file);
  const rootReal = realpathSync(repoRoot);
  if (!existsSync(fullPath)) throw new Error(`OpenAPI file ${file} does not exist or cannot be read.`);
  const actualRelative = relative(rootReal, realpathSync(fullPath));
  if (actualRelative === ".." || actualRelative.startsWith(`..${sep}`) || isAbsolute(actualRelative)) throw new Error("OpenAPI source resolves outside the repository.");
  const document = parseDocument(readFileSync(fullPath, "utf-8"));
  if (typeof document.openapi !== "string" || !document.openapi.startsWith("3.")) throw new Error("only OpenAPI 3.x contracts are supported.");
  const server = firstPublicServer(document.servers);
  if (!server) throw new Error("a public HTTPS OpenAPI server URL is required.");
  const search = findOperation(document, declaration.searchOperation!);
  const detail = findOperation(document, declaration.detailOperation!);
  verifyReadOperation(search, document);
  verifyReadOperation(detail, document);
  if (!search || !detail) throw new Error("declared search/detail operation was not found.");
  if (pathParameters(detail.path).length !== 1 || !pathParameters(detail.path).every((parameter) => hasParameter(detail.operation, document, parameter, "path"))) {
    throw new Error(`detail operation ${declaration.detailOperation} has an unresolved path parameter.`);
  }
  if ([...declaration.canonicalRoute.matchAll(/\{([^{}]+)\}/g)].length !== 1) throw new Error("canonicalRoute must contain exactly one item ID placeholder for this adapter.");
  const searchProperties = responseProperties(document, search, true);
  const detailProperties = responseProperties(document, detail, false);
  if (!hasStringProperty(document, searchProperties, ["id", "sku"]) || !hasStringProperty(document, detailProperties, ["id", "sku"]) ||
      !hasStringProperty(document, searchProperties, ["name", "title", "label"]) || !hasStringProperty(document, detailProperties, ["name", "title", "label"])) {
    throw new Error("search/detail response schema must expose a stable string id and a string name, title, or label.");
  }
  const searchParams = queryParameterNames(search.operation, document);
  if (!["limit", "pageSize", "page_size"].some((name) => searchParams.has(name))) throw new Error("search operation must expose a bounded result limit parameter.");
  if (declaration.fieldAllowlist.some((field) => field.sortable)) throw new Error("dynamic sort mapping is not declared by the initial OpenAPI catalog adapter.");
  if (declaration.marketPolicy && declaration.marketPolicy.allowedMarkets.length > 0 && !searchParams.has("market")) throw new Error("search operation lacks the configured market parameter.");
  if (declaration.marketPolicy?.locationRequired && !searchParams.has("market")) throw new Error("search operation lacks the required market parameter.");
  const fields: CatalogField[] = declaration.fieldAllowlist.map((field) => {
    const responsePath = field.sourceField.split(".");
    if (!schemaHasPath(document, searchProperties, responsePath) || !schemaHasPath(document, detailProperties, responsePath)) {
      throw new Error(`field ${field.name} is missing from the declared search/detail response schema.`);
    }
    const expectedType = openApiType(field.type);
    if (schemaTypeAtPath(document, searchProperties, responsePath) !== expectedType || schemaTypeAtPath(document, detailProperties, responsePath) !== expectedType) {
      throw new Error(`field ${field.name} does not match its declared ${field.type} response type.`);
    }
    for (const operator of field.operators) {
      const parameterName = operator === "eq" ? field.sourceField : `${field.sourceField}_${operator}`;
      if (field.filterable !== false && !searchParams.has(parameterName)) {
        throw new Error(`search operation lacks query parameter ${parameterName} for field ${field.name}.`);
      }
    }
    return {
      name: field.name, type: field.type, filterable: field.filterable ?? true,
      sortable: false, operators: field.operators,
      ...(field.unit ? { unit: field.unit } : {}),
    };
  });
  const source = {
    kind: "openapi" as const,
    file: declaration.source.file,
    searchOperation: declaration.searchOperation,
    detailOperation: declaration.detailOperation,
  };
  const provenance: ProvenanceRecord[] = [{
    subject: `catalog:${declaration.id}`,
    claim: `public-read-contract:${server}`,
    source: declaration.source.file,
    method: "openapi-contract",
    confidence: 1,
  }];
  if (declaration.freshness.class !== "unknown") provenance.push({
    subject: `catalog:${declaration.id}.freshness`, claim: `freshness:${declaration.freshness.class}`,
    source: ".agentsurface/config.yaml:catalogs.freshness", method: "owner-config", confidence: 1,
  });
  const params = new Set([...searchParams]);
  return {
    id: declaration.id, entityKind: declaration.entityKind, scope: "public", source,
    searchOperation: declaration.searchOperation!, detailOperation: declaration.detailOperation!,
    canonicalRoute: declaration.canonicalRoute, ...(declaration.marketPolicy ? { marketPolicy: declaration.marketPolicy } : {}), fields,
    searchMode: "read-api", supportsQuery: ["q", "query", "search"].some((name) => params.has(name)),
    supportsSorting: false,
    supportsPagination: params.has("cursor") || params.has("page"),
    maxResults: declaration.maxResults, freshness: declaration.freshness, provenance,
  };
}

function staticCatalog(declaration: CatalogConfig): CatalogRecord {
  const fields: CatalogField[] = declaration.fieldAllowlist.map((field) => ({
    name: field.name, type: field.type, filterable: field.filterable ?? true,
    sortable: field.sortable ?? false, operators: field.operators,
    ...(field.unit ? { unit: field.unit } : {}),
  }));
  return {
    id: declaration.id, entityKind: declaration.entityKind, scope: "public",
    source: { kind: "static-jsonld", file: "public/**/*.html" },
    searchOperation: null, detailOperation: null, canonicalRoute: declaration.canonicalRoute,
    ...(declaration.marketPolicy ? { marketPolicy: declaration.marketPolicy } : {}),
    fields, searchMode: "static-index", supportsQuery: true,
    supportsSorting: fields.some((field) => field.sortable), supportsPagination: true,
    maxResults: declaration.maxResults, freshness: { class: "static" },
    provenance: [{ subject: `catalog:${declaration.id}`, claim: "owner-configured-static-index", source: ".agentsurface/config.yaml:catalogs", method: "owner-config", confidence: 1 }],
  };
}

function parseDocument(text: string): JsonRecord {
  const value = yaml.load(text);
  if (!isRecord(value)) throw new Error("OpenAPI document must be an object.");
  return value;
}

function firstPublicServer(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  for (const item of value) {
    if (!isRecord(item) || typeof item.url !== "string" || item.variables !== undefined) continue;
    try {
      const url = new URL(item.url);
      if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
          isIP(url.hostname.replace(/^\[|\]$/g, "")) !== 0 || /^(localhost|.*\.localhost|.*\.local|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url.hostname)) continue;
      return url.toString().replace(/\/$/, "");
    } catch { /* ignore invalid server */ }
  }
  return null;
}

function findOperation(document: JsonRecord, operationId: string): OperationRef | null {
  if (!isRecord(document.paths)) return null;
  const matches: OperationRef[] = [];
  for (const [path, pathItem] of Object.entries(document.paths)) {
    if (!path.startsWith("/") || path.startsWith("//") || /[?#\\%]/.test(path) || /(^|\/)\.{1,2}(\/|$)/.test(path)) throw new Error(`OpenAPI path ${path} is not a safe relative path.`);
    if (!isRecord(pathItem)) continue;
    for (const [method, operation] of Object.entries(pathItem)) {
      if (isRecord(operation) && operation.operationId === operationId) matches.push({ path, method: method.toLowerCase(), operation });
    }
  }
  if (matches.length !== 1) throw new Error(`operation ${operationId} must resolve exactly once.`);
  return matches[0];
}

function verifyReadOperation(ref: OperationRef | null, document: JsonRecord): asserts ref is OperationRef {
  if (!ref) throw new Error("declared operation was not found.");
  if (ref.method !== "get") throw new Error(`operation ${String(ref.operation.operationId)} must use GET; mutations are not supported.`);
  if (ref.operation.requestBody !== undefined) throw new Error(`GET operation ${String(ref.operation.operationId)} must not declare a request body.`);
  const security = ref.operation.security ?? document.security;
  if (Array.isArray(security) && security.length > 0) throw new Error(`operation ${String(ref.operation.operationId)} declares security/authentication.`);
}

function responseProperties(document: JsonRecord, operation: OperationRef, list: boolean): JsonRecord {
  const responses = operation.operation.responses;
  if (!isRecord(responses) || !isRecord(responses["200"])) throw new Error(`operation ${String(operation.operation.operationId)} must declare a 200 JSON response.`);
  const content = (responses["200"] as JsonRecord).content;
  const json = isRecord(content) ? content["application/json"] : undefined;
  const root = isRecord(json) ? resolveSchema(document, (json as JsonRecord).schema) : null;
  if (!root) throw new Error(`operation ${String(operation.operation.operationId)} has an unsupported response schema.`);
  const item = list ? (isRecord(root.properties) ? root.properties.items : undefined) : root;
  const itemSchema = list && isRecord(item) && item.type === "array" ? resolveSchema(document, item.items) : list ? null : root;
  if (!itemSchema || itemSchema.type !== "object" || !isRecord(itemSchema.properties)) throw new Error(`operation ${String(operation.operation.operationId)} has an unsupported ${list ? "list" : "detail"} response schema.`);
  return itemSchema.properties;
}

function resolveSchema(document: JsonRecord, schema: unknown): JsonRecord | null {
  if (!isRecord(schema)) return null;
  if (typeof schema.$ref === "string") {
    const match = schema.$ref.match(/^#\/components\/schemas\/([^/]+)$/);
    if (!match || !isRecord(document.components) || !isRecord(document.components.schemas)) return null;
    return resolveSchema(document, (document.components.schemas as JsonRecord)[match[1]]);
  }
  return schema;
}

function schemaHasPath(document: JsonRecord, properties: JsonRecord, path: string[]): boolean {
  if (path.length === 0) return true;
  const property = properties[path[0]];
  if (!isRecord(property)) return false;
  if (path.length === 1) return true;
  const nested = resolveSchema(document, property);
  return nested !== null && isRecord(nested.properties) && schemaHasPath(document, nested.properties, path.slice(1));
}

function hasStringProperty(document: JsonRecord, properties: JsonRecord, names: string[]): boolean {
  return names.some((name) => schemaTypeAtPath(document, properties, [name]) === "string");
}

function schemaTypeAtPath(document: JsonRecord, properties: JsonRecord, path: string[]): string | null {
  const property = properties[path[0]];
  if (!isRecord(property)) return null;
  const resolved = resolveSchema(document, property);
  if (!resolved) return null;
  if (path.length === 1) return typeof resolved.type === "string" ? resolved.type : null;
  return isRecord(resolved.properties) ? schemaTypeAtPath(document, resolved.properties, path.slice(1)) : null;
}

function openApiType(type: string): string {
  return type === "integer" ? "integer" : type === "number" ? "number" : type === "boolean" ? "boolean" : "string";
}

function queryParameterNames(operation: JsonRecord, document: JsonRecord): Set<string> {
  const parameters = resolveParameters(operation.parameters, document);
  return new Set(parameters.filter((parameter) => parameter.in === "query" && typeof parameter.name === "string").map((parameter) => parameter.name as string));
}

function hasParameter(operation: JsonRecord, document: JsonRecord, name: string, location: string): boolean {
  return resolveParameters(operation.parameters, document).some((parameter) => parameter.name === name && parameter.in === location && (location !== "path" || parameter.required === true));
}

function resolveParameters(value: unknown, document: JsonRecord): JsonRecord[] {
  if (!Array.isArray(value)) return [];
  return value.map((parameter) => {
    if (!isRecord(parameter)) return null;
    if (typeof parameter.$ref !== "string") return parameter;
    const match = parameter.$ref.match(/^#\/components\/parameters\/([^/]+)$/);
    return match && isRecord(document.components) && isRecord(document.components.parameters) && isRecord(document.components.parameters[match[1]])
      ? document.components.parameters[match[1]] as JsonRecord : null;
  }).filter((parameter): parameter is JsonRecord => parameter !== null);
}

function pathParameters(path: string): string[] {
  return [...path.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1]);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
