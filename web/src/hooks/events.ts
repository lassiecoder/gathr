import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { api } from '../lib/api';
import type { EventFilters, EventInput, EventItem, EventPage, RsvpStatus } from '../lib/types';

export const eventKeys = {
  all: ['events'] as const,
  lists: () => [...eventKeys.all, 'list'] as const,
  list: (filters: EventFilters) => [...eventKeys.lists(), filters] as const,
  detail: (id: string) => [...eventKeys.all, 'detail', id] as const,
};

type ListData = InfiniteData<EventPage, number>;

export function useEventList(filters: EventFilters) {
  return useInfiniteQuery({
    queryKey: eventKeys.list(filters),
    queryFn: ({ pageParam, signal }) => api.listEvents(filters, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
    // Keep the old results on screen while a new search/filter loads — no flash of skeletons.
    placeholderData: keepPreviousData,
  });
}

/** Finds an event already fetched by any list query, so detail pages can render instantly. */
function findInLists(qc: QueryClient, id: string): EventItem | undefined {
  for (const [, data] of qc.getQueriesData<ListData>({ queryKey: eventKeys.lists() })) {
    const hit = data?.pages.flatMap((p) => p.items).find((e) => e.id === id);
    if (hit) return hit;
  }
  return undefined;
}

/** Applies `update` to every cached list page that contains the event. */
export function patchLists(qc: QueryClient, id: string, update: (e: EventItem) => EventItem) {
  qc.setQueriesData<ListData>({ queryKey: eventKeys.lists() }, (data) =>
    data && {
      ...data,
      pages: data.pages.map((p) => ({ ...p, items: p.items.map((e) => (e.id === id ? update(e) : e)) })),
    },
  );
}

/** Every cached copy of an event: its detail entry plus any list entries. */
export function cachedCopies(qc: QueryClient, id: string): EventItem[] {
  const detail = qc.getQueryData<EventItem>(eventKeys.detail(id));
  const inLists = qc
    .getQueriesData<ListData>({ queryKey: eventKeys.lists() })
    .flatMap(([, data]) => data?.pages.flatMap((p) => p.items) ?? [])
    .filter((e) => e.id === id);
  return detail ? [detail, ...inLists] : inLists;
}

export function useEvent(id: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: eventKeys.detail(id),
    queryFn: ({ signal }) => api.getEvent(id, signal),
    placeholderData: () => findInLists(qc, id),
    retry: (count, err) => (err as { status?: number }).status !== 404 && count < 2,
  });
}

export function useSaveEvent(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EventInput) => (id ? api.updateEvent(id, input) : api.createEvent(input)),
    onSuccess: (event) => {
      qc.setQueryData(eventKeys.detail(event.id), event);
      return qc.invalidateQueries({ queryKey: eventKeys.lists() });
    },
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteEvent(id),
    onSuccess: (_void, id) => {
      qc.removeQueries({ queryKey: eventKeys.detail(id) });
      return qc.invalidateQueries({ queryKey: eventKeys.lists() });
    },
  });
}

/**
 * Pure helper so the optimistic update and its tests share the same maths. It can't know who
 * gets promoted off the waitlist — the server response (and live feed) fill that in.
 */
export function applyRsvp(e: EventItem, next: RsvpStatus | null): EventItem {
  const delta = (s: RsvpStatus) => (next === s ? 1 : 0) - (e.myRsvp === s ? 1 : 0);
  const goingCount = Math.max(0, e.goingCount + delta('going'));
  const waitlistCount = Math.max(0, e.waitlistCount + delta('waitlist'));
  return {
    ...e,
    myRsvp: next,
    goingCount,
    interestedCount: Math.max(0, e.interestedCount + delta('interested')),
    waitlistCount,
    waitlistPosition: next === 'waitlist' ? (e.myRsvp === 'waitlist' ? e.waitlistPosition : waitlistCount) : null,
    spotsLeft: e.capacity == null ? null : Math.max(0, e.capacity - goingCount),
  };
}

export function useRsvp(event: EventItem) {
  const qc = useQueryClient();
  const key = eventKeys.detail(event.id);
  return useMutation({
    mutationFn: (status: RsvpStatus | null) => api.setRsvp(event.id, status),
    onMutate: async (status) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<EventItem>(key) ?? event;
      const optimistic = applyRsvp(previous, status);
      qc.setQueryData(key, optimistic);
      patchLists(qc, event.id, () => optimistic);
      return { previous };
    },
    onError: (_err, _status, ctx) => {
      if (!ctx) return;
      qc.setQueryData(key, ctx.previous);
      patchLists(qc, event.id, () => ctx.previous);
    },
    onSuccess: (fresh) => {
      qc.setQueryData(key, fresh);
      patchLists(qc, event.id, () => fresh);
    },
    // "Going"/"Hosting" tabs depend on membership, so refetch lists in the background.
    onSettled: () => qc.invalidateQueries({ queryKey: eventKeys.lists(), refetchType: 'inactive' }),
  });
}
