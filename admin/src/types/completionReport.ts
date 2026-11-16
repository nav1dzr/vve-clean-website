export interface CompletionPhoto {
  id: string;
  objectKey: string;
  caption: string;
  stage: 'before' | 'after' | 'area';
  pairId: string;
}
export interface CompletionPayload {
  template: string;
  customerName: string;
  customerEmail: string;
  propertyAddress: string;
  serviceDate: string;
  jobReference: string;
  summary: string;
  tasks: { id: string; text: string; completed: boolean }[];
  observations: string;
  exclusions: string;
  aftercare: string;
  internalNotes: string;
  followUp: string;
  photos: CompletionPhoto[];
}
export interface CompletionReport {
  id: string;
  booking_id: string | null;
  customer_id: string | null;
  status: 'draft' | 'final';
  revision: number;
  payload: CompletionPayload;
  created_at?: string;
  updated_at?: string;
  finalised_at?: string;
  acknowledged_at?: string | null;
}
export interface CompletionEvent { id: string; event_type: string; created_at: string; actor_id?: string; }
export interface CompletionSend { id: string; recipient: string; status: string; created_at: string; }
