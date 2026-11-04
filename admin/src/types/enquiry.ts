export interface Enquiry {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  service: string;
  message: string;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
  delivery: Record<string, { status: string; error?: string }>;
}

export interface EnquiryBookingContext {
  enquiry: Enquiry;
  booking: { id: string; reference: string | null } | null;
}

export function enquiryDetailsPath(id: string): string {
  return '/api/search?resource=enquiries&enquiryId=' + encodeURIComponent(id);
}
