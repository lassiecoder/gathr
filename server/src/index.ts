import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { seedEvents } from './seed.js';
import { EventStore } from './store.js';

const DB_PATH = process.env.DB_PATH ?? fileURLToPath(new URL('../data/db.json', import.meta.url));
const PORT = Number(process.env.PORT ?? 4000);
const args = new Set(process.argv.slice(2));

const store = await EventStore.fromFile(DB_PATH, () => seedEvents(), args.has('--reseed'));

if (args.has('--no-listen')) {
  console.log(`Seeded ${store.all().length} events into ${DB_PATH}`);
} else {
  createApp(store).listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT} (data: ${DB_PATH})`);
  });
}
