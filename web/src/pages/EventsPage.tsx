import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CardSkeleton, EmptyState, ErrorState } from '../components/States';
import { EventCard } from '../components/EventCard';
import { useEventList } from '../hooks/events';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { CATEGORY_META } from '../lib/categories';
import { CATEGORIES, type Category, type EventFilters } from '../lib/types';

const TABS = [
  { id: 'upcoming', label: 'Upcoming', filters: { when: 'upcoming' } },
  { id: 'going', label: 'My RSVPs', filters: { when: 'upcoming', mine: 'going' } },
  { id: 'hosting', label: 'Hosting', filters: { when: 'upcoming', mine: 'hosting' } },
  { id: 'past', label: 'Past', filters: { when: 'past' } },
] as const satisfies readonly { id: string; label: string; filters: EventFilters }[];

type TabId = (typeof TABS)[number]['id'];

const EMPTY_COPY: Record<TabId, { emoji: string; title: string; body: string }> = {
  upcoming: { emoji: '🗓️', title: 'Nothing on the calendar yet', body: 'Be the first to put something together.' },
  going: { emoji: '🎟️', title: 'No RSVPs yet', body: 'Find something fun and tap “I’m going”.' },
  hosting: { emoji: '🎤', title: "You're not hosting anything", body: 'Got an idea? It takes about a minute to set up.' },
  past: { emoji: '🕰️', title: 'No past events', body: 'Events show up here once they wrap up.' },
};

export function EventsPage() {
  // Filters live in the URL so views are shareable and survive refresh/back navigation.
  const [params, setParams] = useSearchParams();
  const tab: TabId = TABS.some((t) => t.id === params.get('tab')) ? (params.get('tab') as TabId) : 'upcoming';
  const categoryParam = params.get('category');
  const category = CATEGORIES.includes(categoryParam as Category) ? (categoryParam as Category) : undefined;

  const [search, setSearch] = useState(params.get('q') ?? '');
  const q = useDebouncedValue(search.trim(), 250);

  const setParam = (key: string, value: string | undefined) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );

  useEffect(() => {
    if ((params.get('q') ?? '') !== q) setParam('q', q || undefined);
  }, [q]);

  const filters = useMemo<EventFilters>(
    () => ({ ...TABS.find((t) => t.id === tab)!.filters, category, q: q || undefined }),
    [tab, category, q],
  );

  const query = useEventList(filters);
  const events = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const total = query.data?.pages[0]?.total ?? 0;
  const hasFilters = Boolean(q || category);

  return (
    <div className="stack-lg">
      <section className="hero">
        <h1 className="hero__title">
          Find your people.
          <br />
          <span className="hero__accent">Go do something.</span>
        </h1>
        <label className="search">
          <span className="search__icon" aria-hidden>
            🔍
          </span>
          <input
            type="search"
            className="search__input"
            placeholder="Search events, places, hosts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search events"
          />
        </label>
      </section>

      <div className="toolbar">
        <div className="tabs" role="tablist" aria-label="Event views">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`tab${tab === t.id ? ' tab--active' : ''}`}
              onClick={() => setParam('tab', t.id === 'upcoming' ? undefined : t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="chips chips--scroll" aria-label="Filter by category">
          <button
            type="button"
            className={`chip${!category ? ' chip--active' : ''}`}
            onClick={() => setParam('category', undefined)}
            aria-pressed={!category}
          >
            All
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`chip${category === c ? ' chip--active' : ''}`}
              onClick={() => setParam('category', category === c ? undefined : c)}
              aria-pressed={category === c}
            >
              <span aria-hidden>{CATEGORY_META[c].emoji}</span> {CATEGORY_META[c].label}
            </button>
          ))}
        </div>
      </div>

      {query.isPending ? (
        <div className="grid">
          {Array.from({ length: 6 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : query.isError && !events.length ? (
        <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
      ) : events.length === 0 ? (
        hasFilters ? (
          <EmptyState
            emoji="🔎"
            title="No matches"
            body="Try a different search or clear the filters."
            action={
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => {
                  setSearch('');
                  setParams(tab === 'upcoming' ? {} : { tab }, { replace: true });
                }}
              >
                Clear filters
              </button>
            }
          />
        ) : (
          <EmptyState
            {...EMPTY_COPY[tab]}
            action={
              tab !== 'past' && (
                <Link to="/events/new" className="btn btn--primary">
                  Create an event
                </Link>
              )
            }
          />
        )
      ) : (
        <>
          <p className="result-count" aria-live="polite">
            {total} {total === 1 ? 'event' : 'events'}
            {query.isFetching && !query.isFetchingNextPage && <span className="spinner" aria-label="Updating" />}
          </p>
          <div className={`grid${query.isPlaceholderData ? ' grid--stale' : ''}`}>
            {events.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
          {query.hasNextPage && (
            <div className="center">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              >
                {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
