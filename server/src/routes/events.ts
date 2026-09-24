import { randomUUID } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { HttpError, notFound } from '../errors.js';
import { icsFilename, toIcs } from '../ics.js';
import { currentUser, requireUser } from '../identity.js';
import type { LiveHub } from '../live.js';
import { changeRsvp, promoteFromWaitlist } from '../rsvp.js';
import { eventInputSchema, listQuerySchema, rsvpSchema, type EventInput } from '../schemas.js';
import { goingCount, isPast, publicSnapshot, toDto } from '../serialize.js';
import type { EventStore } from '../store.js';
import type { EventRecord, RsvpStatus } from '../types.js';

// Express 5 widens params to string | string[] once middleware sits between path and handler.
const idOf = (req: Request) => String(req.params.id);

export interface EventsRouterDeps {
  store: EventStore;
  live: LiveHub;
  now: () => number;
  /** Public web origin for links inside calendar files; falls back to the request's origin. */
  webOrigin?: string;
}

export function eventsRouter({ store, live, now, webOrigin }: EventsRouterDeps) {
  const router = Router();
  const nowIso = () => new Date(now()).toISOString();

  const load = (id: string) => {
    const event = store.get(id);
    if (!event) throw notFound();
    return event;
  };

  const assertHost = (event: EventRecord, userId: string) => {
    if (event.hostId !== userId) throw new HttpError(403, 'FORBIDDEN', 'Only the host can change this event');
  };

  const assertFutureStart = (input: EventInput) => {
    if (Date.parse(input.startsAt) < now()) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'Please fix the highlighted fields', {
        startsAt: 'Start time must be in the future',
      });
    }
  };

  router.get('/', (req, res) => {
    const query = listQuerySchema.parse(req.query);
    const userId = currentUser(res.locals)?.id;
    const t = now();
    const needle = query.q?.toLowerCase();

    let items = store.all().filter((e) => {
      if (query.when === 'upcoming' && isPast(e, t)) return false;
      if (query.when === 'past' && !isPast(e, t)) return false;
      if (query.category && e.category !== query.category) return false;
      if (query.mine === 'hosting' && e.hostId !== userId) return false;
      if (query.mine === 'going' && !(userId && e.rsvps[userId])) return false;
      if (needle) {
        const haystack = [e.title, e.description, e.location.name, e.location.address, e.hostName].join(' ').toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });

    // Upcoming reads soonest-first; past reads most-recent-first.
    const dir = query.when === 'past' ? -1 : 1;
    items.sort((a, b) => dir * (Date.parse(a.startsAt) - Date.parse(b.startsAt)));

    const total = items.length;
    items = items.slice(query.offset, query.offset + query.limit);
    const nextOffset = query.offset + items.length < total ? query.offset + items.length : null;

    res.json({ items: items.map((e) => toDto(e, userId, t)), total, nextOffset });
  });

  router.get('/:id', (req, res) => {
    res.json(toDto(load(idOf(req)), currentUser(res.locals)?.id, now()));
  });

  router.get('/:id/ics', (req, res) => {
    const event = load(idOf(req));
    res
      .type('text/calendar; charset=utf-8')
      .attachment(icsFilename(event.title))
      .send(toIcs(event, { url: `${webOrigin ?? `${req.protocol}://${req.get('host')}`}/events/${event.id}`, now: now() }));
  });

  router.post('/', requireUser, async (req, res) => {
    const user = currentUser(res.locals)!;
    const input = eventInputSchema.parse(req.body);
    assertFutureStart(input);

    const ts = nowIso();
    const event: EventRecord = {
      id: randomUUID(),
      ...input,
      hostId: user.id,
      hostName: user.name,
      createdAt: ts,
      updatedAt: ts,
      // Hosts are always attending their own event.
      rsvps: { [user.id]: { status: 'going', name: user.name, at: ts } },
    };
    await store.save(event);
    live.publish({ type: 'created', id: event.id });
    res.status(201).location(`/api/events/${event.id}`).json(toDto(event, user.id, now()));
  });

  router.put('/:id', requireUser, async (req, res) => {
    const user = currentUser(res.locals)!;
    const existing = load(idOf(req));
    assertHost(existing, user.id);
    const input = eventInputSchema.parse(req.body);

    if (input.startsAt !== existing.startsAt) assertFutureStart(input);
    const going = goingCount(existing);
    if (input.capacity != null && input.capacity < going) {
      throw new HttpError(422, 'VALIDATION_FAILED', 'Please fix the highlighted fields', {
        capacity: `${going} people are already going — capacity can't be lower than that`,
      });
    }

    // Raising (or removing) capacity lets people in off the waitlist.
    const { event: updated } = promoteFromWaitlist({ ...existing, ...input, updatedAt: nowIso() }, nowIso());
    await store.save(updated);
    live.publish({ type: 'updated', id: updated.id });
    res.json(toDto(updated, user.id, now()));
  });

  router.delete('/:id', requireUser, async (req, res) => {
    const user = currentUser(res.locals)!;
    assertHost(load(idOf(req)), user.id);
    await store.remove(idOf(req));
    live.publish({ type: 'deleted', id: idOf(req) });
    res.status(204).end();
  });

  const rsvpHandler = (statusOf: (req: Request) => RsvpStatus | null) =>
    async (req: Request, res: Response) => {
      const user = currentUser(res.locals)!;
      const event = load(idOf(req));
      const next = statusOf(req);

      if (isPast(event, now())) throw new HttpError(409, 'EVENT_ENDED', 'This event has already ended');
      if (event.hostId === user.id) throw new HttpError(409, 'HOST_RSVP', "You're hosting this event");

      const change = changeRsvp(event, user, next, nowIso());
      if (change.event !== event) {
        await store.save(change.event);
        live.publish({ type: 'rsvp', id: event.id, snapshot: publicSnapshot(change.event) });
      }
      res.json(toDto(change.event, user.id, now()));
    };

  router.put('/:id/rsvp', requireUser, rsvpHandler((req) => rsvpSchema.parse(req.body).status));
  router.delete('/:id/rsvp', requireUser, rsvpHandler(() => null));

  return router;
}
