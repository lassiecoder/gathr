import { HttpError } from './errors.js';
import { goingCount, waitlistQueue } from './serialize.js';
import type { EventRecord, RsvpStatus, User } from './types.js';

export interface RsvpChange {
  event: EventRecord;
  /** User ids moved from the waitlist to going as a side effect. */
  promoted: string[];
}

/** Fills any open spots from the front of the waitlist. Removing capacity promotes everyone. */
export function promoteFromWaitlist(event: EventRecord, nowIso: string): RsvpChange {
  const rsvps = { ...event.rsvps };
  const promoted: string[] = [];
  let going = goingCount(event);
  for (const [id, r] of waitlistQueue(event)) {
    if (event.capacity != null && going >= event.capacity) break;
    rsvps[id] = { ...r, status: 'going', at: nowIso };
    promoted.push(id);
    going++;
  }
  return { event: promoted.length ? { ...event, rsvps } : event, promoted };
}

/**
 * Applies one user's RSVP change. Rules:
 * - "going" on a full event is rejected; the client should offer the waitlist instead.
 * - "waitlist" on an event with room simply makes you going (no point queueing for nothing).
 * - Re-sending your current status is a no-op, so you never lose your place in the queue.
 * - Leaving "going" frees a spot, which is handed to the first person on the waitlist.
 */
export function changeRsvp(event: EventRecord, user: User, status: RsvpStatus | null, nowIso: string): RsvpChange {
  const current = event.rsvps[user.id];
  const othersGoing = goingCount(event) - (current?.status === 'going' ? 1 : 0);
  const full = event.capacity != null && othersGoing >= event.capacity;

  let next = status;
  if (next === 'waitlist' && !full) next = 'going';
  if (next === 'going' && full) throw new HttpError(409, 'EVENT_FULL', 'This event is full — join the waitlist instead');
  if ((current?.status ?? null) === next) return { event, promoted: [] };

  const rsvps = { ...event.rsvps };
  if (next) rsvps[user.id] = { status: next, name: user.name, at: nowIso };
  else delete rsvps[user.id];

  const updated = { ...event, rsvps };
  return current?.status === 'going' ? promoteFromWaitlist(updated, nowIso) : { event: updated, promoted: [] };
}
