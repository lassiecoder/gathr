import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { EventStore } from '../src/store.js';
import type { EventRecord } from '../src/types.js';

const NOW = Date.parse('2026-06-01T12:00:00Z');
const HOST = { 'x-user-id': 'host-user-1', 'x-user-name': 'Hana' };
const ALICE = { 'x-user-id': 'alice-user-1', 'x-user-name': 'Alice' };
const BOB = { 'x-user-id': 'bob-user-01', 'x-user-name': 'Bob' };

const validInput = {
  title: 'Board game night',
  description: 'Bring your favourite games and snacks.',
  startsAt: '2026-06-10T18:00:00.000Z',
  endsAt: '2026-06-10T21:00:00.000Z',
  location: { name: 'Meeple Café', address: '12 Park Lane' },
  category: 'social',
  capacity: 2,
};

function record(over: Partial<EventRecord>): EventRecord {
  return {
    id: 'e1',
    title: 'Seeded',
    description: 'A seeded event for tests',
    startsAt: '2026-06-05T10:00:00.000Z',
    endsAt: null,
    location: { name: 'Park', address: '' },
    category: 'outdoors',
    capacity: null,
    hostId: 'someone-else',
    hostName: 'Someone',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    rsvps: {},
    ...over,
  };
}

let app: ReturnType<typeof createApp>;
beforeEach(() => {
  app = createApp(
    EventStore.inMemory([
      record({ id: 'future-tech', title: 'Future tech talk', category: 'tech', startsAt: '2026-06-03T10:00:00.000Z' }),
      record({ id: 'later-hike', title: 'Later hike', startsAt: '2026-06-20T07:00:00.000Z' }),
      record({ id: 'old-one', title: 'Old picnic', startsAt: '2026-05-01T10:00:00.000Z' }),
    ]),
    { now: () => NOW },
  );
});

async function createEvent(body = validInput) {
  const res = await request(app).post('/api/events').set(HOST).send(body);
  expect(res.status).toBe(201);
  return res.body;
}

describe('listing', () => {
  it('returns upcoming events soonest-first by default and hides past ones', async () => {
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(200);
    expect(res.body.items.map((e: { id: string }) => e.id)).toEqual(['future-tech', 'later-hike']);
    expect(res.body.total).toBe(2);
  });

  it('filters by past, category and free-text search', async () => {
    expect((await request(app).get('/api/events?when=past')).body.items[0].id).toBe('old-one');
    expect((await request(app).get('/api/events?category=tech')).body.total).toBe(1);
    expect((await request(app).get('/api/events?q=HIKE')).body.items[0].id).toBe('later-hike');
  });

  it('paginates with nextOffset', async () => {
    const page1 = await request(app).get('/api/events?limit=1');
    expect(page1.body.nextOffset).toBe(1);
    const page2 = await request(app).get('/api/events?limit=1&offset=1');
    expect(page2.body.nextOffset).toBeNull();
  });

  it('filters to events the user is going to or hosting', async () => {
    const created = await createEvent();
    await request(app).put('/api/events/later-hike/rsvp').set(HOST).send({ status: 'interested' });
    const hosting = await request(app).get('/api/events?mine=hosting').set(HOST);
    expect(hosting.body.items.map((e: { id: string }) => e.id)).toEqual([created.id]);
    const going = await request(app).get('/api/events?mine=going').set(HOST);
    expect(going.body.total).toBe(2);
  });

  it('rejects invalid query params', async () => {
    expect((await request(app).get('/api/events?category=nope')).status).toBe(422);
  });
});

describe('create / edit / delete', () => {
  it('creates an event with the host already going', async () => {
    const e = await createEvent();
    expect(e).toMatchObject({ title: 'Board game night', hostName: 'Hana', isHost: true, myRsvp: 'going', goingCount: 1, spotsLeft: 1 });
    expect(e).not.toHaveProperty('rsvps');
  });

  it('requires an identity to create', async () => {
    expect((await request(app).post('/api/events').send(validInput)).status).toBe(401);
  });

  it('returns field-level validation errors', async () => {
    const res = await request(app)
      .post('/api/events')
      .set(HOST)
      .send({ ...validInput, title: 'x', location: { name: '' }, endsAt: '2026-06-10T17:00:00.000Z' });
    expect(res.status).toBe(422);
    expect(Object.keys(res.body.error.fieldErrors).sort()).toEqual(['endsAt', 'location.name', 'title']);
  });

  it('rejects end before start once fields are otherwise valid', async () => {
    const res = await request(app).post('/api/events').set(HOST).send({ ...validInput, endsAt: '2026-06-10T17:00:00.000Z' });
    expect(res.body.error.fieldErrors).toHaveProperty('endsAt');
  });

  it('rejects start times in the past', async () => {
    const res = await request(app).post('/api/events').set(HOST).send({ ...validInput, startsAt: '2026-05-01T10:00:00.000Z', endsAt: null });
    expect(res.status).toBe(422);
    expect(res.body.error.fieldErrors.startsAt).toMatch(/future/);
  });

  it('only lets the host edit or delete', async () => {
    const e = await createEvent();
    expect((await request(app).put(`/api/events/${e.id}`).set(ALICE).send(validInput)).status).toBe(403);
    expect((await request(app).delete(`/api/events/${e.id}`).set(ALICE)).status).toBe(403);

    const edited = await request(app).put(`/api/events/${e.id}`).set(HOST).send({ ...validInput, title: 'Renamed' });
    expect(edited.status).toBe(200);
    expect(edited.body.title).toBe('Renamed');

    expect((await request(app).delete(`/api/events/${e.id}`).set(HOST)).status).toBe(204);
    expect((await request(app).get(`/api/events/${e.id}`)).status).toBe(404);
  });

  it("won't shrink capacity below the current going count", async () => {
    const e = await createEvent();
    await request(app).put(`/api/events/${e.id}/rsvp`).set(ALICE).send({ status: 'going' });
    const res = await request(app).put(`/api/events/${e.id}`).set(HOST).send({ ...validInput, capacity: 1 });
    expect(res.status).toBe(422);
    expect(res.body.error.fieldErrors).toHaveProperty('capacity');
  });
});

describe('RSVP', () => {
  it('sets, changes and clears an RSVP', async () => {
    const going = await request(app).put('/api/events/future-tech/rsvp').set(ALICE).send({ status: 'going' });
    expect(going.body).toMatchObject({ myRsvp: 'going', goingCount: 1 });
    expect(going.body.attendeesPreview).toEqual([{ name: 'Alice' }]);

    const interested = await request(app).put('/api/events/future-tech/rsvp').set(ALICE).send({ status: 'interested' });
    expect(interested.body).toMatchObject({ myRsvp: 'interested', goingCount: 0, interestedCount: 1 });

    const cleared = await request(app).delete('/api/events/future-tech/rsvp').set(ALICE);
    expect(cleared.body).toMatchObject({ myRsvp: null, interestedCount: 0 });
  });

  it('enforces capacity but lets existing attendees re-confirm', async () => {
    const e = await createEvent(); // capacity 2, host is going
    expect((await request(app).put(`/api/events/${e.id}/rsvp`).set(ALICE).send({ status: 'going' })).status).toBe(200);
    const full = await request(app).put(`/api/events/${e.id}/rsvp`).set(BOB).send({ status: 'going' });
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe('EVENT_FULL');
    // Full events still accept "interested", and re-sending "going" is idempotent.
    expect((await request(app).put(`/api/events/${e.id}/rsvp`).set(BOB).send({ status: 'interested' })).status).toBe(200);
    expect((await request(app).put(`/api/events/${e.id}/rsvp`).set(ALICE).send({ status: 'going' })).status).toBe(200);
  });

  it('blocks RSVPs to past events and by the host', async () => {
    expect((await request(app).put('/api/events/old-one/rsvp').set(ALICE).send({ status: 'going' })).body.error.code).toBe('EVENT_ENDED');
    const e = await createEvent();
    expect((await request(app).delete(`/api/events/${e.id}/rsvp`).set(HOST)).body.error.code).toBe('HOST_RSVP');
  });

  it('personalises myRsvp per user', async () => {
    await request(app).put('/api/events/future-tech/rsvp').set(ALICE).send({ status: 'going' });
    expect((await request(app).get('/api/events/future-tech').set(BOB)).body.myRsvp).toBeNull();
    expect((await request(app).get('/api/events/future-tech').set(ALICE)).body.myRsvp).toBe('going');
  });
});
