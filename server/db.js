import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql');

export const RETENTION_DAYS = 365;

/**
 * Opens (creating if needed) the SQLite database in `dir` and applies the
 * schema. WAL mode and foreign keys are enabled by the schema pragmas.
 */
export function openDatabase(dir = process.env.DB_DIR || path.join(process.cwd(), 'data')) {
  const dbPath = dir === ':memory:' ? dir : path.join(dir, 'sreops.db');
  if (dir !== ':memory:') fs.mkdirSync(dir, { recursive: true });
  const db = new Database(dbPath);
  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  console.log(`[DB] SQLite initialized at: ${dbPath}`);
  return db;
}

/** Enforces 1-year data retention by pruning old snapshots. */
export function pruneOldSnapshots(db, retentionDays = RETENTION_DAYS) {
  const result = db
    .prepare(`DELETE FROM snapshots WHERE created_at < datetime('now', '-' || ? || ' days')`)
    .run(retentionDays);
  if (result.changes > 0) {
    console.log(`[DB] Pruned ${result.changes} snapshots older than ${retentionDays} days.`);
  }
  return result.changes;
}
