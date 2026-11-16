// Helpers for choosing a send time. The browser only ever handles UK calendar
// dates and clock times as text; the server turns them into an exact instant,
// so the phone's own time zone can never shift a scheduled email.

const partsFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
});

export function londonNow(now: Date = new Date()): { date: string; minutes: number } {
  const parts = Object.fromEntries(partsFormat.formatToParts(now).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

export function formatUkDateTime(date: string, time: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return `${date} ${time}`;
  return `${d.toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
}

// A stored YYYY-MM-DD date shown the British way, e.g. "Sat 21 Nov 2026".
export function formatUkDate(date: string | null | undefined): string {
  if (!date) return 'Not set';
  const d = new Date(date + 'T12:00:00Z');
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatUkInstant(iso: string | null | undefined): string {
  if (!iso) return 'Not recorded';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Not recorded';
  return d.toLocaleString('en-GB', {
    timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export interface SendTimeSuggestion { label: string; date: string; time: string }

// The next sensible morning first: today if it is still early, otherwise
// tomorrow. Always editable by the owner.
export function suggestSendTimes(now: Date = new Date()): SendTimeSuggestion[] {
  const { date: today, minutes } = londonNow(now);
  const early = minutes < 7 * 60 + 30;
  const day = early ? today : addDays(today, 1);
  const dayLabel = early ? 'Today' : 'Tomorrow';
  const suggestions: SendTimeSuggestion[] = [
    { label: `${dayLabel} 08:00`, date: day, time: '08:00' },
    { label: `${dayLabel} 09:00`, date: day, time: '09:00' },
  ];
  // Offer Monday when the next morning falls on a weekend.
  if ([6, 0].includes(weekday(day))) {
    const monday = addDays(day, weekday(day) === 6 ? 2 : 1);
    suggestions.push({ label: 'Monday 08:00', date: monday, time: '08:00' });
  }
  return suggestions;
}

// Quarter-hour choices between 07:00 and 20:45, matching what the server accepts.
export const SEND_TIME_OPTIONS: string[] = Array.from({ length: (21 - 7) * 4 }, (_, i) => {
  const total = 7 * 60 + i * 15;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
});
