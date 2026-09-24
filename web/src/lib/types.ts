// Mirrors the API contract in server/src/types.ts. In a larger codebase this would live in a
// shared workspace package (or be generated from an OpenAPI spec).

export const CATEGORIES = ['social', 'tech', 'music', 'food', 'sports', 'arts', 'outdoors', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

export type RsvpStatus = 'going' | 'interested' | 'waitlist';

/** RSVP aggregates that are the same for every viewer (what the live feed broadcasts). */
export interface PublicSnapshot {
  capacity: number | null;
  goingCount: number;
  interestedCount: number;
  waitlistCount: number;
  spotsLeft: number | null;
  attendeesPreview: { name: string }[];
}

export interface EventItem extends PublicSnapshot {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  location: { name: string; address: string };
  category: Category;
  hostId: string;
  hostName: string;
  createdAt: string;
  updatedAt: string;
  myRsvp: RsvpStatus | null;
  /** 1-based place in the queue when myRsvp is 'waitlist'. */
  waitlistPosition: number | null;
  isHost: boolean;
  isPast: boolean;
}

export interface EventPage {
  items: EventItem[];
  total: number;
  nextOffset: number | null;
}

export interface EventInput {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  location: { name: string; address: string };
  category: Category;
  capacity: number | null;
}

export type When = 'upcoming' | 'past';
export type Mine = 'going' | 'hosting';

export interface EventFilters {
  q?: string;
  category?: Category;
  when: When;
  mine?: Mine;
}

export type LiveMessage =
  | { type: 'rsvp'; id: string; snapshot: PublicSnapshot }
  | { type: 'created' | 'updated' | 'deleted'; id: string };
