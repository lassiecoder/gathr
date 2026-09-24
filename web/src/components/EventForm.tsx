import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { ApiError } from '../lib/api';
import { CATEGORY_META } from '../lib/categories';
import { todayInput } from '../lib/datetime';
import {
  mapServerErrors,
  resolveTimes,
  toInput,
  validate,
  type EventFormErrors,
  type EventFormValues,
} from '../lib/eventForm';
import { CATEGORIES, type EventInput } from '../lib/types';

interface Props {
  initialValues: EventFormValues;
  /** Present when editing; lets validation allow an unchanged start that is now in the past. */
  originalStartsAt?: string;
  submitLabel: string;
  onSubmit: (input: EventInput) => Promise<unknown>;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function EventForm({ initialValues, originalStartsAt, submitLabel, onSubmit, onCancel, onDirtyChange }: Props) {
  const [values, setValues] = useState(initialValues);
  const [touched, setTouched] = useState<Partial<Record<keyof EventFormValues, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<EventFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const clientErrors = validate(values, { originalStartsAt });
  const visibleError = (f: keyof EventFormValues) => serverErrors[f] ?? ((touched[f] || submitted) ? clientErrors[f] : undefined);
  const { endsNextDay } = resolveTimes(values);

  const update = <K extends keyof EventFormValues>(field: K, value: EventFormValues[K]) => {
    setValues((v) => {
      const next = { ...v, [field]: value };
      onDirtyChange?.(JSON.stringify(next) !== JSON.stringify(initialValues));
      return next;
    });
    setServerErrors(({ [field]: _cleared, ...rest }) => rest as EventFormErrors);
  };
  const blur = (f: keyof EventFormValues) => () => setTouched((t) => ({ ...t, [f]: true }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    setFormError(null);
    if (Object.keys(clientErrors).length) {
      focusFirstError(clientErrors);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(toInput(values));
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
        const mapped = mapServerErrors(err.fieldErrors);
        setServerErrors(mapped);
        focusFirstError(mapped);
      }
      setFormError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <Field label="Title" name="title" error={visibleError('title')} counter={`${values.title.length}/100`}>
        {(props) => (
          <input
            {...props}
            value={values.title}
            onChange={(e) => update('title', e.target.value)}
            onBlur={blur('title')}
            placeholder="e.g. Sunday Sunrise Run"
            maxLength={100}
            autoComplete="off"
          />
        )}
      </Field>

      <fieldset className="field">
        <legend className="field__label">Category</legend>
        <div className="chips chips--wrap" role="radiogroup" aria-label="Category" id="field-category">
          {CATEGORIES.map((c) => (
            <label key={c} className={`chip${values.category === c ? ' chip--active' : ''}`}>
              <input
                type="radio"
                name="category"
                value={c}
                checked={values.category === c}
                onChange={() => update('category', c)}
                className="visually-hidden"
              />
              <span aria-hidden>{CATEGORY_META[c].emoji}</span> {CATEGORY_META[c].label}
            </label>
          ))}
        </div>
        {visibleError('category') && <p className="field__error">{visibleError('category')}</p>}
      </fieldset>

      <div className="form__row form__row--3">
        <Field label="Date" name="date" error={visibleError('date')}>
          {(props) => (
            <input
              {...props}
              type="date"
              min={originalStartsAt ? undefined : todayInput()}
              value={values.date}
              onChange={(e) => update('date', e.target.value)}
              onBlur={blur('date')}
            />
          )}
        </Field>
        <Field label="Start time" name="startTime" error={visibleError('startTime')}>
          {(props) => (
            <input
              {...props}
              type="time"
              value={values.startTime}
              onChange={(e) => update('startTime', e.target.value)}
              onBlur={blur('startTime')}
            />
          )}
        </Field>
        <Field
          label="End time"
          optional
          name="endTime"
          error={visibleError('endTime')}
          hint={endsNextDay ? 'Ends the next day' : undefined}
        >
          {(props) => (
            <input
              {...props}
              type="time"
              value={values.endTime}
              onChange={(e) => update('endTime', e.target.value)}
              onBlur={blur('endTime')}
            />
          )}
        </Field>
      </div>

      <div className="form__row">
        <Field label="Location" name="locationName" error={visibleError('locationName')}>
          {(props) => (
            <input
              {...props}
              value={values.locationName}
              onChange={(e) => update('locationName', e.target.value)}
              onBlur={blur('locationName')}
              placeholder="Venue or place name"
              maxLength={120}
            />
          )}
        </Field>
        <Field label="Address" optional name="address" error={visibleError('address')}>
          {(props) => (
            <input
              {...props}
              value={values.address}
              onChange={(e) => update('address', e.target.value)}
              placeholder="Street, area or 'Online'"
              maxLength={200}
            />
          )}
        </Field>
      </div>

      <Field
        label="Description"
        name="description"
        error={visibleError('description')}
        counter={`${values.description.length}/2000`}
      >
        {(props) => (
          <textarea
            {...props}
            rows={6}
            value={values.description}
            onChange={(e) => update('description', e.target.value)}
            onBlur={blur('description')}
            placeholder="What should people expect? What should they bring?"
            maxLength={2000}
          />
        )}
      </Field>

      <Field
        label="Capacity"
        optional
        name="capacity"
        error={visibleError('capacity')}
        hint="Leave empty for unlimited spots"
        narrow
      >
        {(props) => (
          <input
            {...props}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={values.capacity}
            onChange={(e) => update('capacity', e.target.value)}
            onBlur={blur('capacity')}
            placeholder="Unlimited"
          />
        )}
      </Field>

      {formError && (
        <p className="form__error" role="alert">
          {formError}
        </p>
      )}

      <div className="form__actions">
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}

function focusFirstError(errors: EventFormErrors) {
  const order: (keyof EventFormValues)[] = [
    'title', 'category', 'date', 'startTime', 'endTime', 'locationName', 'address', 'description', 'capacity',
  ];
  const first = order.find((f) => errors[f]);
  if (!first) return;
  const el = document.getElementById(`field-${first}`);
  el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  (el?.querySelector('input') ?? el)?.focus({ preventScroll: true });
}

interface FieldProps {
  label: string;
  name: keyof EventFormValues;
  error?: string;
  hint?: string;
  counter?: string;
  optional?: boolean;
  narrow?: boolean;
  children: (props: { id: string; name: string; 'aria-invalid': boolean; 'aria-describedby'?: string; className: string }) => ReactNode;
}

function Field({ label, name, error, hint, counter, optional, narrow, children }: FieldProps) {
  const msgId = useId();
  const id = `field-${name}`;
  return (
    <div className={`field${narrow ? ' field--narrow' : ''}`}>
      <div className="field__top">
        <label htmlFor={id} className="field__label">
          {label} {optional && <span className="field__optional">optional</span>}
        </label>
        {counter && <span className="field__counter">{counter}</span>}
      </div>
      {children({
        id,
        name,
        'aria-invalid': Boolean(error),
        'aria-describedby': error || hint ? msgId : undefined,
        className: 'input',
      })}
      {error ? (
        <p id={msgId} className="field__error">
          {error}
        </p>
      ) : (
        hint && (
          <p id={msgId} className="field__hint">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
