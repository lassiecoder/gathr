import { fromInputs, toInputs } from './datetime';
import type { Category, EventInput, EventItem } from './types';

/** Form state is all strings so inputs stay controlled; conversion happens once, on submit. */
export interface EventFormValues {
  title: string;
  description: string;
  category: Category | '';
  date: string;
  startTime: string;
  endTime: string;
  locationName: string;
  address: string;
  capacity: string;
}

export type EventFormErrors = Partial<Record<keyof EventFormValues, string>>;

export const emptyValues: EventFormValues = {
  title: '',
  description: '',
  category: '',
  date: '',
  startTime: '',
  endTime: '',
  locationName: '',
  address: '',
  capacity: '',
};

export function valuesFromEvent(e: EventItem): EventFormValues {
  const start = toInputs(e.startsAt);
  return {
    title: e.title,
    description: e.description,
    category: e.category,
    date: start.date,
    startTime: start.time,
    endTime: e.endsAt ? toInputs(e.endsAt).time : '',
    locationName: e.location.name,
    address: e.location.address,
    capacity: e.capacity == null ? '' : String(e.capacity),
  };
}

/**
 * Resolves start/end. End is a time on the same day; if it's at or before the start we treat it
 * as running past midnight (e.g. 21:00 → 01:00), which is how people think about late events.
 */
export function resolveTimes(v: Pick<EventFormValues, 'date' | 'startTime' | 'endTime'>) {
  const start = fromInputs(v.date, v.startTime);
  if (!start) return { start: null, end: null, endsNextDay: false };
  if (!v.endTime) return { start, end: null, endsNextDay: false };
  const end = fromInputs(v.date, v.endTime);
  if (!end) return { start, end: null, endsNextDay: false };
  const endsNextDay = end <= start;
  if (endsNextDay) end.setDate(end.getDate() + 1);
  return { start, end, endsNextDay };
}

interface ValidateOptions {
  /** Only enforce "must be in the future" when the start actually changed. */
  originalStartsAt?: string;
  now?: Date;
}

export function validate(v: EventFormValues, opts: ValidateOptions = {}): EventFormErrors {
  const errors: EventFormErrors = {};
  const title = v.title.trim();
  const description = v.description.trim();

  if (title.length < 3) errors.title = 'Give your event a title (at least 3 characters)';
  else if (title.length > 100) errors.title = 'Keep the title under 100 characters';

  if (description.length < 10) errors.description = 'Add a few more details (at least 10 characters)';
  else if (description.length > 2000) errors.description = 'Keep the description under 2000 characters';

  if (!v.category) errors.category = 'Pick a category';

  if (!v.date) errors.date = 'Pick a date';
  if (!v.startTime) errors.startTime = 'Pick a start time';

  const { start, end } = resolveTimes(v);
  if (v.date && v.startTime && !start) errors.startTime = 'Enter a valid date and time';
  if (v.endTime && start && !end) errors.endTime = 'Enter a valid end time';
  if (start) {
    const changed = !opts.originalStartsAt || start.getTime() !== Date.parse(opts.originalStartsAt);
    if (changed && start.getTime() < (opts.now ?? new Date()).getTime()) {
      errors.startTime = 'Start time must be in the future';
    }
  }

  if (v.locationName.trim().length < 2) errors.locationName = 'Where is it happening?';

  if (v.capacity.trim()) {
    const n = Number(v.capacity);
    if (!Number.isInteger(n) || n < 1) errors.capacity = 'Capacity must be a whole number of at least 1';
    else if (n > 100_000) errors.capacity = 'That’s a big crowd — max is 100,000';
  }

  return errors;
}

export function toInput(v: EventFormValues): EventInput {
  const { start, end } = resolveTimes(v);
  return {
    title: v.title.trim(),
    description: v.description.trim(),
    category: v.category as Category,
    startsAt: start!.toISOString(),
    endsAt: end?.toISOString() ?? null,
    location: { name: v.locationName.trim(), address: v.address.trim() },
    capacity: v.capacity.trim() ? Number(v.capacity) : null,
  };
}

/** Maps API field paths onto form fields so server-side errors land next to the right input. */
export function mapServerErrors(fieldErrors: Record<string, string>): EventFormErrors {
  const map: Record<string, keyof EventFormValues> = {
    title: 'title',
    description: 'description',
    category: 'category',
    startsAt: 'startTime',
    endsAt: 'endTime',
    'location.name': 'locationName',
    'location.address': 'address',
    capacity: 'capacity',
  };
  const out: EventFormErrors = {};
  for (const [path, message] of Object.entries(fieldErrors)) {
    const field = map[path];
    if (field) out[field] ??= message;
  }
  return out;
}
