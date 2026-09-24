import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import { useToast } from '../components/Toast';
import { api, API_BASE } from '../lib/api';
import type { EventItem, LiveMessage } from '../lib/types';
import { cachedCopies, eventKeys, patchLists } from './events';

export type LiveStatus = 'connecting' | 'live' | 'offline';

let status: LiveStatus = 'connecting';
const listeners = new Set<() => void>();
function setStatus(next: LiveStatus) {
  if (next === status) return;
  status = next;
  listeners.forEach((l) => l());
}

export const useLiveStatus = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => status,
  );

type Notify = (message: string) => void;

/**
 * Applies one message from the server's change feed to the query cache.
 * Exported separately from the hook so it can be unit-tested without an EventSource.
 */
export function applyLiveMessage(qc: QueryClient, msg: LiveMessage, notify: Notify) {
  switch (msg.type) {
    case 'rsvp': {
      // Counts are identical for every viewer, so patch in place — no refetch needed.
      const wasWaitlisted = cachedCopies(qc, msg.id).some((e) => e.myRsvp === 'waitlist');
      qc.setQueryData<EventItem>(eventKeys.detail(msg.id), (e) => e && { ...e, ...msg.snapshot });
      patchLists(qc, msg.id, (e) => ({ ...e, ...msg.snapshot }));

      // Personal fields aren't broadcast. If we're queued, fetch our own view to learn whether we
      // were promoted or moved up the line.
      if (wasWaitlisted) {
        qc.fetchQuery({ queryKey: eventKeys.detail(msg.id), queryFn: () => api.getEvent(msg.id), staleTime: 0 })
          .then((fresh) => {
            patchLists(qc, fresh.id, () => fresh);
            if (fresh.myRsvp === 'going') notify(`A spot opened up — you're going to ${fresh.title}! 🎉`);
          })
          .catch(() => {});
      }
      break;
    }
    case 'updated':
    case 'deleted':
      void qc.invalidateQueries({ queryKey: eventKeys.detail(msg.id) });
      void qc.invalidateQueries({ queryKey: eventKeys.lists() });
      break;
    case 'created':
      void qc.invalidateQueries({ queryKey: eventKeys.lists() });
      break;
  }
}

/** Subscribes to the server's SSE change feed for as long as the app is mounted. */
export function useLiveUpdates() {
  const qc = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (typeof EventSource === 'undefined') {
      setStatus('offline');
      return;
    }
    const source = new EventSource(`${API_BASE}/stream`);
    let dropped = false;

    source.onopen = () => {
      setStatus('live');
      // EventSource reconnects on its own, but anything published while we were away is lost.
      if (dropped) void qc.invalidateQueries({ queryKey: eventKeys.all });
      dropped = false;
    };
    source.onerror = () => {
      dropped = true;
      setStatus(source.readyState === EventSource.CLOSED ? 'offline' : 'connecting');
    };
    source.onmessage = (e) => {
      try {
        applyLiveMessage(qc, JSON.parse(e.data) as LiveMessage, (m) => toast(m));
      } catch {
        /* ignore malformed frames */
      }
    };

    return () => source.close();
  }, [qc, toast]);
}
