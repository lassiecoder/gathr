import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { EmptyState } from '../components/States';

export function NotFoundPage() {
  return (
    <EmptyState
      emoji="🧭"
      title="Page not found"
      body="That page doesn't exist."
      action={<Link to="/" className="btn btn--primary">Browse events</Link>}
    />
  );
}

/** Route-level error boundary: a render crash shows this instead of a blank screen. */
export function RouteErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unknown error';
  return (
    <div className="page">
      <EmptyState
        emoji="🫠"
        title="Something broke"
        body={message}
        action={<a href="/" className="btn btn--primary">Reload</a>}
      />
    </div>
  );
}
