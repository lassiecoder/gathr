import type { EventDto, EventRecord, PublicSnapshot, Rsvp } from './types.js';

export const DEFAULT_DURATION_MS = 2 * 3_600_000;

export const endOf = (e: Pick<EventRecord, 'startsAt' | 'endsAt'>) => Date.parse(e.endsAt ?? e.startsAt);

export const isPast = (e: Pick<EventRecord, 'startsAt' | 'endsAt'>, now = Date.now()) => endOf(e) < now;

export const goingCount = (e: EventRecord) => Object.values(e.rsvps).filter((r) => r.status === 'going').length;

const byJoinTime = ([idA, a]: [string, Rsvp], [idB, b]: [string, Rsvp]) => a.at.localeCompare(b.at) || idA.localeCompare(idB);

/** Waitlisted RSVPs, first-come first-served. */
export const waitlistQueue = (e: EventRecord) =>
  Object.entries(e.rsvps)
    .filter(([, r]) => r.status === 'waitlist')
    .sort(byJoinTime);

export function publicSnapshot(e: EventRecord): PublicSnapshot {
  const all = Object.values(e.rsvps);
  const going = all.filter((r) => r.status === 'going');
  return {
    capacity: e.capacity,
    goingCount: going.length,
    interestedCount: all.filter((r) => r.status === 'interested').length,
    waitlistCount: all.filter((r) => r.status === 'waitlist').length,
    spotsLeft: e.capacity == null ? null : Math.max(0, e.capacity - going.length),
    attendeesPreview: going
      .sort((a, b) => a.at.localeCompare(b.at))
      .slice(0, 6)
      .map((r) => ({ name: r.name })),
  };
}

export function toDto(e: EventRecord, userId: string | undefined, now = Date.now()): EventDto {
  const { rsvps, ...rest } = e;
  const myRsvp = (userId && rsvps[userId]?.status) || null;
  return {
    ...rest,
    ...publicSnapshot(e),
    myRsvp,
    waitlistPosition: myRsvp === 'waitlist' ? waitlistQueue(e).findIndex(([id]) => id === userId) + 1 : null,
    isHost: userId === e.hostId,
    isPast: isPast(e, now),
  };
}
