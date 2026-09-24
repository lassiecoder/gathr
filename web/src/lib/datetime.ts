// All formatting uses the viewer's locale and timezone; the API only ever speaks ISO-8601 UTC.

const DAY_MS = 86_400_000;

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(undefined, opts);
const weekdayDate = fmt({ weekday: 'short', month: 'short', day: 'numeric' });
const longDate = fmt({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const time = fmt({ hour: 'numeric', minute: '2-digit' });
const month = fmt({ month: 'short' });
const tzName = fmt({ timeZoneName: 'short' });

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const sameDay = (a: Date, b: Date) => startOfDay(a) === startOfDay(b);

export function dateBadge(iso: string) {
  const d = new Date(iso);
  return { month: month.format(d).toUpperCase(), day: String(d.getDate()) };
}

/** "Today", "Tomorrow", "In 5 days", "Yesterday" — or null when a plain date reads better. */
export function relativeDay(iso: string, now = new Date()): string | null {
  const diff = Math.round((startOfDay(new Date(iso)) - startOfDay(now)) / DAY_MS);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  return null;
}

/** Compact line for cards: "Sat, Sep 27 · 6:30 PM". */
export function formatShort(iso: string) {
  const d = new Date(iso);
  return `${weekdayDate.format(d)} · ${time.format(d)}`;
}

/** Detail page: { date: "Saturday, September 27, 2026", time: "6:30 PM – 9:00 PM IST" }. */
export function formatLong(startIso: string, endIso: string | null) {
  const start = new Date(startIso);
  const zone = tzName.formatToParts(start).find((p) => p.type === 'timeZoneName')?.value ?? '';
  if (!endIso) return { date: longDate.format(start), time: `${time.format(start)} ${zone}`.trim() };

  const end = new Date(endIso);
  const endPart = sameDay(start, end) ? time.format(end) : `${weekdayDate.format(end)}, ${time.format(end)}`;
  return { date: longDate.format(start), time: `${time.format(start)} – ${endPart} ${zone}`.trim() };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO → values for <input type="date"> / <input type="time"> in local time. */
export function toInputs(iso: string) {
  const d = new Date(iso);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** Local date + time input values → Date, or null if either is missing/invalid. */
export function fromInputs(date: string, t: string): Date | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const tm = /^(\d{2}):(\d{2})$/.exec(t);
  if (!dm || !tm) return null;
  const d = new Date(+dm[1]!, +dm[2]! - 1, +dm[3]!, +tm[1]!, +tm[2]!);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const todayInput = () => toInputs(new Date().toISOString()).date;
