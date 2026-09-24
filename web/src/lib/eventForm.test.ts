import { describe, expect, it } from 'vitest';
import { applyRsvp } from '../hooks/events';
import { emptyValues, mapServerErrors, resolveTimes, toInput, validate, type EventFormValues } from './eventForm';
import type { EventItem } from './types';

const NOW = new Date(2026, 5, 1, 12, 0); // local time, 1 Jun 2026 12:00

const valid: EventFormValues = {
  ...emptyValues,
  title: 'Board games',
  description: 'Bring snacks and a friend.',
  category: 'social',
  date: '2026-06-10',
  startTime: '18:00',
  endTime: '21:30',
  locationName: 'Meeple Café',
  capacity: '20',
};

describe('validate', () => {
  it('accepts a complete form', () => {
    expect(validate(valid, { now: NOW })).toEqual({});
  });

  it('flags every missing required field', () => {
    expect(Object.keys(validate(emptyValues, { now: NOW })).sort()).toEqual(
      ['category', 'date', 'description', 'locationName', 'startTime', 'title'].sort(),
    );
  });

  it('rejects past start times for new events', () => {
    expect(validate({ ...valid, date: '2026-05-31' }, { now: NOW }).startTime).toMatch(/future/);
  });

  it('allows an unchanged past start when editing', () => {
    const past = { ...valid, date: '2026-05-31' };
    const originalStartsAt = new Date(2026, 4, 31, 18, 0).toISOString();
    expect(validate(past, { now: NOW, originalStartsAt })).toEqual({});
  });

  it('rejects fractional or zero capacity', () => {
    expect(validate({ ...valid, capacity: '2.5' }, { now: NOW }).capacity).toBeDefined();
    expect(validate({ ...valid, capacity: '0' }, { now: NOW }).capacity).toBeDefined();
    expect(validate({ ...valid, capacity: '' }, { now: NOW }).capacity).toBeUndefined();
  });
});

describe('resolveTimes / toInput', () => {
  it('rolls an end time before the start over to the next day', () => {
    const { start, end, endsNextDay } = resolveTimes({ date: '2026-06-10', startTime: '21:00', endTime: '01:00' });
    expect(endsNextDay).toBe(true);
    expect(end!.getTime() - start!.getTime()).toBe(4 * 3_600_000);
  });

  it('builds the API payload with trimmed strings and nullable fields', () => {
    const input = toInput({ ...valid, title: '  Board games  ', endTime: '', capacity: '' });
    expect(input).toMatchObject({ title: 'Board games', endsAt: null, capacity: null, location: { name: 'Meeple Café', address: '' } });
    expect(new Date(input.startsAt).getHours()).toBe(18);
  });
});

it('maps server field paths onto form fields', () => {
  expect(mapServerErrors({ startsAt: 'bad', 'location.name': 'missing', unknown: 'x' })).toEqual({
    startTime: 'bad',
    locationName: 'missing',
  });
});

describe('applyRsvp (optimistic update)', () => {
  const base = {
    goingCount: 5,
    interestedCount: 2,
    waitlistCount: 0,
    capacity: 6,
    spotsLeft: 1,
    myRsvp: null,
    waitlistPosition: null,
  } as EventItem;

  it('moves the user between buckets and recomputes spots', () => {
    const going = applyRsvp(base, 'going');
    expect(going).toMatchObject({ goingCount: 6, spotsLeft: 0, myRsvp: 'going' });
    const interested = applyRsvp(going, 'interested');
    expect(interested).toMatchObject({ goingCount: 5, interestedCount: 3, spotsLeft: 1 });
    expect(applyRsvp(interested, null)).toMatchObject({ goingCount: 5, interestedCount: 2, myRsvp: null });
  });

  it('puts a new waitlister at the back of the line', () => {
    const full = { ...base, goingCount: 6, spotsLeft: 0, waitlistCount: 3 };
    expect(applyRsvp(full, 'waitlist')).toMatchObject({ waitlistCount: 4, waitlistPosition: 4, goingCount: 6 });
    const queued = { ...full, myRsvp: 'waitlist' as const, waitlistCount: 4, waitlistPosition: 2 };
    expect(applyRsvp(queued, null)).toMatchObject({ waitlistCount: 3, waitlistPosition: null });
  });
});
