export type PackStage = 'during' | 'earlier' | 'later' | 'record';
export interface PackAsset {
  id: string; kind: 'pdf' | 'photo' | 'video'; caption: string; stage: PackStage;
  mime: string; size: number; ready: boolean; object_key: string;
}
export interface ClientPack {
  id: string; status: 'draft' | 'published' | 'revoked'; revision: number;
  title: string; customer_name: string; service_date: string; property_address: string;
  summary: string; invoice_reference: string; customer_id: string | null;
  booking_id: string | null; invoice_id: string | null; assets: PackAsset[]; expires_at: string | null;
}
export interface PublicPack {
  title: string; customerName: string; serviceDate: string; propertyAddress: string;
  summary: string; invoiceReference: string; expiresAt: string;
  assets: (Omit<PackAsset, 'ready' | 'object_key'> & { url: string })[];
}
