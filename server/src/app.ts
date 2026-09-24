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
  webOrigin?: string;
}

export function createApp(store: EventStore, opts: AppOptions = {}) {
  const live = opts.live ?? new LiveHub();
  const app = express();
  app.disable('x-powered-by');
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
      webOrigin: opts.webOrigin ?? process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    }),
  );

  app.use('/api', () => {
    throw new HttpError(404, 'NOT_FOUND', 'Route not found');
  });
  app.use(errorHandler);
  return app;
}
