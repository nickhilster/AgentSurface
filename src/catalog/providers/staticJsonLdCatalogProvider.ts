import type { CatalogConfig } from "../../types/config.js";
import type { CatalogRecord, ProductRecord } from "../../types/model.js";
import { createCatalogProvider } from "../catalog.js";
import type { CatalogBackend, CatalogItemDetail } from "../types.js";

/** Create a bounded local provider from only the inspected, public Product entities. */
export function createStaticJsonLdCatalogProvider(
  declaration: CatalogConfig,
  catalog: CatalogRecord,
  products: ProductRecord[]
) {
  const entries = products.map((product) => mapProduct(product, declaration));
  const byId = new Map(entries.map((item) => [item.id, item]));
  const backend: CatalogBackend = {
    async search(input) {
      let found = entries.filter((item) => {
        if (input.market && !products.find((product) => product.id === item.id)?.market.includes(input.market)) return false;
        if (input.query) {
          const haystack = [item.label, ...Object.values(item.fields).map(String)].join(" ").toLocaleLowerCase();
          if (!haystack.includes(input.query.toLocaleLowerCase())) return false;
        }
        return (input.filters ?? []).every((filter) => matches(item.fields[filter.field], filter.operator, filter.value));
      });
      if (input.sort) {
        const direction = input.sort.direction === "asc" ? 1 : -1;
        found = [...found].sort((left, right) => compare(left.fields[input.sort!.field], right.fields[input.sort!.field]) * direction);
      }
      const offset = input.cursor ? Number(input.cursor) : 0;
      if (!Number.isSafeInteger(offset) || offset < 0) throw new Error("static catalog cursor is invalid.");
      const items = found.slice(offset, offset + input.limit);
      const nextOffset = offset + items.length;
      return { items, nextCursor: nextOffset < found.length ? String(nextOffset) : null };
    },
    async getById(id) { return byId.get(id) ?? null; },
  };
  return createCatalogProvider(catalog, backend, { allowedMarkets: declaration.marketPolicy?.allowedMarkets ?? [] });
}

function mapProduct(product: ProductRecord, declaration: CatalogConfig): CatalogItemDetail {
  const fields: CatalogItemDetail["fields"] = {};
  for (const field of declaration.fieldAllowlist) {
    const value = sourceValue(product, field.sourceField);
    fields[field.name] = value === undefined ? null : value;
  }
  const attributes = product.attributes.filter((attribute) => declaration.fieldAllowlist.some((field) => field.sourceField === `attributes.${attribute.name}`));
  return {
    id: product.id,
    label: product.label,
    canonicalPageUrl: product.canonicalPageUrl ?? "",
    fields,
    ...(product.price ? { price: product.price } : {}),
    ...(product.availability ? { availability: product.availability } : {}),
    provenance: product.provenance,
    freshness: { class: "static" },
    ...(product.description ? { description: product.description } : {}),
    ...(attributes.length ? { attributes } : {}),
  };
}

function sourceValue(product: ProductRecord, path: string): string | number | boolean | null | undefined {
  const [root, child] = path.split(".", 2);
  if (root === "label") return product.label;
  if (root === "description") return product.description;
  if (root === "id") return product.id;
  if (root === "market") return product.market[0];
  if (root === "locale") return product.locale ?? undefined;
  if (root === "price") return child === "amount" ? product.price?.amount : child === "currency" ? product.price?.currency : undefined;
  if (root === "availability") return child === "value" ? product.availability?.value : undefined;
  if (root === "attributes" && child) return product.attributes.find((attribute) => attribute.name === child)?.value as string | number | boolean | undefined;
  return undefined;
}

function matches(actual: string | number | boolean | null, operator: string, expected: unknown): boolean {
  if (actual === null) return false;
  if (operator === "in") return Array.isArray(expected) && expected.includes(actual);
  if (operator === "eq") return actual === expected;
  if (operator === "contains") return typeof actual === "string" && typeof expected === "string" && actual.toLocaleLowerCase().includes(expected.toLocaleLowerCase());
  if (typeof actual === "number" && typeof expected === "number") {
    if (operator === "gt") return actual > expected;
    if (operator === "gte") return actual >= expected;
    if (operator === "lt") return actual < expected;
    if (operator === "lte") return actual <= expected;
  }
  if (typeof actual === "string" && typeof expected === "string") {
    const a = Date.parse(actual); const b = Date.parse(expected);
    if (Number.isNaN(a) || Number.isNaN(b)) return false;
    if (operator === "gt") return a > b;
    if (operator === "gte") return a >= b;
    if (operator === "lt") return a < b;
    if (operator === "lte") return a <= b;
  }
  return false;
}

function compare(left: string | number | boolean | null | undefined, right: string | number | boolean | null | undefined): number {
  if (left === null || left === undefined) return right === null || right === undefined ? 0 : 1;
  if (right === null || right === undefined) return -1;
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right));
}
