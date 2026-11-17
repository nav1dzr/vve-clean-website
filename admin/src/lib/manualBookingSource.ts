export const MANUAL_BOOKING_SOURCES = [
  { value: 'phone', label: 'Phone' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'checkatrade', label: 'Checkatrade' },
  { value: 'other', label: 'Other' },
] as const;

export type ManualBookingSource = typeof MANUAL_BOOKING_SOURCES[number]['value'];

export function manualBookingSourceLabel(value: unknown): string {
  return MANUAL_BOOKING_SOURCES.find((option) => option.value === value)?.label || 'Manual booking';
}
