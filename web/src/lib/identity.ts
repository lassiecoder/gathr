import { useSyncExternalStore } from 'react';

/**
 * Guest identity until real auth exists: a stable random id + a display name, persisted in
 * localStorage and sent to the API as headers. Exposed as a tiny external store so the header
 * re-renders when the name changes.
 */
export interface Identity {
  id: string;
  name: string;
}

const KEY = 'gathr.identity';
const ADJECTIVES = ['Curious', 'Sunny', 'Brave', 'Chill', 'Witty', 'Cosmic', 'Gentle', 'Lucky'];
const ANIMALS = ['Otter', 'Falcon', 'Panda', 'Fox', 'Koala', 'Heron', 'Lynx', 'Dolphin'];
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]!;

const listeners = new Set<() => void>();
let current: Identity | null = null;

function load(): Identity {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (parsed?.id && parsed?.name) return parsed;
  } catch {
    /* storage unavailable or corrupt — fall through to a fresh identity */
  }
  const fresh = { id: crypto.randomUUID(), name: `${pick(ADJECTIVES)} ${pick(ANIMALS)}` };
  persist(fresh);
  return fresh;
}

function persist(identity: Identity) {
  try {
    localStorage.setItem(KEY, JSON.stringify(identity));
  } catch {
    /* private mode etc. — identity lives for this session only */
  }
}

export function getIdentity(): Identity {
  return (current ??= load());
}

export function setDisplayName(name: string) {
  const trimmed = name.trim().slice(0, 40);
  if (!trimmed) return;
  current = { ...getIdentity(), name: trimmed };
  persist(current);
  listeners.forEach((l) => l());
}

export function useIdentity(): Identity {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getIdentity,
  );
}
