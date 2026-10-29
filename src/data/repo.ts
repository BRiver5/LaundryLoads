// Слой данных поверх expo-sqlite. Все функции — через один мьютекс (цепочка
// промисов), иначе параллельные транзакции expo-sqlite отклоняются.

import { getDb } from "../db/client";
import { generateId } from "../lib/id";
import { MODEL_VERSION, observeLoad, type BleedModel, type ColorGroup } from "../lib/laundry";
import { observeDay, type Rate } from "../lib/schedule";

export type TypeRow = { id: string; name: string; color: ColorGroup; care: "normal" | "delicate"; max_temp: number; want_temp: number; kg: number; dryer: number; owned: number };
export type HamperRow = { type_id: string; pieces: number };
export type AddRow = { id: string; day: string; type_id: string; pieces: number };
export type WashRow = { id: string; day: string; entries: string; temp: number; kg: number; ran: number | null };
export type Settings = { capKg: number; loadsPerDay: number; rackKg: number; dryer: boolean; haptics: boolean };
export const DEFAULT_SETTINGS: Settings = { capKg: 7, loadsPerDay: 1, rackKg: 5, dryer: false, haptics: true };

let chain: Promise<unknown> = Promise.resolve();
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => {});
  return next;
}

async function put(key: string, v: unknown) {
  const db = await getDb();
  await db.runAsync("INSERT OR REPLACE INTO model (key, json) VALUES (?, ?);", [key, JSON.stringify(v)]);
}

async function get<T>(key: string, fallback: T): Promise<T> {
  const db = await getDb();
  const r = await db.getFirstAsync<{ json: string }>("SELECT json FROM model WHERE key = ?;", [key]);
  return r ? (JSON.parse(r.json) as T) : fallback;
}

function colorsOf(entries: string, types: TypeRow[]): ColorGroup[] {
  const ids: { id: string }[] = JSON.parse(entries);
  return ids.map((e) => types.find((t) => t.id === e.id)?.color).filter(Boolean) as ColorGroup[];
}

// Полная пересборка обеих моделей из журналов: темп по закрытым дням, прокрас по отчётам стирок.
async function rebuild(today: string) {
  const db = await getDb();
  const types = await db.getAllAsync<TypeRow>("SELECT * FROM types;");
  const adds = await db.getAllAsync<AddRow>("SELECT * FROM adds ORDER BY day ASC;");
  const washes = await db.getAllAsync<WashRow>("SELECT * FROM washes WHERE ran IS NOT NULL ORDER BY day ASC, rowid ASC;");
  let bleed: BleedModel = {};
  for (const w of washes) bleed = observeLoad(bleed, colorsOf(w.entries, types), w.ran === 1);
  const rates: Record<string, Rate> = {};
  const days = [...new Set(adds.map((a) => a.day))].filter((d) => d < today).sort();
  for (const d of days) for (const t of types) rates[t.id] = observeDay(rates[t.id], adds.filter((a) => a.day === d && a.type_id === t.id).reduce((s, a) => s + a.pieces, 0));
  await put("bleed", bleed);
  await put("rates", rates);
  await put("rateDay", days[days.length - 1] ?? null);
}

export function loadAll(today: string) {
  return locked(async () => {
    const db = await getDb();
    const srows = await db.getAllAsync<{ key: string; value: string }>("SELECT * FROM settings;");
    const raw: Record<string, string> = Object.fromEntries(srows.map((r) => [r.key, r.value]));
    if (raw.model_version !== String(MODEL_VERSION)) {
      await rebuild(today);
      await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES ('model_version', ?);", [String(MODEL_VERSION)]);
    }
    const types = await db.getAllAsync<TypeRow>("SELECT * FROM types ORDER BY name COLLATE NOCASE;");
    const hamper = await db.getAllAsync<HamperRow>("SELECT * FROM hamper WHERE pieces > 0;");
    const adds = await db.getAllAsync<AddRow>("SELECT * FROM adds ORDER BY day DESC, rowid DESC;");
    const washes = await db.getAllAsync<WashRow>("SELECT * FROM washes ORDER BY day DESC, rowid DESC;");
    const bleed = await get<BleedModel>("bleed", {});
    let rates = await get<Record<string, Rate>>("rates", {});
    const rateDay = await get<string | null>("rateDay", null);
    // Темп учится по закрытым дням: каждый новый прошедший день с добавлениями — одно наблюдение.
    const closed = [...new Set(adds.map((a) => a.day))].filter((d) => d < today && (!rateDay || d > rateDay)).sort();
    if (closed.length) {
      rates = { ...rates };
      for (const d of closed) for (const t of types) rates[t.id] = observeDay(rates[t.id], adds.filter((a) => a.day === d && a.type_id === t.id).reduce((s, a) => s + a.pieces, 0));
      await put("rates", rates);
      await put("rateDay", closed[closed.length - 1]);
    }
    const settings: Settings = { ...DEFAULT_SETTINGS };
    for (const k of ["capKg", "loadsPerDay", "rackKg"] as const) if (raw[k]) settings[k] = Number(raw[k]);
    if (raw.dryer) settings.dryer = raw.dryer === "1";
    if (raw.haptics) settings.haptics = raw.haptics === "1";
    // Разовые лишние стирки по датам — из применённых исправлений плана.
    const extra: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw)) if (k.startsWith("extra:") && k.slice(6) >= today) extra[k.slice(6)] = Number(v);
    return { types, hamper, adds, washes, bleed, rates, settings, extra };
  });
}

export type NewType = Omit<TypeRow, "id">;

export function addType(t: NewType) {
  return locked(async () => {
    const db = await getDb();
    const found = await db.getFirstAsync<TypeRow>("SELECT * FROM types WHERE name = ? COLLATE NOCASE;", [t.name.trim()]);
    if (found) return found.id;
    const id = generateId();
    await db.runAsync("INSERT INTO types (id, name, color, care, max_temp, want_temp, kg, dryer, owned) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);", [id, t.name.trim(), t.color, t.care, t.max_temp, t.want_temp, t.kg, t.dryer, t.owned]);
    return id;
  });
}

export function updateType(id: string, patch: Partial<NewType>) {
  return locked(async () => {
    const db = await getDb();
    for (const [k, v] of Object.entries(patch)) await db.runAsync(`UPDATE types SET ${k} = ? WHERE id = ?;`, [v as string | number, id]);
  });
}

export function deleteType(id: string) {
  return locked(async () => {
    const db = await getDb();
    await db.runAsync("DELETE FROM types WHERE id = ?;", [id]);
    await db.runAsync("DELETE FROM hamper WHERE type_id = ?;", [id]);
  });
}

// В корзину: журнал добавлений (для темпа) + текущее содержимое.
export function toHamper(typeId: string, pieces: number, day: string) {
  return locked(async () => {
    const db = await getDb();
    await db.runAsync("INSERT INTO adds (id, day, type_id, pieces) VALUES (?, ?, ?, ?);", [generateId(), day, typeId, pieces]);
    const r = await db.getFirstAsync<HamperRow>("SELECT * FROM hamper WHERE type_id = ?;", [typeId]);
    await db.runAsync("INSERT OR REPLACE INTO hamper (type_id, pieces) VALUES (?, ?);", [typeId, (r?.pieces ?? 0) + pieces]);
  });
}

// Правка содержимого без журнала (опечатка, вынули обратно).
export function setHamper(typeId: string, pieces: number) {
  return locked(async () => {
    const db = await getDb();
    if (pieces <= 0) await db.runAsync("DELETE FROM hamper WHERE type_id = ?;", [typeId]);
    else await db.runAsync("INSERT OR REPLACE INTO hamper (type_id, pieces) VALUES (?, ?);", [typeId, pieces]);
  });
}

export function runWash(entries: { id: string; pieces: number }[], temp: number, kg: number, day: string) {
  return locked(async () => {
    const db = await getDb();
    for (const e of entries) {
      const r = await db.getFirstAsync<HamperRow>("SELECT * FROM hamper WHERE type_id = ?;", [e.id]);
      const left = (r?.pieces ?? 0) - e.pieces;
      if (left <= 0) await db.runAsync("DELETE FROM hamper WHERE type_id = ?;", [e.id]);
      else await db.runAsync("UPDATE hamper SET pieces = ? WHERE type_id = ?;", [left, e.id]);
    }
    const id = generateId();
    await db.runAsync("INSERT INTO washes (id, day, entries, temp, kg, ran) VALUES (?, ?, ?, ?, ?, NULL);", [id, day, JSON.stringify(entries), temp, kg]);
    return id;
  });
}

export function reportWash(id: string, ran: boolean, today: string) {
  return locked(async () => {
    const db = await getDb();
    const w = await db.getFirstAsync<WashRow>("SELECT * FROM washes WHERE id = ?;", [id]);
    if (!w) return;
    await db.runAsync("UPDATE washes SET ran = ? WHERE id = ?;", [ran ? 1 : 0, id]);
    if (w.ran === null) {
      const types = await db.getAllAsync<TypeRow>("SELECT * FROM types;");
      await put("bleed", observeLoad(await get<BleedModel>("bleed", {}), colorsOf(w.entries, types), ran));
    } else await rebuild(today);
  });
}

export function saveSetting(key: string, value: string) {
  return locked(async () => {
    const db = await getDb();
    await db.runAsync("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?);", [key, value]);
  });
}

export function resetAll() {
  return locked(async () => {
    const db = await getDb();
    for (const t of ["types", "hamper", "adds", "washes", "model"]) await db.runAsync(`DELETE FROM ${t};`);
  });
}
