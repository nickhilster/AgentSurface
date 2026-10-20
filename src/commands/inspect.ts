import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config.js";
import { NextAppRouterAdapter } from "../adapters/nextAppRouter.js";
import { ViteStaticAdapter } from "../adapters/viteStatic.js";
import { inspectCatalogs } from "../catalog/providers/openApiCatalogProvider.js";
import { MODEL_VERSION, writeModelMeta } from "../lib/modelVersion.js";
import type { CanonicalSiteModel, FrameworkAdapter, ProductRecord, ProvenanceRecord, RouteRecord } from "../types/model.js";

export interface InspectOptions {
  repoRoot: string;
}

const ADAPTERS: FrameworkAdapter[] = [new NextAppRouterAdapter(), new ViteStaticAdapter()];

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
  const normalizePath = (path: string) => path === "/" ? "/" : `/${path.replace(/^\/+|\/+$/g, "")}`;
  for (const override of config.routes.overrides ?? []) {
    const route = routes.find((candidate) => normalizePath(candidate.path) === override.path);
    if (!route) {
      unknowns.push(`configured route override ${override.path} did not match an inspected route.`);
      continue;
    }
    if (override.classification !== undefined) route.classification = override.classification;
    if (override.contentBoundaryTag !== undefined) route.contentBoundaryTag = override.contentBoundaryTag;
    const claims = [
      override.classification === undefined ? null : `classification:${override.classification}`,
      override.contentBoundaryTag === undefined ? null : `content-boundary-tag:${override.contentBoundaryTag}`,
    ].filter((claim): claim is string => claim !== null);
    route.provenance.push({
      subject: `route:${route.path}`,
      claim: claims.join(","),
      source: ".agentsurface/config.yaml:routes.overrides",
      method: "owner-config",
      confidence: 1,
    });
  }
  const capabilities = bestAdapter?.inspectCapabilities
    ? await bestAdapter.inspectCapabilities({ rootDir: opts.repoRoot })
    : [];
  const entities: ProductRecord[] = [];
  for (const route of routes) {
    if (route.classification !== "public-static" || route.surfaceType !== "static-content") continue;
    for (const sourceFile of route.sourceFiles) {
      if (!sourceFile.startsWith("public/") || !/\.html?$/i.test(sourceFile)) continue;
      const sourcePath = join(opts.repoRoot, sourceFile);
      if (!existsSync(sourcePath)) continue;
      entities.push(...productsFromJsonLd(readFileSync(sourcePath, "utf-8"), sourceFile, route, routes, config.site.hostnames));
    }
  }
  const catalogs = await inspectCatalogs(opts.repoRoot, config, unknowns, entities);

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
    version: MODEL_VERSION,
    generatedAt: new Date().toISOString(),
    site: {
      name: config.site.name,
      framework: bestFrameworkName,
      frameworkConfidence: bestConfidence,
      rootDir: opts.repoRoot,
      hostnames: config.site.hostnames,
    },
    routes,
    entities,
    catalogs,
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

  writeModelMeta(repoRoot, model);
  writeFileSync(join(modelDir, "site.json"), JSON.stringify(model.site, null, 2) + "\n", "utf-8");
  writeFileSync(join(modelDir, "routes.json"), JSON.stringify(model.routes, null, 2) + "\n", "utf-8");
  writeFileSync(join(modelDir, "entities.json"), JSON.stringify(model.entities, null, 2) + "\n", "utf-8");
  writeFileSync(join(modelDir, "catalogs.json"), JSON.stringify(model.catalogs, null, 2) + "\n", "utf-8");
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

function productsFromJsonLd(html: string, source: string, route: RouteRecord, routes: RouteRecord[], hostnames: string[]): ProductRecord[] {
  const products: ProductRecord[] = [];
  const candidates = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)]
    .flatMap((match) => {
      try { return flattenJsonLd(JSON.parse(match[1])); } catch { return []; }
    })
    .filter(isSchemaOrgProduct);
  const isSingleProductPage = candidates.length === 1;
  for (const candidate of candidates) {
    const name = stringValue(candidate.name);
    const sku = stringValue(candidate.sku);
    const id = sku ? `sku:${sku}` : stringValue(candidate.mpn) ? `mpn:${stringValue(candidate.mpn)}` : null;
    if (!name || !id) continue;
    const provenance = (claim: string): ProvenanceRecord => ({
      subject: `entity:${id}`,
      claim,
      source,
      method: "schema-org-jsonld",
      confidence: 1,
    });
    const attributes: ProductRecord["attributes"] = [];
    const brand = typeof candidate.brand === "string" ? candidate.brand : isObject(candidate.brand) ? stringValue(candidate.brand.name) : null;
    if (brand) attributes.push({ name: "brand", value: brand, type: "string", provenance: [provenance(`product:brand:${brand}`)] });
    const offer = firstOffer(candidate.offers);
    const priceAmount = offer ? numberValue(offer.price) : null;
    const currency = offer ? stringValue(offer.priceCurrency) : null;
    const freshness = { class: "unknown" as const };
    const productUrl = stringValue(candidate.url);
    const candidateUrl = productUrl ?? stringValue(candidate["@id"]);
    const canonicalPageUrl = candidateUrl
      ? candidateProductRoute(candidateUrl, route, routes, hostnames, isSingleProductPage, productUrl === null)
      : null;
    const product: ProductRecord = {
      id, kind: "product", label: name,
      sourceFiles: [source],
      provenance: [provenance(`product:name:${name}`)],
      ...(stringValue(candidate.description) ? { description: stringValue(candidate.description)! } : {}),
      attributes,
      ...(priceAmount !== null && currency && /^[A-Z]{3}$/.test(currency) ? {
        price: { amount: priceAmount, currency, kind: "offer", freshness, provenance: [provenance(`product:price:${priceAmount} ${currency}`)] },
      } : {}),
      ...(offer && stringValue(offer.availability) ? {
        availability: { value: stringValue(offer.availability)!, freshness, provenance: [provenance(`product:availability:${stringValue(offer.availability)}`)] },
      } : {}),
      market: [],
      locale: null,
      canonicalPageUrl,
    };
    products.push(product);
  }
  return products;
}

function candidateProductRoute(
  candidateUrl: string,
  sourceRoute: RouteRecord,
  routes: RouteRecord[],
  hostnames: string[],
  isSingleProductPage: boolean,
  allowEntityFragment: boolean
): string | null {
  try {
    const base = sourceRoute.canonicalUrl
      ? new URL(sourceRoute.canonicalUrl)
      : new URL(sourceRoute.path, "https://agentsurface.invalid");
    const target = new URL(candidateUrl, base);
    if (!/^https?:$/.test(target.protocol) || target.search || target.hash && !allowEntityFragment) return null;
    const isAbsoluteUrl = /^[a-z][a-z\d+.-]*:/i.test(candidateUrl) || candidateUrl.startsWith("//");
    if (isAbsoluteUrl && (!hostnames.length || !hostnames.some((hostname) => hostname.toLocaleLowerCase() === target.hostname.toLocaleLowerCase()))) return null;
    target.hash = "";
    const normalizePath = (path: string) => path === "/" ? "/" : `/${path.replace(/^\/+|\/+$/g, "")}/`;
    const sourcePath = sourceRoute.canonicalUrl
      ? new URL(sourceRoute.canonicalUrl, base).pathname
      : sourceRoute.path;
    if (!isSingleProductPage && normalizePath(target.pathname) === normalizePath(sourcePath)) return null;
    const matched = routes.find((route) => {
      if (route.classification !== "public-static" || route.surfaceType !== "static-content") return false;
      try {
        if (route.canonicalUrl) {
          const inspected = new URL(route.canonicalUrl, base);
          return inspected.origin === target.origin && normalizePath(inspected.pathname) === normalizePath(target.pathname);
        }
        return normalizePath(route.path) === normalizePath(target.pathname);
      } catch { return false; }
    });
    return matched ? matched.canonicalUrl ?? matched.path : null;
  } catch {
    return null;
  }
}

function flattenJsonLd(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (!isObject(value)) return [];
  const nested = Array.isArray(value["@graph"]) ? value["@graph"].flatMap(flattenJsonLd) : [];
  return [value, ...nested];
}

function isSchemaOrgProduct(value: Record<string, unknown>): boolean {
  const context = value["@context"];
  const contextIsSchema = typeof context === "string" ? /(?:https?:)?\/\/(?:www\.)?schema\.org\/?$/i.test(context)
    : Array.isArray(context) && context.some((item) => typeof item === "string" && /(?:https?:)?\/\/(?:www\.)?schema\.org\/?$/i.test(item));
  const types = Array.isArray(value["@type"]) ? value["@type"] : [value["@type"]];
  return contextIsSchema && types.some((type) => type === "Product");
}

function firstOffer(value: unknown): Record<string, unknown> | null {
  const candidates = Array.isArray(value) ? value : [value];
  return candidates.find(isObject) ?? null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}
