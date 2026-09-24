import { randomUUID } from 'node:crypto';
import type { Category } from './schemas.js';
import type { EventRecord, Rsvp } from './types.js';

const PEOPLE = [
  'Aanya Mehta', 'Jordan Lee', 'Priya Nair', 'Sam Okafor', 'Maya Chen', 'Rohan Iyer', 'Elena Rossi',
  'Dev Kapoor', 'Chris Park', 'Zara Ali', 'Leo Martins', 'Nina Patel', 'Omar Haddad', 'Ivy Brooks',
  'Kabir Singh', 'Grace Kim', 'Arjun Rao', 'Lucia Gomez', 'Tariq Khan', 'Hannah Weiss',
];

interface SeedSpec {
  title: string;
  description: string;
  category: Category;
  day: number; // days from today (negative = past)
  hour: number;
  minute?: number;
  durationH: number | null;
  location: { name: string; address: string };
  capacity: number | null;
  going: number;
  interested: number;
  waitlist?: number;
  host: number; // index into PEOPLE
}

const SPECS: SeedSpec[] = [
  {
    title: 'Sunrise Run & Coffee',
    description: 'An easy-paced 5K loop around the lake followed by pour-overs at the kiosk. All paces welcome — nobody gets left behind.\n\nBring water and a light layer; it gets breezy by the water.',
    category: 'sports', day: 1, hour: 6, minute: 30, durationH: 2,
    location: { name: 'Lakeside Promenade', address: 'North Gate, Lakeside Park' },
    capacity: 30, going: 18, interested: 6, host: 0,
  },
  {
    title: 'React Native Performance Deep Dive',
    description: 'A hands-on session on profiling RN apps: Hermes sampling profiler, FlashList vs FlatList, avoiding bridge chatter, and shipping with the new architecture.\n\nBring a laptop with a simulator set up.',
    category: 'tech', day: 2, hour: 18, durationH: 3,
    location: { name: 'The Foundry Co-working', address: '4th Floor, 21 Mill Street' },
    capacity: 40, going: 39, interested: 12, host: 1,
  },
  {
    title: 'Rooftop Jazz Night',
    description: 'Live trio playing standards and a few originals as the sun goes down. Small plates and mocktails available at the bar.',
    category: 'music', day: 3, hour: 19, minute: 30, durationH: 3,
    location: { name: 'Skyline Terrace', address: '88 Harbor Road, Rooftop' },
    capacity: 60, going: 60, interested: 21, waitlist: 4, host: 2,
  },
  {
    title: 'Street Food Crawl: Old Town',
    description: 'Six stops, one evening. We will hit the best chaat, momos, kebab rolls and finish with kulfi. Come hungry and bring cash for the stalls.',
    category: 'food', day: 4, hour: 17, durationH: 3,
    location: { name: 'Clock Tower Square', address: 'Old Town' },
    capacity: 16, going: 9, interested: 14, host: 3,
  },
  {
    title: 'Board Games & Chill',
    description: 'Catan, Codenames, Wingspan and a stack of party games. First-timers are very welcome — we will teach you the rules.',
    category: 'social', day: 5, hour: 16, durationH: 4,
    location: { name: 'The Meeple Café', address: '12 Park Lane' },
    capacity: null, going: 23, interested: 8, host: 4,
  },
  {
    title: 'Watercolor for Beginners',
    description: 'Learn washes, layering and loose florals in a relaxed two-hour workshop. All materials provided; just bring yourself.',
    category: 'arts', day: 6, hour: 11, durationH: 2,
    location: { name: 'Studio Nine', address: '9 Artisan Row' },
    capacity: 12, going: 7, interested: 5, host: 5,
  },
  {
    title: 'Weekend Trail Hike: Ridge Loop',
    description: 'A moderate 11 km loop with about 450 m of elevation gain. We carpool from the meeting point at 7:00 sharp.\n\nWear proper shoes, carry 2L of water and snacks.',
    category: 'outdoors', day: 8, hour: 7, durationH: 6,
    location: { name: 'Ridge Trailhead Parking', address: 'Forest Route 3' },
    capacity: 20, going: 11, interested: 9, host: 6,
  },
  {
    title: 'Founders & Builders Mixer',
    description: 'An unstructured evening for people building things: founders, engineers, designers, PMs. No pitches, just good conversations.',
    category: 'social', day: 9, hour: 19, durationH: 3,
    location: { name: 'Common Ground Bar', address: '5 Station Road' },
    capacity: 80, going: 34, interested: 27, host: 7,
  },
  {
    title: 'Open Mic: Acoustic Sessions',
    description: 'Sign up at the door for a 10-minute slot. Poetry, covers, originals — everything goes. Great crowd, supportive vibes.',
    category: 'music', day: 11, hour: 20, durationH: 3,
    location: { name: 'The Listening Room', address: '31 Canal Street' },
    capacity: null, going: 15, interested: 19, host: 8,
  },
  {
    title: 'Sourdough Bread Workshop',
    description: 'From starter to crust. Take home your own starter and a loaf you shaped yourself. Aprons provided.',
    category: 'food', day: 13, hour: 10, durationH: 4,
    location: { name: 'Crumb & Co. Bakery', address: '44 Baker Street' },
    capacity: 10, going: 4, interested: 6, host: 9,
  },
  {
    title: 'TypeScript Type-Level Puzzles',
    description: 'Bring your brain. We will work through a set of type challenges in pairs — conditional types, template literals and inference tricks.',
    category: 'tech', day: 15, hour: 18, minute: 30, durationH: 2,
    location: { name: 'Online', address: 'Link shared with attendees' },
    capacity: 100, going: 42, interested: 30, host: 10,
  },
  {
    title: '5-a-side Football League Night',
    description: 'Mixed teams, rotating every 12 minutes. Bibs and balls provided. Indoor turf, so flat shoes only.',
    category: 'sports', day: 17, hour: 20, durationH: 2,
    location: { name: 'Arena Turf', address: 'Sector 7 Sports Complex' },
    capacity: 20, going: 13, interested: 3, host: 11,
  },
  {
    title: 'Sketch Walk by the River',
    description: 'We walked, stopped and sketched the bridges. Thanks to everyone who came out!',
    category: 'arts', day: -3, hour: 9, durationH: 3,
    location: { name: 'Riverside Steps', address: 'East Bank' },
    capacity: 25, going: 17, interested: 4, host: 12,
  },
  {
    title: 'Indie Film Screening & Q&A',
    description: 'A screening of a local short-film anthology followed by a Q&A with two of the directors.',
    category: 'arts', day: -8, hour: 19, durationH: 3,
    location: { name: 'Little Cinema', address: '2 Theatre Lane' },
    capacity: 50, going: 48, interested: 10, host: 13,
  },
];

/** Milliseconds `timeZone` is ahead of UTC at instant `ms` (e.g. -4h for New York in summer). */
function zoneOffset(ms: number, timeZone: string) {
  const parts: Record<string, number> = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, Number(p.value)]),
  );
  const get = (type: string) => parts[type] ?? 0;
  return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')) - (ms - (ms % 1000));
}

/**
 * A wall-clock time in `timeZone`, `day` days from today there — independent of the server's own
 * zone, so "Sunrise Run 6:30" really is 6:30am for the audience whether the host runs UTC or not.
 */
export function atZoned(day: number, hour: number, minute: number, timeZone: string, now = Date.now()) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(now))
    .split('-')
    .map(Number) as [number, number, number];
  const wall = Date.UTC(today[0], today[1] - 1, today[2] + day, hour, minute);
  // Two passes settle the offset across DST boundaries.
  let ms = wall - zoneOffset(wall, timeZone);
  ms = wall - zoneOffset(ms, timeZone);
  return new Date(ms);
}

export function seedEvents(timeZone = process.env.SEED_TZ ?? 'America/New_York'): EventRecord[] {
  const createdAt = atZoned(-14, 12, 0, timeZone).toISOString();
  return SPECS.map((s, i) => {
    const start = atZoned(s.day, s.hour, s.minute ?? 0, timeZone);
    const end = s.durationH ? new Date(start.getTime() + s.durationH * 3_600_000) : null;
    const hostName = PEOPLE[s.host]!;
    const hostId = `seed-user-${s.host}`;

    const rsvps: Record<string, Rsvp> = { [hostId]: { status: 'going', name: hostName, at: createdAt } };
    // Deterministically fan out fake attendees; names cycle but ids stay unique.
    const waitlist = s.waitlist ?? 0;
    for (let n = 0; Object.keys(rsvps).length < s.going + waitlist + s.interested; n++) {
      const count = Object.keys(rsvps).length;
      const status = count < s.going ? 'going' : count < s.going + waitlist ? 'waitlist' : 'interested';
      rsvps[`seed-attendee-${i}-${n}`] = {
        status,
        name: PEOPLE[(s.host + n + 1) % PEOPLE.length]!,
        at: new Date(Date.parse(createdAt) + n * 3_600_000).toISOString(),
      };
    }

    return {
      id: randomUUID(),
      title: s.title,
      description: s.description,
      startsAt: start.toISOString(),
      endsAt: end?.toISOString() ?? null,
      location: s.location,
      category: s.category,
      capacity: s.capacity,
      hostId,
      hostName,
      createdAt,
      updatedAt: createdAt,
      rsvps,
    };
  });
}
