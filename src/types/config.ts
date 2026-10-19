import type { CatalogOperator, CatalogScalarType, FreshnessRecord } from "./model.js";

export interface AgentSurfaceConfig {
  version: "0.1";
  site: {
    name: string;
    /** Known hostnames this repo serves. Used to build canonical URLs and scope discovery. */
    hostnames: string[];
  };
  routes: {
    /** Route path prefixes to exclude from inspection/generation entirely, beyond adapter-detected private routes. */
    exclude: string[];
    /** Explicit owner decisions for ambiguous routes; inspection records owner provenance. */
    overrides?: RouteOverride[];
  };
  /** Explicit owner declarations for public read-only catalog sources. */
  catalogs: CatalogConfig[];
  output: {
    /**
     * Where AgentSurface writes artifacts into the target repo's own static/public
     * output directory (e.g. llms.txt), relative to repo root. Honoured by generate/
     * validate; does not affect .agentsurface/, which AgentSurface owns outright.
     */
    dir: string;
    /** Optional static-site directory for publicly served Markdown mirrors. */
    markdownDir?: string;
  };
  ownership: {
    /**
     * Conservative by default: never overwrite a file AgentSurface did not itself generate,
     * unless the file carries AgentSurface's own ownership header.
     */
    overwriteHumanOwned: boolean;
  };
}

export interface CatalogFieldConfig {
  name: string;
  sourceField: string;
  type: CatalogScalarType;
  operators: CatalogOperator[];
  filterable?: boolean;
  sortable?: boolean;
  unit?: string;
}

export interface CatalogConfig {
  id: string;
  entityKind: "product" | "service" | "content";
  scope: "public";
  source: { kind: "openapi"; file: string };
  searchOperation: string;
  detailOperation: string;
  fieldAllowlist: CatalogFieldConfig[];
  canonicalRoute: string;
  maxResults: number;
  freshness: FreshnessRecord;
  marketPolicy?: { allowedMarkets: string[]; locationRequired: boolean };
}

export interface RouteOverride {
  path: string;
  classification?: "public-static" | "public-dynamic" | "transactional" | "authenticated" | "private-internal" | "unsafe-to-expose" | "unknown";
  contentBoundaryTag?: string;
}

export const DEFAULT_CONFIG: AgentSurfaceConfig = {
  version: "0.1",
  site: {
    name: "",
    hostnames: [],
  },
  routes: {
    exclude: [],
    overrides: [],
  },
  catalogs: [],
  output: {
    dir: "public",
    markdownDir: undefined,
  },
  ownership: {
    overwriteHumanOwned: false,
  },
};
