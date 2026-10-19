import type { CatalogOperator, CatalogScalarType, FreshnessRecord, ProductAvailability, ProductPrice, ProvenanceRecord } from "../types/model.js";

export type CatalogScalar = string | number | boolean | null;

export interface CatalogFilter {
  field: string;
  operator: CatalogOperator;
  value: CatalogScalar | CatalogScalar[];
}

export interface CatalogSort {
  field: string;
  direction: "asc" | "desc";
}

export interface CatalogSearchInput {
  query?: string;
  filters?: CatalogFilter[];
  sort?: CatalogSort;
  limit: number;
  cursor?: string;
  market?: string;
}

export interface CatalogItemSummary {
  id: string;
  label: string;
  canonicalPageUrl: string;
  fields: Record<string, CatalogScalar>;
  price?: ProductPrice;
  availability?: ProductAvailability;
  provenance: ProvenanceRecord[];
  freshness: FreshnessRecord;
}

export interface CatalogItemDetail extends CatalogItemSummary {
  description?: string;
  attributes?: Array<{ name: string; value: CatalogScalar; type: CatalogScalarType; provenance: ProvenanceRecord[] }>;
}

export interface CatalogSearchResponse {
  items: CatalogItemSummary[];
  nextCursor: string | null;
  freshness: FreshnessRecord;
}

export interface CatalogBackendResponse {
  items: CatalogItemDetail[];
  nextCursor: string | null;
}

export interface CatalogBackend {
  search(input: CatalogSearchInput): Promise<CatalogBackendResponse>;
  getById(id: string): Promise<CatalogItemDetail | null>;
}

export interface CatalogProvider {
  search(input: CatalogSearchInput): Promise<CatalogSearchResponse>;
  getById(id: string): Promise<CatalogItemDetail | null>;
}
