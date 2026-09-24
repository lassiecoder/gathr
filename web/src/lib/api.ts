import { getIdentity } from './identity';
import type { EventFilters, EventInput, EventItem, EventPage, RsvpStatus } from './types';

export const API_BASE = import.meta.env.VITE_API_URL ?? '/api';
export const PAGE_SIZE = 12;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { id, name } = getIdentity();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': id,
        'x-user-name': encodeURIComponent(name),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'NETWORK', "Can't reach the server. Check your connection and try again.");
  }

  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const e = body?.error;
    throw new ApiError(res.status, e?.code ?? 'UNKNOWN', e?.message ?? `Request failed (${res.status})`, e?.fieldErrors);
  }
  return body as T;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const api = {
  listEvents(filters: EventFilters, offset = 0, signal?: AbortSignal) {
    const params = new URLSearchParams({ when: filters.when, limit: String(PAGE_SIZE), offset: String(offset) });
    if (filters.q) params.set('q', filters.q);
    if (filters.category) params.set('category', filters.category);
    if (filters.mine) params.set('mine', filters.mine);
    return request<EventPage>(`/events?${params}`, { signal });
  },
  getEvent: (id: string, signal?: AbortSignal) => request<EventItem>(`/events/${encodeURIComponent(id)}`, { signal }),
  createEvent: (input: EventInput) => request<EventItem>('/events', json('POST', input)),
  updateEvent: (id: string, input: EventInput) => request<EventItem>(`/events/${encodeURIComponent(id)}`, json('PUT', input)),
  deleteEvent: (id: string) => request<void>(`/events/${encodeURIComponent(id)}`, json('DELETE')),
  setRsvp: (id: string, status: RsvpStatus | null) =>
    status
      ? request<EventItem>(`/events/${encodeURIComponent(id)}/rsvp`, json('PUT', { status }))
      : request<EventItem>(`/events/${encodeURIComponent(id)}/rsvp`, json('DELETE')),
};
