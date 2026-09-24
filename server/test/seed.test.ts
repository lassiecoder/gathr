import { describe, expect, it } from 'vitest';
import { atZoned, seedEvents } from '../src/seed.js';

describe('seed times', () => {
  it('places wall-clock times in the target zone, whatever zone the server runs in', () => {
    const now = Date.parse('2026-09-24T22:00:00Z'); // still Sep 24 in New York (EDT, UTC-4)
    expect(atZoned(1, 6, 30, 'America/New_York', now).toISOString()).toBe('2026-09-25T10:30:00.000Z');
    expect(atZoned(0, 19, 30, 'Asia/Kolkata', now).toISOString()).toBe('2026-09-25T14:00:00.000Z'); // already Sep 25 in IST
  });

  it('handles daylight-saving changes', () => {
    const now = Date.parse('2026-10-30T12:00:00Z'); // EDT; US clocks fall back on Nov 1
    expect(atZoned(5, 9, 0, 'America/New_York', now).toISOString()).toBe('2026-11-04T14:00:00.000Z'); // EST, UTC-5
  });

  it('seeds the sunrise run at 6:30 local time', () => {
    const run = seedEvents('America/New_York').find((e) => e.title.startsWith('Sunrise'))!;
    const local = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }).format(
      new Date(run.startsAt),
    );
    expect(local).toBe('6:30 AM');
  });
});
