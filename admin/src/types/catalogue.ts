// Products & Services catalogue — mirrors admin/api/_lib/catalogueFields.js.
// Prices are always integer pence (defaultPricePence); convert to pounds
// only for display via formatMoney(pence / 100).

export type CatalogueItemType = 'service' | 'product';
export type CatalogueStatus = 'active' | 'archived';

export interface CatalogueItem {
  id: string;
  name: string;
  description: string | null;
  defaultPricePence: number;
  itemType: CatalogueItemType;
  category: string | null;
  status: CatalogueStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogueListResponse {
  results: CatalogueItem[];
}

export interface CatalogueSeedResponse {
  inserted: number;
  skipped: number;
}
