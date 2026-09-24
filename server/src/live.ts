import type { RequestHandler } from 'express';
import type { PublicSnapshot } from './types.js';

/**
 * Change feed pushed to browsers over Server-Sent Events.
 *
 * Only viewer-independent data goes on the wire: RSVP messages carry the public counts so
 * clients can patch their caches without refetching, and everything else is a "this id
 * changed" hint. Personal fields (myRsvp, waitlist position) are never broadcast — a client
 * that cares (e.g. it's on the waitlist) refetches its own view.
 *
 * Single-process only; with multiple API instances this would sit behind Redis pub/sub.
 */
export type LiveMessage =
  | { type: 'rsvp'; id: string; snapshot: PublicSnapshot }
  | { type: 'created' | 'updated' | 'deleted'; id: string };

type Listener = (msg: LiveMessage) => void;

export class LiveHub {
  private listeners = new Set<Listener>();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  publish(msg: LiveMessage) {
    this.listeners.forEach((l) => l(msg));
  }

  get size() {
    return this.listeners.size;
  }

  sseHandler(pingMs = 25_000): RequestHandler {
    return (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no', // stop nginx-style proxies from buffering the stream
      });
      res.write('retry: 3000\n\n');

      let seq = 0;
      const unsubscribe = this.subscribe((msg) => res.write(`id: ${++seq}\ndata: ${JSON.stringify(msg)}\n\n`));
      // Comment lines keep idle connections from being closed by proxies/load balancers.
      const ping = setInterval(() => res.write(': ping\n\n'), pingMs);

      req.on('close', () => {
        clearInterval(ping);
        unsubscribe();
      });
    };
  }
}
