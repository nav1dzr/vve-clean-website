/** Rules shared by the request form and its API. Names may include initials. */
export function isValidBookingName(value) {
  return typeof value === 'string' && value.trim().length >= 2;
}

export function isValidBookingEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidBookingDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** A London appointment uses London's calendar day, regardless of device zone. */
export function todayLondonIsoDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

const arrivalWindows = [
  { label: 'Morning (8am–12pm)', endHour: 12 },
  { label: 'Afternoon (12pm–5pm)', endHour: 17 },
  { label: 'Flexible', endHour: 24 },
];
const londonHour = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', hour: '2-digit', hourCycle: 'h23',
});

export function availableBookingWindows(date, now = new Date()) {
  const today = todayLondonIsoDate(now);
  if (date && date < today) return [];
  const hour = date === today ? Number(londonHour.format(now)) : -1;
  return arrivalWindows.filter(window => hour < window.endHour).map(window => window.label);
}

export const ARRIVAL_WINDOW_ERROR = 'Please choose an available arrival window for your preferred date.';
export const ENQUIRY_DATE_ERROR = 'Choose today or a future date, or leave the preferred date blank.';

export function isValidOptionalVisitDate(value, now = new Date()) {
  return value === '' || (isValidBookingDate(value) && value >= todayLondonIsoDate(now));
}
