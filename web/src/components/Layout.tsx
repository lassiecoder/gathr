import { useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, ScrollRestoration } from 'react-router';
import { useLiveUpdates } from '../hooks/useLiveUpdates';
import { setDisplayName, useIdentity } from '../lib/identity';
import { Avatar } from './Avatar';

export function Layout() {
  useLiveUpdates();
  return (
    <>
      <header className="topbar">
        <div className="topbar__inner">
          <Link to="/" className="logo" aria-label="Gathr home">
            <img src="/favicon.svg" alt="" width={28} height={28} />
            <span>gathr</span>
          </Link>
          <nav className="topbar__nav">
            <NavLink to="/events/new" className="btn btn--primary btn--sm">
              <span aria-hidden>＋</span> <span className="hide-sm">Create event</span>
              <span className="show-sm">New</span>
            </NavLink>
            <IdentityChip />
          </nav>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
      <ScrollRestoration />
    </>
  );
}

function IdentityChip() {
  const { name } = useIdentity();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  const save = (e: FormEvent) => {
    e.preventDefault();
    setDisplayName(draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <form className="identity identity--editing" onSubmit={save}>
        <input
          className="input input--sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={40}
          aria-label="Your display name"
          autoFocus
          onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
        />
        <button className="btn btn--secondary btn--sm" type="submit">
          Save
        </button>
      </form>
    );
  }

  return (
    <button
      type="button"
      className="identity"
      onClick={() => {
        setDraft(name);
        setEditing(true);
      }}
      title="Change your display name"
    >
      <Avatar name={name} size={28} />
      <span className="identity__name hide-sm">{name}</span>
    </button>
  );
}
