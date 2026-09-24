import type { EventItem } from './types';

// Keep in sync with DEFAULT_DURATION_MS on the server (used for the .ics export).
export const DEFAULT_DURATION_MS = 2 * 3_600_000;

type CalendarEvent = Pick<EventItem, 'title' | 'description' | 'startsAt' | 'endsAt' | 'location'>;

const endMs = (e: CalendarEvent) => (e.endsAt ? Date.parse(e.endsAt) : Date.parse(e.startsAt) + DEFAULT_DURATION_MS);

/** 2026-09-27T13:00:00.000Z → 20260927T130000Z (the format Google Calendar expects). */
const compactUtc = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const locationText = (e: CalendarEvent) => [e.location.name, e.location.address].filter(Boolean).join(', ');

const details = (e: CalendarEvent, pageUrl: string) => `${e.description}\n\n${pageUrl}`;

export function googleCalendarUrl(e: CalendarEvent, pageUrl: string) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${compactUtc(Date.parse(e.startsAt))}/${compactUtc(endMs(e))}`,
    details: details(e, pageUrl),
    location: locationText(e),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function outlookCalendarUrl(e: CalendarEvent, pageUrl: string) {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: e.title,
    startdt: new Date(e.startsAt).toISOString(),
    enddt: new Date(endMs(e)).toISOString(),
    body: details(e, pageUrl),
    location: locationText(e),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params}`;
}
