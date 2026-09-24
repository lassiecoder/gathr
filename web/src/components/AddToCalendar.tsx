import { useEffect, useRef } from 'react';
import { API_BASE } from '../lib/api';
import { googleCalendarUrl, outlookCalendarUrl } from '../lib/calendar';
import type { EventItem } from '../lib/types';

/** Disclosure menu built on <details> so it works with keyboard and screen readers for free. */
export function AddToCalendar({ event }: { event: EventItem }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pageUrl = `${window.location.origin}/events/${event.id}`;
  const close = () => ref.current?.removeAttribute('open');

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && ref.current?.open) {
        close();
        ref.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <details ref={ref} className="menu">
      <summary className="btn btn--ghost btn--sm">Add to calendar</summary>
      <div className="menu__list" role="menu">
        <a role="menuitem" className="menu__item" href={googleCalendarUrl(event, pageUrl)} target="_blank" rel="noreferrer" onClick={close}>
          <span aria-hidden>📅</span> Google Calendar
        </a>
        <a role="menuitem" className="menu__item" href={outlookCalendarUrl(event, pageUrl)} target="_blank" rel="noreferrer" onClick={close}>
          <span aria-hidden>📨</span> Outlook.com
        </a>
        <a role="menuitem" className="menu__item" href={`${API_BASE}/events/${event.id}/ics`} download onClick={close}>
          <span aria-hidden>⬇️</span> Apple / other (.ics)
        </a>
      </div>
    </details>
  );
}
