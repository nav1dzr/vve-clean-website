export function bookingContent(agreement?: { items?: string; scope?: string; exclusions?: string; accessNotes?: string }): {
  cleaning: string[]; access: string[]; details: string; exclusions: string;
};
export function friendlyBookingDate(value?: string): string;
