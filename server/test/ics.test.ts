import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { foldLine, icsFilename } from '../src/ics.js';
import { record, testApp } from './helpers.js';

describe('calendar export', () => {
  const event = record({
    id: 'cal-1',
    title: 'Jazz, Wine; & Friends',
    description: 'Line one\nLine two with a \\ backslash',
    startsAt: '2026-06-05T13:30:00.000Z',
    endsAt: null,
    location: { name: 'Skyline Terrace', address: '88 Harbor Rd' },
  });

  it('serves a downloadable, spec-compliant .ics file', async () => {
    const { app } = testApp([event]);
    const res = await request(app).get('/api/events/cal-1/ics');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^text\/calendar/);
    expect(res.headers['content-disposition']).toBe('attachment; filename="jazz-wine-friends.ics"');

    const body: string = res.text;
    expect(body.endsWith('\r\n')).toBe(true);
    expect(body.split('\r\n').every((l) => Buffer.byteLength(l) <= 75)).toBe(true);

    const unfolded = body.replace(/\r\n /g, '');
    expect(unfolded).toContain('UID:cal-1@gathr.app');
    expect(unfolded).toContain('DTSTART:20260605T133000Z');
    // No end time → defaults to two hours.
    expect(unfolded).toContain('DTEND:20260605T153000Z');
    expect(unfolded).toContain('SUMMARY:Jazz\\, Wine\\; & Friends');
    expect(unfolded).toContain('DESCRIPTION:Line one\\nLine two with a \\\\ backslash');
    expect(unfolded).toContain('LOCATION:Skyline Terrace\\, 88 Harbor Rd');
    expect(unfolded).toContain('URL:https://gathr.test/events/cal-1');
  });

  it('404s for unknown events', async () => {
    const { app } = testApp([]);
    expect((await request(app).get('/api/events/nope/ics')).status).toBe(404);
  });

  it('folds long lines without splitting multi-byte characters', () => {
    const folded = foldLine(`SUMMARY:${'🎷'.repeat(40)}`);
    const lines = folded.split('\r\n');
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
    expect(folded.replace(/\r\n /g, '')).toBe(`SUMMARY:${'🎷'.repeat(40)}`);
  });

  it('builds safe filenames', () => {
    expect(icsFilename('Café Night!! 🎉')).toBe('cafe-night.ics');
    expect(icsFilename('🎉🎉')).toBe('event.ics');
  });
});
