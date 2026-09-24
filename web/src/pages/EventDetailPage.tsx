import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AddToCalendar } from '../components/AddToCalendar';
import { AvatarStack, Avatar } from '../components/Avatar';
import { CategoryPill } from '../components/CategoryPill';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { RsvpControl } from '../components/RsvpControl';
import { EmptyState, ErrorState } from '../components/States';
import { useToast } from '../components/Toast';
import { useDeleteEvent, useEvent } from '../hooks/events';
import { useLiveStatus } from '../hooks/useLiveUpdates';
import { ApiError } from '../lib/api';
import { CATEGORY_META, coverStyle } from '../lib/categories';
import { formatLong, relativeDay } from '../lib/datetime';
import type { EventItem } from '../lib/types';

export function EventDetailPage() {
  const { id = '' } = useParams();
  const { data: event, error, isPending, refetch } = useEvent(id);

  if (isPending) return <DetailSkeleton />;
  if (error) {
    if (error instanceof ApiError && error.status === 404) {
      return (
        <EmptyState
          emoji="🧭"
          title="Event not found"
          body="It may have been deleted, or the link is wrong."
          action={<Link to="/" className="btn btn--primary">Browse events</Link>}
        />
      );
    }
    return <ErrorState message={error.message} onRetry={() => refetch()} />;
  }
  return <EventDetail event={event} />;
}

function EventDetail({ event }: { event: EventItem }) {
  const navigate = useNavigate();
  const toast = useToast();
  const del = useDeleteEvent();
  const [confirming, setConfirming] = useState(false);
  const liveStatus = useLiveStatus();

  const when = formatLong(event.startsAt, event.endsAt);
  const rel = relativeDay(event.startsAt);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [event.location.name, event.location.address].filter(Boolean).join(', '),
  )}`;
  const isOnline = /online/i.test(event.location.name);
  const fillPct = event.capacity ? Math.min(100, Math.round((event.goingCount / event.capacity) * 100)) : 0;

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: event.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast('Link copied');
      }
    } catch {
      /* user dismissed the share sheet */
    }
  };

  const handleDelete = () =>
    del.mutate(event.id, {
      onSuccess: () => {
        toast('Event deleted');
        navigate('/', { replace: true });
      },
      onError: (err) => {
        setConfirming(false);
        toast(err.message, 'error');
      },
    });

  return (
    <article className="detail">
      <Link to="/" className="back-link" onClick={(e) => {
        // Prefer real "back" so the list keeps its filters and scroll position.
        if (window.history.state?.idx > 0) {
          e.preventDefault();
          navigate(-1);
        }
      }}>
        ← All events
      </Link>

      <header className="detail__cover" style={coverStyle(event.category)}>
        <span className="detail__emoji" aria-hidden>
          {CATEGORY_META[event.category].emoji}
        </span>
      </header>

      <div className="detail__grid">
        <div className="detail__head stack-sm">
          <div className="row">
            <CategoryPill category={event.category} />
            {event.isPast && <span className="pill pill--muted">Ended</span>}
            {!event.isPast && rel && <span className="pill pill--accent">{rel}</span>}
          </div>
          <h1 className="detail__title">{event.title}</h1>
          <div className="host">
            <Avatar name={event.hostName} size={36} />
            <span>
              Hosted by <strong>{event.isHost ? 'you' : event.hostName}</strong>
            </span>
          </div>
        </div>

        <div className="detail__main stack-md">
          <ul className="facts">
            <li className="fact">
              <span className="fact__icon" aria-hidden>🗓️</span>
              <span>
                <strong>{when.date}</strong>
                <span className="fact__sub">{when.time}</span>
              </span>
            </li>
            <li className="fact">
              <span className="fact__icon" aria-hidden>{isOnline ? '💻' : '📍'}</span>
              <span>
                <strong>{event.location.name}</strong>
                {event.location.address && <span className="fact__sub">{event.location.address}</span>}
                {!isOnline && (
                  <a className="fact__link" href={mapsUrl} target="_blank" rel="noreferrer">
                    Open in Maps ↗
                  </a>
                )}
              </span>
            </li>
          </ul>

          <section className="stack-sm">
            <h2 className="section-title">About</h2>
            <p className="prose">{event.description}</p>
          </section>

          <section className="stack-sm">
            <h2 className="section-title">
              Who's going <span className="muted">· {event.goingCount}</span>
            </h2>
            {event.goingCount > 0 ? (
              <div className="attendees">
                <AvatarStack names={event.attendeesPreview.map((a) => a.name)} total={event.goingCount} size={36} />
                <p className="muted">
                  {event.attendeesPreview.slice(0, 2).map((a) => a.name).join(', ')}
                  {event.goingCount > 2 && ` and ${event.goingCount - 2} others`}
                  {event.interestedCount > 0 && ` · ${event.interestedCount} interested`}
                </p>
              </div>
            ) : (
              <p className="muted">No one yet — be the first.</p>
            )}
          </section>
        </div>

        <aside className="detail__aside">
          <div className="panel stack-md">
            {!event.isPast && (
              <p className={`live live--${liveStatus}`} aria-live="off">
                <span className="live__dot" aria-hidden />
                {liveStatus === 'live' ? 'Live' : liveStatus === 'connecting' ? 'Reconnecting…' : 'Offline'}
              </p>
            )}
            {event.capacity != null && (
              <div className="capacity">
                <div className="capacity__row">
                  <span>
                    <strong>{event.goingCount}</strong> / {event.capacity} spots
                  </span>
                  <span className={event.spotsLeft === 0 ? 'text-danger' : 'muted'}>
                    {event.spotsLeft === 0
                      ? `Full${event.waitlistCount ? ` · ${event.waitlistCount} waiting` : ''}`
                      : `${event.spotsLeft} left`}
                  </span>
                </div>
                <div className="capacity__bar" role="progressbar" aria-valuenow={fillPct} aria-valuemin={0} aria-valuemax={100} aria-label="Spots filled">
                  <div className="capacity__fill" style={{ width: `${fillPct}%` }} />
                </div>
              </div>
            )}
            <RsvpControl event={event} />
            <div className="panel__footer">
              {!event.isPast && <AddToCalendar event={event} />}
              <button type="button" className="btn btn--ghost btn--sm" onClick={share}>
                Share
              </button>
              {event.isHost && (
                <>
                  <Link to={`/events/${event.id}/edit`} className="btn btn--ghost btn--sm">
                    Edit
                  </Link>
                  <button type="button" className="btn btn--ghost btn--sm text-danger" onClick={() => setConfirming(true)}>
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Delete this event?"
        body={`“${event.title}” will be removed for everyone, including ${Math.max(0, event.goingCount - 1)} people who RSVP'd. This can't be undone.`}
        confirmLabel="Delete event"
        busy={del.isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirming(false)}
      />
    </article>
  );
}

function DetailSkeleton() {
  return (
    <div className="detail" aria-busy>
      <div className="skeleton skeleton--line" style={{ width: 90 }} />
      <div className="detail__cover skeleton" />
      <div className="stack-sm">
        <div className="skeleton skeleton--line skeleton--xl" style={{ width: '70%' }} />
        <div className="skeleton skeleton--line" style={{ width: '40%' }} />
        <div className="skeleton skeleton--line" style={{ width: '55%' }} />
      </div>
    </div>
  );
}
