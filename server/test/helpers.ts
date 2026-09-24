import { createApp } from '../src/app.js';
import { LiveHub, type LiveMessage } from '../src/live.js';
import { EventStore } from '../src/store.js';
import type { EventRecord } from '../src/types.js';

export const NOW = Date.parse('2026-06-01T12:00:00Z');

export const user = (name: string) => ({ 'x-user-id': `${name.toLowerCase()}-user-id`, 'x-user-name': name });

export function record(over: Partial<EventRecord>): EventRecord {
  return {
    id: 'e1',
    title: 'Seeded',
    description: 'A seeded event for tests',
    startsAt: '2026-06-05T10:00:00.000Z',
    endsAt: null,
    location: { name: 'Park', address: '' },
    category: 'outdoors',
    capacity: null,
    hostId: 'host-user-id',
    hostName: 'Hana',
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
    rsvps: {},
    ...over,
  };
}

/** App with a controllable clock and a recorder for everything published on the live feed. */
export function testApp(events: EventRecord[], opts: { now?: () => number } = {}) {
  const live = new LiveHub();
  const messages: LiveMessage[] = [];
  live.subscribe((m) => messages.push(m));
  const app = createApp(EventStore.inMemory(events), { now: opts.now ?? (() => NOW), live, webOrigin: 'https://gathr.test' });
  return { app, live, messages };
}
