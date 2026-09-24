import { memo } from 'react';
import { Link } from 'react-router';
import { CATEGORY_META, coverStyle } from '../lib/categories';
import { dateBadge, formatShort, relativeDay } from '../lib/datetime';
import type { EventItem } from '../lib/types';
import { AvatarStack } from './Avatar';

function statusLabel(e: EventItem): { text: string; tone: string } | null {
  if (e.isHost) return { text: 'Hosting', tone: 'host' };
  if (e.myRsvp === 'going') return { text: "You're going", tone: 'going' };
  if (e.myRsvp === 'waitlist') return { text: `Waitlist #${e.waitlistPosition ?? '?'}`, tone: 'waitlist' };
  if (e.myRsvp === 'interested') return { text: 'Interested', tone: 'interested' };
  if (!e.isPast && e.spotsLeft === 0) return { text: 'Full', tone: 'full' };
  return null;
}

/** Memoised: list re-renders (search typing, RSVP patches) only re-render cards whose data changed. */
export const EventCard = memo(function EventCard({ event }: { event: EventItem }) {
  const badge = dateBadge(event.startsAt);
  const rel = relativeDay(event.startsAt);
  const status = statusLabel(event);
  const lowSpots = !event.isPast && event.spotsLeft != null && event.spotsLeft > 0 && event.spotsLeft <= 5;

  return (
    <Link to={`/events/${event.id}`} className={`card${event.isPast ? ' card--past' : ''}`}>
      <div className="card__cover" style={coverStyle(event.category)}>
        <span className="card__emoji" aria-hidden>
          {CATEGORY_META[event.category].emoji}
        </span>
        <span className="date-badge">
          <span className="date-badge__month">{badge.month}</span>
          <span className="date-badge__day">{badge.day}</span>
        </span>
        {status && <span className={`status status--${status.tone}`}>{status.text}</span>}
      </div>
      <div className="card__body">
        <p className="card__when">
          {rel && <strong>{rel} · </strong>}
          {formatShort(event.startsAt)}
        </p>
        <h3 className="card__title">{event.title}</h3>
        <p className="card__where">📍 {event.location.name}</p>
        <div className="card__footer">
          <AvatarStack names={event.attendeesPreview.slice(0, 3).map((a) => a.name)} total={event.goingCount} size={24} />
          <span className="card__count">
            {event.goingCount} going
            {lowSpots && <span className="card__spots"> · {event.spotsLeft} left</span>}
          </span>
        </div>
      </div>
    </Link>
  );
});
