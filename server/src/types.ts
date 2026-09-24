import type { Category } from './schemas.js';

export type RsvpStatus = 'going' | 'interested' | 'waitlist';

export interface Rsvp {
  status: RsvpStatus;
  name: string;
  at: string;
}

/** Shape persisted to disk. Never sent to clients as-is (rsvps leak user ids). */
export interface EventRecord {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  location: { name: string; address: string };
  category: Category;
  capacity: number | null;
  hostId: string;
  hostName: string;
  createdAt: string;
  updatedAt: string;
  rsvps: Record<string, Rsvp>;
}

/** Aggregate RSVP numbers that are identical for every viewer — safe to broadcast live. */
export interface PublicSnapshot {
  capacity: number | null;
  goingCount: number;
  interestedCount: number;
  waitlistCount: number;
  spotsLeft: number | null;
  attendeesPreview: { name: string }[];
}

/** Shape returned by the API, personalised for the requesting user. */
export interface EventDto extends Omit<EventRecord, 'rsvps'>, PublicSnapshot {
  myRsvp: RsvpStatus | null;
  /** 1-based place in the waitlist queue, when myRsvp is 'waitlist'. */
  waitlistPosition: number | null;
  isHost: boolean;
  isPast: boolean;
}

export interface User {
  id: string;
  name: string;
}
