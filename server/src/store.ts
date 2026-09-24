import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { EventRecord } from './types.js';

/**
 * Tiny persistence layer: everything lives in memory, and each mutation is flushed to a JSON
 * file with an atomic write (tmp file + rename). Good enough for a single-process demo; the
 * interface is small so it can be swapped for Postgres/SQLite without touching the routes.
 */
export class EventStore {
  private events = new Map<string, EventRecord>();
  private writeChain: Promise<void> = Promise.resolve();

  private constructor(private filePath: string | null) {}

  static inMemory(seed: EventRecord[] = []) {
    const store = new EventStore(null);
    seed.forEach((e) => store.events.set(e.id, structuredClone(e)));
    return store;
  }

  static async fromFile(filePath: string, seed: () => EventRecord[], reseed = false) {
    const store = new EventStore(filePath);
    let records: EventRecord[] | null = null;
    if (!reseed) {
      try {
        records = JSON.parse(await readFile(filePath, 'utf8')).events;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }
    }
    for (const e of records ?? seed()) store.events.set(e.id, e);
    if (!records) await store.flush();
    return store;
  }

  all(): EventRecord[] {
    return [...this.events.values()];
  }

  get(id: string): EventRecord | undefined {
    return this.events.get(id);
  }

  async save(event: EventRecord) {
    this.events.set(event.id, event);
    await this.flush();
  }

  async remove(id: string) {
    const existed = this.events.delete(id);
    if (existed) await this.flush();
    return existed;
  }

  /** Serialises writes so concurrent requests can't interleave partial files. */
  private flush(): Promise<void> {
    const path = this.filePath;
    if (!path) return Promise.resolve();
    const snapshot = JSON.stringify({ events: this.all() }, null, 2);
    this.writeChain = this.writeChain.then(async () => {
      await mkdir(dirname(path), { recursive: true });
      const tmp = `${path}.${process.pid}.tmp`;
      await writeFile(tmp, snapshot);
      await rename(tmp, path);
    });
    return this.writeChain;
  }
}
