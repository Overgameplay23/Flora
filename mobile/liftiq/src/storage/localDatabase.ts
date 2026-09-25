import * as SQLite from 'expo-sqlite';

import type { AppState } from '@/types/models';
import { generateId } from '@/utils/ids';

const APP_SNAPSHOT_KEY = 'app_snapshot';

export interface PendingMutation {
  id: string;
  type: string;
  payload: string;
  createdAt: string;
  status: 'pending' | 'failed' | 'synced';
}

export async function initLocalDatabase(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS local_state (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pending_mutations (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
    );
  `);
}

export async function loadSnapshot(db: SQLite.SQLiteDatabase): Promise<AppState | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM local_state WHERE key = ?', APP_SNAPSHOT_KEY);
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as AppState;
  } catch {
    return null;
  }
}

export async function saveSnapshot(db: SQLite.SQLiteDatabase, state: AppState) {
  const payload = JSON.stringify(state);
  await db.runAsync(
    `INSERT INTO local_state (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    APP_SNAPSHOT_KEY,
    payload,
    new Date().toISOString(),
  );
}

export async function enqueueMutation(db: SQLite.SQLiteDatabase, type: string, payload: unknown) {
  await db.runAsync(
    'INSERT INTO pending_mutations (id, type, payload, created_at, status) VALUES (?, ?, ?, ?, ?)',
    generateId('mutation'),
    type,
    JSON.stringify(payload),
    new Date().toISOString(),
    'pending',
  );
}

export async function countPendingMutations(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM pending_mutations WHERE status = ?', 'pending');
  return Number(row?.count ?? 0);
}

export async function listPendingMutations(db: SQLite.SQLiteDatabase) {
  return db.getAllAsync<PendingMutation>('SELECT id, type, payload, created_at as createdAt, status FROM pending_mutations ORDER BY created_at DESC');
}
