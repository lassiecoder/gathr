# Gathr — Events module

A full-stack Events module for a consumer platform: browse, view, create/edit, and RSVP to events.

- **Frontend:** React 19 + TypeScript, Vite, React Router, TanStack Query
- **Backend:** Express 5 + TypeScript, Zod validation, JSON-file persistence
- **Tests:** 32 API tests (Vitest + Supertest, including a real SSE connection) and 18 frontend tests (Vitest + Testing Library)
- **No paid services:** live updates, the waitlist and calendar export are all built in

## Run it

Requires Node 20+.

```bash
npm install
npm run dev        # API on :4000, web on http://localhost:5173 (proxies /api)
```

Other scripts:

| Command | What it does |
| --- | --- |
| `npm test` | API + frontend test suites |
| `npm run typecheck` | Strict TS across both packages |
| `npm run build` | Production build of both |
| `npm run seed` | Reset `server/data/db.json` to fresh demo data (dates are relative to today) |

## Deploy (free, on Render)

In production, one Node service runs the API **and** serves the built React app, so there's a single URL and no cross-origin setup.

1. On Render, choose **New → Blueprint** and pick this repo. `render.yaml` configures everything.
2. Every push to `main` redeploys.

To run the production build yourself: `npm run build && npm start` (serves on `PORT`, default 4000).

Free-plan caveats: the service sleeps after ~15 min idle (the first request takes ~30–60s to wake it), and the filesystem is ephemeral, so the data resets to fresh demo events on each restart or deploy. For persistence, swap `EventStore` for Postgres (e.g. Neon's free tier).

## Features

**Browse** (`/`)
- Upcoming / My RSVPs / Hosting / Past tabs, category chips, and debounced full-text search (title, description, venue, host)
- All filters live in the URL, so views can be shared and survive refresh and back navigation
- Paginated with "Load more". The previous results stay on screen while a new filter loads, so the page doesn't flash skeletons
- Skeleton, empty (with copy that matches the tab), no-results and error/retry states

**Detail** (`/events/:id`)
- Renders instantly from the list cache when you click through from the list, then refreshes in the background
- Date/time in the viewer's locale and timezone, a Maps link, attendee avatars, and a capacity bar
- The RSVP panel is a sticky sidebar on desktop and sits right under the title on mobile
- Hosts get Edit/Delete (delete uses a native `<dialog>` confirmation). Share uses the Web Share API, with copy-link as a fallback

**Create / Edit** (`/events/new`, `/events/:id/edit`)
- Fields: title, category, date, start time, optional end time, venue, optional address, description, optional capacity
- Errors show on blur, then all at once on submit, and focus moves to the first invalid field
- An end time earlier than the start is treated as "ends the next day" (e.g. 21:00 → 01:00), with a hint shown
- Server validation errors are mapped back onto the matching inputs
- Warns you before leaving with unsaved changes, both for in-app navigation and for closing the tab

**RSVP**
- Going / Interested / remove, with **optimistic updates** that roll back on failure
- A `409` response (event full or ended since the page loaded) shows a toast and re-syncs from the server
- The update is written into every cached list page, so cards update without a refetch

**Waitlist**
- On a full event, "I'm going" becomes **Join waitlist**. People are queued first-come, first-served and see their place ("You're 3rd in line")
- When someone going cancels or drops to "Interested", the **first person in line is promoted automatically**. When the host raises or removes the capacity, as many people as fit are let in
- Joining the waitlist when a spot is free just makes you going. Re-sending your current status never costs you your place
- The rules live in pure functions (`server/src/rsvp.ts`), with their own test suite

**Live updates** (Server-Sent Events, no third-party service)
- Every viewer's counts, spots left, capacity bar and cards update the moment anyone RSVPs, with a "● Live" indicator on the detail page
- If you're on the waitlist and get promoted, your page flips to "You're going" with a toast, with no refresh needed
- **Privacy by design:** only viewer-independent numbers are broadcast. Personal fields (your RSVP, your place in line) are never sent to everyone; a waitlisted client fetches its own view when the counts change
- After a dropped connection, the page refetches to catch anything it missed

**Add to calendar**
- Google Calendar and Outlook.com links, plus a standards-compliant `.ics` download for Apple Calendar and others
- The `.ics` file follows the calendar standard (RFC 5545): special characters are escaped, long lines are wrapped without splitting emoji, and times are in UTC
- Events without an end time default to 2 hours

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/events?when=upcoming\|past\|all&q=&category=&mine=going\|hosting&limit=&offset=` | `{ items, total, nextOffset }` |
| GET | `/api/events/:id` | 404 if missing |
| POST | `/api/events` | 201. The host is auto-RSVP'd as going |
| PUT | `/api/events/:id` | Host only (403). Capacity can't drop below the current going count |
| DELETE | `/api/events/:id` | Host only, 204 |
| PUT | `/api/events/:id/rsvp` | `{ status: "going" \| "interested" }`. 409 `EVENT_FULL` / `EVENT_ENDED` / `HOST_RSVP` |
| PUT | `/api/events/:id/rsvp` | `{ status: "waitlist" }` queues you on a full event (or makes you going if a spot is free) |
| DELETE | `/api/events/:id/rsvp` | Removes your RSVP. Frees a spot for the waitlist if you were going |
| GET | `/api/events/:id/ics` | Calendar file download |
| GET | `/api/stream` | SSE change feed: `rsvp` (public counts), `created` / `updated` / `deleted` (id only) |

Errors always have the shape `{ error: { code, message, fieldErrors? } }`. Validation failures return 422 with field paths such as `location.name`.

Responses are **personalised DTOs** (`myRsvp`, `isHost`, `spotsLeft`, `isPast`, `attendeesPreview`). The raw RSVP map, which holds user ids, is never sent to clients.

## Decisions & trade-offs

- **Identity.** There is no auth in scope, so the client creates a stable guest id and an editable display name in `localStorage` and sends them as `x-user-id` / `x-user-name` headers. Everything goes through one middleware (`server/src/identity.ts`), so switching to real sessions or JWTs changes only that file.
- **Persistence.** The data lives in an in-memory map that is flushed to `server/data/db.json` with serialized, atomic writes (write to a temp file, then rename). The store interface is small, so it can be swapped for Postgres or SQLite without touching the routes.
- **Server state vs. UI state.** TanStack Query owns everything that comes from the server, through a query-key factory in `web/src/hooks/events.ts`. URL params own filter state. Nothing needs a global store.
- **Time.** The API only speaks ISO-8601. The form converts local date + time inputs once, on submit (`web/src/lib/eventForm.ts`), and display always uses `Intl` in the viewer's locale.
- **Validation lives in two places on purpose.** The client validates for instant feedback and the server is the source of truth. Both use the same field names, so server errors map onto the right inputs.
- **Live updates use SSE rather than WebSockets.** Updates only flow from server to browser, so SSE is enough: it works over plain HTTP, reconnects automatically, and needs no extra library. The hub is in-process; with several API instances it would sit behind Redis pub/sub.
- **Types are duplicated** between `server/src/types.ts` and `web/src/lib/types.ts`. In a larger codebase I'd use a shared workspace package or generate them from OpenAPI or Zod.

## Porting to React Native

The layers are split so that most of the code carries over to mobile unchanged:

- **Moves over unchanged:** `lib/api.ts`, `lib/eventForm.ts` (validation, time resolution, payload building), `lib/datetime.ts`, and `hooks/events.ts` (queries, optimistic RSVP). None of them touch the DOM.
- **Rewritten per platform:** the components, and `identity.ts`'s storage (AsyncStorage or SecureStore instead of `localStorage`).
- **Mobile performance:** cards are `memo`'d, and RSVP patches replace only the changed item, so a `FlashList` would re-render just one row. On mobile, list pagination maps directly to `onEndReached`.

## What I'd do next

- Real auth, plus a proper attendee list endpoint (paginated)
- Cover image upload and recurring events
- Reminders, and notifying promoted waitlisters who aren't online (email or push)
- Syncing your own RSVP across your other open tabs (counts already sync; your personal status refreshes on reload)
- E2E tests (Playwright) and a CI pipeline

## Structure

```
server/src
  app.ts              express app factory (injectable store + clock for tests)
  routes/events.ts    all event + RSVP endpoints
  rsvp.ts             RSVP + waitlist rules (pure functions)
  live.ts             SSE change feed
  ics.ts              RFC 5545 calendar export
  schemas.ts          zod input schemas
  serialize.ts        record → personalised DTO
  store.ts            JSON-file store with atomic writes
  identity.ts         guest identity middleware
  seed.ts             demo data relative to "now"
web/src
  pages/              EventsPage, EventDetailPage, EventFormPage (create + edit)
  components/         EventCard, EventForm, RsvpControl, Toast, ConfirmDialog, …
  hooks/events.ts     TanStack Query hooks + optimistic RSVP
  hooks/useLiveUpdates.ts  applies the SSE feed to the query cache
  lib/                api client, types, form logic, date helpers, identity
```
