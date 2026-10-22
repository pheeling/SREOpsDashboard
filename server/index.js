import path from 'node:path';
import express from 'express';
import { createApp, captureScheduledSnapshot } from './app.js';
import { openDatabase, pruneOldSnapshots } from './db.js';
import { initAutoRestoreScheduler } from './services/autoRestore.js';

const PORT = Number(process.env.PORT) || 3000;
const HOUR_MS = 60 * 60 * 1000;

const db = openDatabase();
const app = createApp(db);

const distDir = path.join(process.cwd(), 'dist');
app.use(express.static(distDir));
app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));

function runMaintenance() {
  try {
    pruneOldSnapshots(db);
    captureScheduledSnapshot(db);
  } catch (error) {
    console.error('[DB] Maintenance failed', error);
  }
}

initAutoRestoreScheduler(db);

runMaintenance();
setInterval(runMaintenance, 24 * HOUR_MS).unref();

app.listen(PORT, () => console.log(`[Server] Listening on port ${PORT}`));
