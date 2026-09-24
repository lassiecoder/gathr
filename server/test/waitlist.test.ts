import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { record, testApp, user } from './helpers.js';

const HOST = user('Host');
const [A, B, C, D] = ['Alice', 'Bob', 'Cara', 'Dan'].map(user) as [ReturnType<typeof user>, ReturnType<typeof user>, ReturnType<typeof user>, ReturnType<typeof user>];

// Capacity 2 with the host already going → one open spot.
const seed = () =>
  record({
    id: 'small',
    capacity: 2,
    hostId: HOST['x-user-id'],
    rsvps: { [HOST['x-user-id']]: { status: 'going', name: 'Host', at: '2026-05-01T00:00:00.000Z' } },
  });

let ctx: ReturnType<typeof testApp>;
let clock: number;
beforeEach(() => {
  clock = Date.parse('2026-06-01T12:00:00Z');
  // Advance the clock on every call so join order is deterministic.
  ctx = testApp([seed()], { now: () => (clock += 1000) });
});

const rsvp = (who: Record<string, string>, status: string) =>
  request(ctx.app).put('/api/events/small/rsvp').set(who).send({ status });
const leave = (who: Record<string, string>) => request(ctx.app).delete('/api/events/small/rsvp').set(who);
const view = (who: Record<string, string>) => request(ctx.app).get('/api/events/small').set(who);

describe('waitlist', () => {
  it('queues people first-come first-served once the event is full', async () => {
    expect((await rsvp(A, 'going')).body).toMatchObject({ myRsvp: 'going', spotsLeft: 0 });

    const b = await rsvp(B, 'waitlist');
    const c = await rsvp(C, 'waitlist');
    expect(b.body).toMatchObject({ myRsvp: 'waitlist', waitlistPosition: 1, waitlistCount: 1 });
    expect(c.body).toMatchObject({ myRsvp: 'waitlist', waitlistPosition: 2, waitlistCount: 2 });
    // Waitlisted people don't count toward going.
    expect(c.body.goingCount).toBe(2);
  });

  it('promotes the front of the queue when someone leaves', async () => {
    await rsvp(A, 'going');
    await rsvp(B, 'waitlist');
    await rsvp(C, 'waitlist');

    const left = await leave(A);
    expect(left.body).toMatchObject({ myRsvp: null, goingCount: 2, waitlistCount: 1 });
    expect((await view(B)).body).toMatchObject({ myRsvp: 'going', waitlistPosition: null });
    expect((await view(C)).body).toMatchObject({ myRsvp: 'waitlist', waitlistPosition: 1 });
  });

  it('promotes when a going attendee downgrades to interested', async () => {
    await rsvp(A, 'going');
    await rsvp(B, 'waitlist');
    await rsvp(A, 'interested');
    expect((await view(B)).body.myRsvp).toBe('going');
  });

  it('promotes as many as fit when the host raises capacity', async () => {
    await rsvp(A, 'going');
    for (const who of [B, C, D]) await rsvp(who, 'waitlist');

    const edit = await request(ctx.app)
      .put('/api/events/small')
      .set(HOST)
      .send({
        title: 'Seeded',
        description: 'A seeded event for tests',
        startsAt: '2026-06-05T10:00:00.000Z',
        endsAt: null,
        location: { name: 'Park', address: '' },
        category: 'outdoors',
        capacity: 4,
      });
    expect(edit.body).toMatchObject({ goingCount: 4, waitlistCount: 1 });
    expect((await view(D)).body).toMatchObject({ myRsvp: 'waitlist', waitlistPosition: 1 });
  });

  it('makes you going straight away if you join the waitlist while there is room', async () => {
    expect((await rsvp(A, 'waitlist')).body).toMatchObject({ myRsvp: 'going', waitlistCount: 0 });
  });

  it('keeps your place when you re-send the same status', async () => {
    await rsvp(A, 'going');
    await rsvp(B, 'waitlist');
    await rsvp(C, 'waitlist');
    await rsvp(B, 'waitlist');
    expect((await view(B)).body.waitlistPosition).toBe(1);
  });

  it('still refuses "going" on a full event, even from the waitlist', async () => {
    await rsvp(A, 'going');
    await rsvp(B, 'waitlist');
    const res = await rsvp(B, 'going');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EVENT_FULL');
  });

  it('lets you leave the waitlist without affecting anyone going', async () => {
    await rsvp(A, 'going');
    await rsvp(B, 'waitlist');
    expect((await leave(B)).body).toMatchObject({ myRsvp: null, goingCount: 2, waitlistCount: 0 });
  });
});
