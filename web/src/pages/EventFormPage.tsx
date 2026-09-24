import { useEffect, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router';
import { EventForm } from '../components/EventForm';
import { EmptyState, ErrorState } from '../components/States';
import { useToast } from '../components/Toast';
import { useEvent, useSaveEvent } from '../hooks/events';
import { emptyValues, valuesFromEvent, type EventFormValues } from '../lib/eventForm';
import type { EventInput } from '../lib/types';

export function CreateEventPage() {
  return (
    <FormShell title="Create an event" subtitle="It takes about a minute. You can edit everything later.">
      <SaveableForm initialValues={emptyValues} submitLabel="Publish event" />
    </FormShell>
  );
}

export function EditEventPage() {
  const { id = '' } = useParams();
  const { data: event, error, isPending, refetch } = useEvent(id);

  if (isPending) return <FormShell title="Edit event"><p className="muted">Loading…</p></FormShell>;
  if (error) return <ErrorState message={error.message} onRetry={() => refetch()} />;
  if (!event.isHost) {
    return (
      <EmptyState
        emoji="🔒"
        title="Only the host can edit this event"
        body={`${event.hostName} is hosting “${event.title}”.`}
        action={<Link to={`/events/${event.id}`} className="btn btn--secondary">Back to event</Link>}
      />
    );
  }
  return (
    <FormShell title="Edit event" subtitle={event.title}>
      <SaveableForm
        key={event.id}
        eventId={event.id}
        initialValues={valuesFromEvent(event)}
        originalStartsAt={event.startsAt}
        submitLabel="Save changes"
      />
    </FormShell>
  );
}

function FormShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="form-page">
      <header className="stack-xs">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </header>
      <div className="panel">{children}</div>
    </div>
  );
}

interface SaveableFormProps {
  eventId?: string;
  initialValues: EventFormValues;
  originalStartsAt?: string;
  submitLabel: string;
}

function SaveableForm({ eventId, initialValues, originalStartsAt, submitLabel }: SaveableFormProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const save = useSaveEvent(eventId);
  const [dirty, setDirty] = useState(false);
  const savedRef = useRef(false);

  useUnsavedChangesGuard(dirty, savedRef);

  const onSubmit = async (input: EventInput) => {
    const event = await save.mutateAsync(input);
    savedRef.current = true;
    toast(eventId ? 'Changes saved' : 'Event published 🎉');
    navigate(`/events/${event.id}`, { replace: true });
  };

  return (
    <EventForm
      initialValues={initialValues}
      originalStartsAt={originalStartsAt}
      submitLabel={submitLabel}
      onSubmit={onSubmit}
      onCancel={() => navigate(eventId ? `/events/${eventId}` : '/')}
      onDirtyChange={setDirty}
    />
  );
}

/** Warns before losing edits — both for in-app navigation and tab close/refresh. */
function useUnsavedChangesGuard(dirty: boolean, savedRef: React.RefObject<boolean>) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    dirty && !savedRef.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm('You have unsaved changes. Leave without saving?')) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
}
