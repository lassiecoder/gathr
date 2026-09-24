import { useQueryClient } from '@tanstack/react-query';
import { eventKeys, useRsvp } from '../hooks/events';
import { ApiError } from '../lib/api';
import type { EventItem, RsvpStatus } from '../lib/types';
import { useToast } from './Toast';

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

function confirmation(e: EventItem): string {
  switch (e.myRsvp) {
    case 'going':
      return "You're going! 🎉";
    case 'interested':
      return 'Marked as interested';
    case 'waitlist':
      return `You're ${ordinal(e.waitlistPosition ?? 1)} on the waitlist`;
    default:
      return 'RSVP removed';
  }
}

export function RsvpControl({ event }: { event: EventItem }) {
  const rsvp = useRsvp(event);
  const toast = useToast();
  const qc = useQueryClient();

  const set = (status: RsvpStatus | null) => {
    rsvp.mutate(status, {
      // Toast from the server's answer: joining a waitlist can land you straight in "going".
      onSuccess: (fresh) => toast(confirmation(fresh)),
      onError: (err) => {
        toast(err.message, 'error');
        // A 409 means our copy is stale (someone took the last spot, event ended…) — resync.
        if (err instanceof ApiError && err.status === 409) qc.invalidateQueries({ queryKey: eventKeys.detail(event.id) });
      },
    });
  };

  if (event.isPast) {
    return (
      <div className="rsvp rsvp--muted">
        <p className="rsvp__headline">This event has ended</p>
        <p className="rsvp__sub">{event.myRsvp === 'going' ? 'Hope you had a great time.' : `${event.goingCount} people went.`}</p>
      </div>
    );
  }

  if (event.isHost) {
    return (
      <div className="rsvp rsvp--muted">
        <p className="rsvp__headline">You're hosting 🎤</p>
        <p className="rsvp__sub">
          You're automatically on the guest list.
          {event.waitlistCount > 0 && ` ${event.waitlistCount} waiting — raise the capacity to let them in.`}
        </p>
      </div>
    );
  }

  const pending = rsvp.isPending;

  if (event.myRsvp === 'going') {
    return (
      <div className="rsvp rsvp--confirmed">
        <p className="rsvp__headline">✓ You're going</p>
        <p className="rsvp__sub">We'll see you there.</p>
        <button type="button" className="btn btn--ghost btn--block" onClick={() => set(null)} disabled={pending}>
          {event.waitlistCount > 0 ? "Can't make it — give my spot away" : "Can't make it anymore"}
        </button>
      </div>
    );
  }

  if (event.myRsvp === 'waitlist') {
    return (
      <div className="rsvp rsvp--waitlist">
        <p className="rsvp__headline">⏳ You're {ordinal(event.waitlistPosition ?? 1)} in line</p>
        <p className="rsvp__sub">If a spot opens up you'll be moved in automatically — this page updates live.</p>
        <button type="button" className="btn btn--ghost btn--block" onClick={() => set(null)} disabled={pending}>
          Leave waitlist
        </button>
      </div>
    );
  }

  const full = event.spotsLeft === 0;
  const interested = event.myRsvp === 'interested';

  return (
    <div className="rsvp">
      <p className="rsvp__headline">{full ? 'This event is full' : 'Are you going?'}</p>
      {full && (
        <p className="rsvp__sub">
          {event.waitlistCount > 0
            ? `${event.waitlistCount} ${event.waitlistCount === 1 ? 'person is' : 'people are'} waiting. Join the line and you'll get the next open spot.`
            : "Join the waitlist and you'll get the next spot that opens."}
        </p>
      )}
      <div className="rsvp__actions">
        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={() => set(full ? 'waitlist' : 'going')}
          disabled={pending}
        >
          {full ? 'Join waitlist' : "I'm going"}
        </button>
        <button
          type="button"
          className={`btn btn--block ${interested ? 'btn--selected' : 'btn--secondary'}`}
          onClick={() => set(interested ? null : 'interested')}
          disabled={pending}
          aria-pressed={interested}
        >
          {interested ? '★ Interested' : '☆ Interested'}
        </button>
      </div>
    </div>
  );
}
