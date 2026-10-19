import type { CatalogRecord, CatalogScalarType } from "../types/model.js";
import type { CatalogBackend, CatalogItemDetail, CatalogProvider, CatalogScalar, CatalogSearchInput, CatalogSearchResponse } from "./types.js";

const MAX_QUERY_LENGTH = 256;
const MAX_FILTERS = 20;
const MAX_CURSOR_LENGTH = 2048;

export function createCatalogProvider(
  catalog: CatalogRecord,
  backend: CatalogBackend,
  options: { allowedMarkets?: string[] } = {}
): CatalogProvider {
  const fields = new Map(catalog.fields.map((field) => [field.name, field]));

  return {
    async search(input): Promise<CatalogSearchResponse> {
      const normalized = normalizeInput(catalog, fields, input, options.allowedMarkets ?? []);
      const result = await backend.search(normalized);
      const items = result.items
        .map((item) => projectItem(item, fields))
        .filter((item): item is CatalogItemDetail => item !== null)
        .slice(0, normalized.limit)
        .map(({ description: _description, attributes: _attributes, ...summary }) => summary);
      return {
        items,
        nextCursor: typeof result.nextCursor === "string" && result.nextCursor.length <= MAX_CURSOR_LENGTH ? result.nextCursor : null,
        freshness: observedFreshness(catalog.freshness),
      };
    },
    async getById(id) {
      if (typeof id !== "string" || id.length === 0 || id.length > 256 || /[\u0000-\u001f]/.test(id)) throw new Error("catalog item id is invalid.");
      const item = await backend.getById(id);
      if (!item) return null;
      return projectItem(item, fields);
    },
  };
}

function normalizeInput(
  catalog: CatalogRecord,
  fields: Map<string, CatalogRecord["fields"][number]>,
  input: CatalogSearchInput,
  allowedMarkets: string[]
): CatalogSearchInput {
  if (!input || typeof input !== "object") throw new Error("catalog search input must be an object.");
  const limit = typeof input.limit === "number" && Number.isFinite(input.limit) ? Math.max(1, Math.min(catalog.maxResults, Math.floor(input.limit))) : 1;
  const query = input.query === undefined ? undefined : input.query.trim();
  if (query !== undefined && (typeof input.query !== "string" || query.length > MAX_QUERY_LENGTH || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(query))) {
    throw new Error(`query must be at most ${MAX_QUERY_LENGTH} safe characters.`);
  }
  if (query && !catalog.supportsQuery) throw new Error("catalog does not support free-text query.");
  const filters = input.filters ?? [];
  if (!Array.isArray(filters) || filters.length > MAX_FILTERS) throw new Error(`filters must contain at most ${MAX_FILTERS} entries.`);
  const normalizedFilters = filters.map((filter) => {
    const field = fields.get(filter.field);
    if (!field || !field.filterable) throw new Error(`unsupported field "${filter.field}".`);
    if (!field.operators.includes(filter.operator)) throw new Error(`unsupported operator "${filter.operator}" for field "${filter.field}".`);
    if (!validFilterValue(field.type, filter.operator, filter.value)) throw new Error(`invalid value for ${field.type} field "${field.name}".`);
    return { field: filter.field, operator: filter.operator, value: filter.value };
  });
  if (input.sort && (!catalog.supportsSorting || !fields.get(input.sort.field)?.sortable || !["asc", "desc"].includes(input.sort.direction))) {
    throw new Error(`unsupported sort field "${input.sort.field}".`);
  }
  if (input.cursor !== undefined && !catalog.supportsPagination) throw new Error("catalog does not support pagination.");
  if (input.cursor !== undefined && (typeof input.cursor !== "string" || input.cursor.length > MAX_CURSOR_LENGTH || /[\u0000-\u001f]/.test(input.cursor))) {
    throw new Error(`cursor must be at most ${MAX_CURSOR_LENGTH} safe characters.`);
  }
  if (input.market !== undefined && (!allowedMarkets.includes(input.market) || input.market.length > 32)) {
    throw new Error("market is not explicitly allowed for this catalog.");
  }
  if (catalog.marketPolicy?.locationRequired && input.market === undefined) {
    throw new Error("catalog requires an explicitly supplied market value.");
  }
  return {
    ...(query ? { query } : {}),
    ...(normalizedFilters.length ? { filters: normalizedFilters } : {}),
    ...(input.sort ? { sort: input.sort } : {}),
    limit,
    ...(input.cursor ? { cursor: input.cursor } : {}),
    ...(input.market === undefined ? {} : { market: input.market }),
  };
}

function validFilterValue(type: CatalogScalarType, operator: string, value: CatalogScalar | CatalogScalar[]): boolean {
  const values = operator === "in" ? value : [value];
  if (!Array.isArray(values) || values.length === 0 || values.length > 50) return false;
  return values.every((item) => {
    if (item === null) return false;
    if (type === "string") return typeof item === "string" && item.length <= 256;
    if (type === "number") return typeof item === "number" && Number.isFinite(item);
    if (type === "integer") return typeof item === "number" && Number.isSafeInteger(item);
    if (type === "boolean") return typeof item === "boolean";
    return typeof item === "string" && !Number.isNaN(Date.parse(item));
  });
}

function projectItem(item: CatalogItemDetail, fields: Map<string, CatalogRecord["fields"][number]>): CatalogItemDetail | null {
  if (!item || typeof item.id !== "string" || !item.id || typeof item.label !== "string" || !item.label || !isSafePath(item.canonicalPageUrl)) return null;
  const projectedFields: CatalogItemDetail["fields"] = {};
  for (const [name, definition] of fields) {
    if (!Object.prototype.hasOwnProperty.call(item.fields, name)) continue;
    const value = item.fields[name];
    if (value === null || validFieldValue(definition.type, value)) projectedFields[name] = value;
  }
  const attributes = item.attributes?.filter((attribute) => attribute && fields.has(attribute.name) && (attribute.value === null || validFieldValue(fields.get(attribute.name)!.type, attribute.value)));
  return {
    id: item.id,
    label: item.label,
    canonicalPageUrl: item.canonicalPageUrl,
    fields: projectedFields,
    ...(item.price ? { price: item.price } : {}),
    ...(item.availability ? { availability: item.availability } : {}),
    provenance: Array.isArray(item.provenance) ? item.provenance : [],
    freshness: item.freshness ?? { class: "unknown" },
    ...(typeof item.description === "string" ? { description: item.description } : {}),
    ...(attributes?.length ? { attributes } : {}),
  };
}

function validFieldValue(type: CatalogScalarType, value: unknown): value is Exclude<CatalogScalar, null> {
  if (type === "string") return typeof value === "string";
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  if (type === "integer") return typeof value === "number" && Number.isSafeInteger(value);
  if (type === "boolean") return typeof value === "boolean";
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isSafePath(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") &&
    !/[\\?#%\s\u0000-\u001f]/.test(value) && !/(^|\/)\.{1,2}(\/|$)/.test(value);
}

function observedFreshness(freshness: CatalogRecord["freshness"]): CatalogRecord["freshness"] {
  return freshness.class === "live" || freshness.class === "periodic"
    ? { ...freshness, observedAt: new Date().toISOString() }
    : freshness;
}
