import type { SQLiteDatabase } from "expo-sqlite";

// Каждая миграция — одна ступень схемы. Не редактируй уже выпущенную миграцию —
// добавляй новую в конец массива. PRAGMA user_version хранит номер последней
// применённой ступени, миграции применяются последовательно от текущего значения.
const migrations: string[] = [
  `
  CREATE TABLE IF NOT EXISTS types (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    care TEXT NOT NULL,
    max_temp INTEGER NOT NULL,
    want_temp INTEGER NOT NULL,
    kg REAL NOT NULL,
    dryer INTEGER NOT NULL,
    owned INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS hamper (
    type_id TEXT PRIMARY KEY NOT NULL,
    pieces INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS adds (
    id TEXT PRIMARY KEY NOT NULL,
    day TEXT NOT NULL,
    type_id TEXT NOT NULL,
    pieces INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS washes (
    id TEXT PRIMARY KEY NOT NULL,
    day TEXT NOT NULL,
    entries TEXT NOT NULL,
    temp INTEGER NOT NULL,
    kg REAL NOT NULL,
    ran INTEGER
  );
  CREATE TABLE IF NOT EXISTS model (
    key TEXT PRIMARY KEY NOT NULL,
    json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
  const currentVersion = row?.user_version ?? 0;

  for (let i = currentVersion; i < migrations.length; i++) {
    await db.execAsync(migrations[i]);
    await db.execAsync(`PRAGMA user_version = ${i + 1};`);
  }
}
