export function isValidBookingName(value: unknown): boolean;
export function isValidBookingEmail(value: unknown): boolean;
export function isValidBookingDate(value: unknown): boolean;
export function todayLondonIsoDate(now?: Date): string;
export function availableBookingWindows(date: string, now?: Date): string[];
export const ARRIVAL_WINDOW_ERROR: string;
export const ENQUIRY_DATE_ERROR: string;
export function isValidOptionalVisitDate(value: unknown, now?: Date): boolean;
