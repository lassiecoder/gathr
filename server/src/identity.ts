import type { RequestHandler } from 'express';
import { HttpError } from './errors.js';
import type { User } from './types.js';

const ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;

/**
 * Stand-in for real auth: the client sends a stable guest id + display name as headers.
 * Swapping this for a session/JWT middleware that sets `res.locals.user` is the only change
 * the routes would need.
 */
export const identify: RequestHandler = (req, res, next) => {
  const id = req.header('x-user-id');
  if (id && ID_PATTERN.test(id)) {
    let name = 'Guest';
    try {
      name = decodeURIComponent(req.header('x-user-name') ?? '').trim().slice(0, 40) || 'Guest';
    } catch {
      /* malformed encoding — keep default */
    }
    res.locals.user = { id, name } satisfies User;
  }
  next();
};

export const requireUser: RequestHandler = (_req, res, next) => {
  if (!res.locals.user) throw new HttpError(401, 'UNAUTHENTICATED', 'Missing or invalid x-user-id header');
  next();
};

export const currentUser = (locals: Record<string, unknown>) => locals.user as User | undefined;
