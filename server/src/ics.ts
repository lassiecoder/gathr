import { DEFAULT_DURATION_MS } from './serialize.js';
import type { EventRecord } from './types.js';

/** RFC 5545 TEXT escaping. */
const escapeText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[,;]/g, (m) => `\\${m}`);

/** 2026-09-27T13:00:00.000Z → 20260927T130000Z */
const utcStamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** Folds a content line to ≤75 octets per RFC 5545 §3.1, never splitting a multi-byte character. */
export function foldLine(line: string): string {
  const out: string[] = [];
  let chunk = '';
  let bytes = 0;
  for (const ch of line) {
    const size = Buffer.byteLength(ch);
    // Continuation lines start with a space, which counts toward their 75 octets.
    const limit = out.length ? 74 : 75;
    if (bytes + size > limit) {
      out.push(chunk);
      chunk = '';
      bytes = 0;
    }
    chunk += ch;
    bytes += size;
  }
  out.push(chunk);
  return out.join('\r\n ');
}

export function toIcs(e: EventRecord, opts: { url: string; now?: number }): string {
  const start = Date.parse(e.startsAt);
  const end = e.endsAt ? Date.parse(e.endsAt) : start + DEFAULT_DURATION_MS;
  const location = [e.location.name, e.location.address].filter(Boolean).join(', ');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gathr//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.id}@gathr.app`,
    `DTSTAMP:${utcStamp(opts.now ?? Date.now())}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    `LAST-MODIFIED:${utcStamp(Date.parse(e.updatedAt))}`,
    `SUMMARY:${escapeText(e.title)}`,
    `DESCRIPTION:${escapeText(`${e.description}\n\nHosted by ${e.hostName} · ${opts.url}`)}`,
    `LOCATION:${escapeText(location)}`,
    `URL:${opts.url}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

/** ASCII-only filename for Content-Disposition: "Rooftop Jazz Night!" → "rooftop-jazz-night.ics". */
export const icsFilename = (title: string) =>
  `${title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'event'}.ics`;
