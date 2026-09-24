import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { record, testApp, user } from './helpers.js';

const A = user('Alice');

describe('live feed', () => {
  it('publishes public RSVP counts, never personal fields', async () => {
    const { app, messages } = testApp([record({ id: 'e1', capacity: 5 })]);
    await request(app).put('/api/events/e1/rsvp').set(A).send({ status: 'going' });

    expect(messages).toEqual([
      {
        type: 'rsvp',
        id: 'e1',
        snapshot: {
          capacity: 5,
          goingCount: 1,
          interestedCount: 0,
          waitlistCount: 0,
          spotsLeft: 4,
          attendeesPreview: [{ name: 'Alice' }],
        },
      },
    ]);
    expect(JSON.stringify(messages)).not.toContain(A['x-user-id']);
  });

  it('does not publish no-op RSVPs', async () => {
    const { app, messages } = testApp([record({ id: 'e1' })]);
    await request(app).put('/api/events/e1/rsvp').set(A).send({ status: 'interested' });
    await request(app).put('/api/events/e1/rsvp').set(A).send({ status: 'interested' });
    expect(messages).toHaveLength(1);
  });

  it('publishes create / update / delete hints', async () => {
    const { app, messages } = testApp([]);
    const body = {
      title: 'Live test',
      description: 'Checking the live feed',
      startsAt: '2026-06-10T18:00:00.000Z',
      location: { name: 'Here' },
      category: 'tech',
    };
    const created = await request(app).post('/api/events').set(A).send(body);
    await request(app).put(`/api/events/${created.body.id}`).set(A).send({ ...body, title: 'Renamed' });
    await request(app).delete(`/api/events/${created.body.id}`).set(A);
    expect(messages.map((m) => m.type)).toEqual(['created', 'updated', 'deleted']);
  });

  it('streams messages to a real SSE client and cleans up on disconnect', async () => {
    const { app, live } = testApp([record({ id: 'e1' })]);
    const server = app.listen(0);
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const abort = new AbortController();

    try {
      const res = await fetch(`${base}/api/stream`, { signal: abort.signal });
      expect(res.headers.get('content-type')).toBe('text/event-stream');
      await expect.poll(() => live.size).toBe(2); // test recorder + this client

      await fetch(`${base}/api/events/e1/rsvp`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', ...A },
        body: JSON.stringify({ status: 'going' }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (!text.includes('data: ')) text += decoder.decode((await reader.read()).value);
      while (!text.endsWith('\n\n')) text += decoder.decode((await reader.read()).value);

      const data = JSON.parse(text.split('data: ')[1]!.trim());
      expect(data).toMatchObject({ type: 'rsvp', id: 'e1', snapshot: { goingCount: 1 } });

      abort.abort();
      await expect.poll(() => live.size).toBe(1);
    } finally {
      abort.abort();
      server.closeAllConnections();
      await new Promise((r) => server.close(r));
    }
  });
});
