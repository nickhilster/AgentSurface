/**
 * Canonical Site Model (CSM) types.
 *
 * Per docs/SPEC.md and docs/ARCHITECTURE.md: this is the one machine-readable
 * source of truth. Markdown and other generated outputs are projections of
 * this model, never the other way around.
 */

export type Confidence = number; // 0.0 - 1.0

export type ContentClassification =
  | "public-static"
  | "public-dynamic"
  | "transactional"
  | "authenticated"
  | "private-internal"
  | "unsafe-to-expose"
  | "unknown";

export type InspectionMethod =
  | "framework-route-parser"
  | "config-redirect"
  | "auth-check-detected"
  | "metadata-robots-noindex"
  | "heuristic-inference"
  | "existing-agentsurface-model"
  | "owner-config"
  | "schema-org-jsonld"
  | "openapi-contract";

export interface ProvenanceRecord {
  subject: string; // e.g. "route:/about"
  claim: string; // e.g. "public-static"
  source: string; // file path or config entry that justified the claim
  method: InspectionMethod;
  confidence: Confidence;
}

export interface RouteRecord {
  path: string; // canonical route path, e.g. "/about" or "/products/[slug]"
  classification: ContentClassification;
  contentType: "page" | "redirect" | "unknown";
  sourceFiles: string[];
  agentReadableAlternate: string | null; // populated by generate, not inspect
  canonicalUrl: string | null; // absolute URL if the hostname mapping is known
  dynamicSegments: string[]; // e.g. ["slug"]
  redirectsTo: string | null; // populated when contentType === "redirect"
  /**
   * The HTML tag (e.g. "main") that source inspection found wrapping this page's real
   * content, if any deterministic boundary exists. Null means no reliable boundary was
   * found in source — generation must not guess at one, per OPERATE.md's "unknown is a
   * valid state" and "never invent" principles.
   */
  contentBoundaryTag: string | null;
  provenance: ProvenanceRecord[];
  confidence: Confidence;
  /** Verified page surface for static-site discovery. Omitted by older adapters. */
  surfaceType?: "static-content" | "interactive" | "human-gated";
  /** Explicit access/interaction requirements found in source, never inferred from a route name. */
  accessRequirements?: string[];
}

export interface CapabilityRecord {
  name: string;
  description: string;
  kind: "readable" | "operable";
  backingImplementation: string | null;
  authRequired: boolean;
  sideEffects: boolean;
  constraints: string[];
  provenance: ProvenanceRecord[];
  confidence: Confidence;
}

export interface BaseEntityRecord {
  id: string;
  kind: string;
  label: string;
  sourceFiles: string[];
  provenance: ProvenanceRecord[];
}

export interface ContentEntityRecord extends BaseEntityRecord {
  kind: "post" | "service" | "content";
}

export type CatalogScalarType = "string" | "number" | "integer" | "boolean" | "date";
export type CatalogOperator = "eq" | "contains" | "gt" | "gte" | "lt" | "lte" | "in";

export interface ProductAttribute {
  name: string;
  value: string | number | boolean;
  type: CatalogScalarType;
  unit?: string;
  provenance: ProvenanceRecord[];
}

export interface FreshnessRecord {
  class: "live" | "periodic" | "static" | "unknown";
  observedAt?: string;
  maxAgeSeconds?: number;
}

export interface ProductPrice {
  amount: number;
  currency: string;
  kind: "offer" | "msrp" | "starting" | "unknown";
  conditions?: string[];
  freshness: FreshnessRecord;
  provenance: ProvenanceRecord[];
}

export interface ProductAvailability {
  value: string;
  freshness: FreshnessRecord;
  provenance: ProvenanceRecord[];
}

export interface ProductRecord extends BaseEntityRecord {
  kind: "product";
  description?: string;
  attributes: ProductAttribute[];
  price?: ProductPrice;
  availability?: ProductAvailability;
  market: string[];
  locale: string | null;
  canonicalPageUrl: string | null;
}

export type EntityRecord = ContentEntityRecord | ProductRecord;

export interface CatalogField {
  name: string;
  type: CatalogScalarType;
  filterable: boolean;
  sortable: boolean;
  operators: CatalogOperator[];
  unit?: string;
  enum?: string[];
}

export interface CatalogSourceRef {
  kind: "openapi" | "owner-config" | "static-jsonld";
  file: string;
  operationId?: string;
  method?: "GET";
  path?: string;
}

export interface CatalogRecord {
  id: string;
  entityKind: "product" | "service" | "content";
  scope: "public" | "unknown";
  source: CatalogSourceRef;
  searchOperation: string | null;
  detailOperation: string | null;
  canonicalRoute: string;
  fields: CatalogField[];
  searchMode: "none" | "static-index" | "read-api";
  supportsQuery: boolean;
  supportsSorting: boolean;
  supportsPagination: boolean;
  maxResults: number;
  freshness: FreshnessRecord;
  provenance: ProvenanceRecord[];
}

export interface ConstraintRecord {
  subject: string; // route or capability this constraint applies to
  rule: string; // human-readable description of the constraint
  source: string;
  provenance: ProvenanceRecord[];
}

export interface SiteInfo {
  name: string;
  framework: string;
  frameworkConfidence: Confidence;
  rootDir: string;
  hostnames: string[]; // known hostnames this repo serves, if determinable
}

export interface CanonicalSiteModel {
  version: "0.2";
  generatedAt: string; // ISO timestamp
  site: SiteInfo;
  routes: RouteRecord[];
  entities: EntityRecord[];
  catalogs: CatalogRecord[];
  capabilities: CapabilityRecord[];
  constraints: ConstraintRecord[];
  provenance: ProvenanceRecord[]; // top-level/site-wide provenance not tied to one route
  unknowns: string[]; // explicit list of things inspect could not determine
}

export interface DetectionResult {
  framework: string;
  confidence: Confidence;
  evidence: string[]; // files/config that led to this detection
}

export interface RepoContext {
  rootDir: string;
  /** Absolute paths to exclude from inspection entirely (e.g. other apps within a monorepo-style repo). */
  excludeDirs?: string[];
}

/**
 * Framework adapters expose only verifiable facts to the core engine.
 * Per docs/ARCHITECTURE.md's adapter boundary.
 */
export interface FrameworkAdapter {
  readonly name: string;
  detect(repo: RepoContext): Promise<DetectionResult>;
  inspectRoutes(repo: RepoContext): Promise<RouteRecord[]>;
  inspectCapabilities?(repo: RepoContext): Promise<CapabilityRecord[]>;
}
