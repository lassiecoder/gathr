import { QueryClient, type InfiniteData } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import type { EventItem, EventPage } from '../lib/types';
import { eventKeys } from './events';
import { applyLiveMessage } from './useLiveUpdates';

const base: EventItem = {
  id: 'e1',
  title: 'Jazz',
  description: 'Live trio',
  startsAt: '2026-09-27T13:30:00.000Z',
  endsAt: null,
  location: { name: 'Terrace', address: '' },
  category: 'music',
  capacity: 2,
  hostId: 'h',
  hostName: 'Host',
  createdAt: '',
  updatedAt: '',
  goingCount: 2,
  interestedCount: 0,
  waitlistCount: 1,
  spotsLeft: 0,
  attendeesPreview: [],
  myRsvp: null,
  waitlistPosition: null,
  isHost: false,
  isPast: false,
};

const snapshot = { capacity: 2, goingCount: 1, interestedCount: 0, waitlistCount: 0, spotsLeft: 1, attendeesPreview: [{ name: 'A' }] };
const listKey = eventKeys.list({ when: 'upcoming' });

function seed(event: EventItem) {
  const qc = new QueryClient();
  qc.setQueryData(eventKeys.detail(event.id), event);
  qc.setQueryData<InfiniteData<EventPage, number>>(listKey, {
    pages: [{ items: [event], total: 1, nextOffset: null }],
    pageParams: [0],
  });
  return qc;
}

afterEach(() => vi.restoreAllMocks());

describe('applyLiveMessage', () => {
  it('patches public counts into detail and list caches, keeping personal fields', () => {
    const qc = seed({ ...base, myRsvp: 'interested' });
    const spy = vi.spyOn(api, 'getEvent');
    applyLiveMessage(qc, { type: 'rsvp', id: 'e1', snapshot }, vi.fn());

    expect(qc.getQueryData<EventItem>(eventKeys.detail('e1'))).toMatchObject({ goingCount: 1, spotsLeft: 1, myRsvp: 'interested' });
    const list = qc.getQueryData<InfiniteData<EventPage, number>>(listKey)!;
    expect(list.pages[0]!.items[0]).toMatchObject({ goingCount: 1, myRsvp: 'interested' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('refetches and celebrates when a waitlisted viewer gets promoted', async () => {
    const qc = seed({ ...base, myRsvp: 'waitlist', waitlistPosition: 1 });
    vi.spyOn(api, 'getEvent').mockResolvedValue({ ...base, ...snapshot, goingCount: 2, myRsvp: 'going' });
    const notify = vi.fn();

    applyLiveMessage(qc, { type: 'rsvp', id: 'e1', snapshot }, notify);

    await vi.waitFor(() => expect(notify).toHaveBeenCalledWith(expect.stringContaining("you're going to Jazz")));
    expect(qc.getQueryData<EventItem>(eventKeys.detail('e1'))?.myRsvp).toBe('going');
  });

  it('invalidates on edits so the next read refetches', () => {
    const qc = seed(base);
    applyLiveMessage(qc, { type: 'updated', id: 'e1' }, vi.fn());
    expect(qc.getQueryState(eventKeys.detail('e1'))?.isInvalidated).toBe(true);
    expect(qc.getQueryState(listKey)?.isInvalidated).toBe(true);
  });
});
