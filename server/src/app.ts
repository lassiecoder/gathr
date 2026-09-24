import { existsSync } from 'node:fs';
import { join } from 'node:path';
import cors from 'cors';
import express from 'express';
import { errorHandler, HttpError } from './errors.js';
import { identify } from './identity.js';
import { LiveHub } from './live.js';
import { CATEGORIES } from './schemas.js';
import { eventsRouter } from './routes/events.js';
import type { EventStore } from './store.js';

interface AppOptions {
  now?: () => number;
  live?: LiveHub;
  /** Public web origin for links in calendar files. Defaults to the request's own origin. */
  webOrigin?: string;
  /** Built frontend to serve (production single-service deploy). */
  staticDir?: string;
}

export function createApp(store: EventStore, opts: AppOptions = {}) {
  const live = opts.live ?? new LiveHub();
  const app = express();
  app.disable('x-powered-by');
  // Behind Render's (or any) proxy, trust X-Forwarded-* so req.protocol reports https.
  app.set('trust proxy', 1);
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));
  app.use(identify);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/api/categories', (_req, res) => {
    res.json(CATEGORIES);
  });
  app.get('/api/stream', live.sseHandler());
  app.use(
    '/api/events',
    eventsRouter({
      store,
      live,
      now: opts.now ?? Date.now,
      webOrigin: opts.webOrigin ?? process.env.WEB_ORIGIN,
    }),
  );

  app.use('/api', () => {
    throw new HttpError(404, 'NOT_FOUND', 'Route not found');
  });

  if (opts.staticDir && existsSync(opts.staticDir)) {
    const dir = opts.staticDir;
    // Vite fingerprints everything in /assets, so it can be cached forever.
    app.use('/assets', express.static(join(dir, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }));
    app.use(express.static(dir, { index: false }));
    // Client-side routes (/events/:id, …) all boot the SPA.
    app.get('/{*splat}', (_req, res) => {
      res.set('Cache-Control', 'no-cache').sendFile(join(dir, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
