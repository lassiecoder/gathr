import type { ReactNode } from 'react';

export function EmptyState({ emoji, title, body, action }: { emoji: string; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="state">
      <div className="state__emoji" aria-hidden>
        {emoji}
      </div>
      <h2 className="state__title">{title}</h2>
      <p className="state__body">{body}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state" role="alert">
      <div className="state__emoji" aria-hidden>
        🫠
      </div>
      <h2 className="state__title">Something went wrong</h2>
      <p className="state__body">{message}</p>
      {onRetry && (
        <button type="button" className="btn btn--secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="card card--skeleton" aria-hidden>
      <div className="card__cover skeleton" />
      <div className="card__body">
        <div className="skeleton skeleton--line" style={{ width: '40%' }} />
        <div className="skeleton skeleton--line skeleton--lg" style={{ width: '85%' }} />
        <div className="skeleton skeleton--line" style={{ width: '60%' }} />
      </div>
    </div>
  );
}
