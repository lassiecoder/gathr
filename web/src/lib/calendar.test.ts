import { describe, expect, it } from 'vitest';
import { googleCalendarUrl, outlookCalendarUrl } from './calendar';

const event = {
  title: 'Rooftop Jazz & Friends',
  description: 'Live trio',
  startsAt: '2026-09-27T13:30:00.000Z',
  endsAt: null,
  location: { name: 'Skyline Terrace', address: '88 Harbor Rd' },
};

describe('calendar links', () => {
  it('builds a Google Calendar template URL with a default 2h duration', () => {
    const url = new URL(googleCalendarUrl(event, 'https://gathr.test/events/1'));
    expect(url.hostname).toBe('calendar.google.com');
    expect(url.searchParams.get('text')).toBe('Rooftop Jazz & Friends');
    expect(url.searchParams.get('dates')).toBe('20260927T133000Z/20260927T153000Z');
    expect(url.searchParams.get('location')).toBe('Skyline Terrace, 88 Harbor Rd');
    expect(url.searchParams.get('details')).toContain('https://gathr.test/events/1');
  });

  it('uses the real end time when there is one', () => {
    const url = new URL(outlookCalendarUrl({ ...event, endsAt: '2026-09-27T17:00:00.000Z' }, 'x'));
    expect(url.searchParams.get('startdt')).toBe('2026-09-27T13:30:00.000Z');
    expect(url.searchParams.get('enddt')).toBe('2026-09-27T17:00:00.000Z');
  });
});
