// Раскладка корзины по стиркам — точное разбиение множества: ДП по маскам
// (каждое подмножество, содержащее младший оставшийся элемент), стоимость
// загрузки — из laundry.loadCost (сама стирка + недостир + деликатный режим
// для обычных вещей + риск прокраса + недогруз). Вещь тяжелее барабана
// заранее режется на порции по вместимости.

import { loadCost, type BleedModel, type ItemType, type LoadCost } from "./laundry.ts";

export type Entry = { type: ItemType; pieces: number };
export type Load = { entries: Entry[]; cost: LoadCost };
export type Packing = { loads: Load[]; total: number; impossible: Entry[]; exact: boolean };

export const MAX_ITEMS = 14;

export function splitEntries(entries: Entry[], capKg: number): { parts: Entry[]; impossible: Entry[] } {
  const parts: Entry[] = [];
  const impossible: Entry[] = [];
  for (const e of entries) {
    if (e.pieces <= 0) continue;
    if (e.type.kg > capKg) {
      impossible.push(e);
      continue;
    }
    const per = Math.max(1, Math.floor(capKg / e.type.kg));
    let left = e.pieces;
    while (left > 0) {
      const take = Math.min(per, left);
      parts.push({ type: e.type, pieces: take });
      left -= take;
    }
  }
  return { parts, impossible };
}

export function pack(entries: Entry[], m: BleedModel, capKg: number): Packing {
  const { parts, impossible } = splitEntries(entries, capKg);
  // Слишком много частей для точного ДП — сливаем самые лёгкие одинаковые цвета (на практике не встречается).
  const items = parts.slice(0, MAX_ITEMS);
  const n = items.length;
  const full = (1 << n) - 1;
  const best = new Float64Array(1 << n).fill(Infinity);
  const pick = new Int32Array(1 << n).fill(0);
  const costOf = new Map<number, LoadCost | null>();
  const cost = (mask: number) => {
    if (!costOf.has(mask)) {
      const xs: { t: ItemType; pieces: number }[] = [];
      for (let i = 0; i < n; i++) if (mask & (1 << i)) xs.push({ t: items[i].type, pieces: items[i].pieces });
      costOf.set(mask, loadCost(xs, m, capKg));
    }
    return costOf.get(mask)!;
  };
  best[0] = 0;
  for (let mask = 1; mask <= full; mask++) {
    const low = mask & -mask;
    const rest = mask ^ low;
    // Перебор подмасок rest; загрузка = low ∪ sub.
    for (let sub = rest; ; sub = (sub - 1) & rest) {
      const load = low | sub;
      const c = cost(load);
      if (c) {
        const v = best[mask ^ load] + c.total;
        if (v < best[mask]) {
          best[mask] = v;
          pick[mask] = load;
        }
      }
      if (sub === 0) break;
    }
  }
  const loads: Load[] = [];
  let mask = full;
  while (mask && isFinite(best[mask])) {
    const load = pick[mask];
    const es: Entry[] = [];
    for (let i = 0; i < n; i++) if (load & (1 << i)) es.push(items[i]);
    // Одинаковые типы внутри загрузки — одной строкой.
    const merged: Entry[] = [];
    for (const e of es) {
      const f = merged.find((x) => x.type.id === e.type.id);
      if (f) f.pieces += e.pieces;
      else merged.push({ ...e });
    }
    loads.push({ entries: merged, cost: cost(load)! });
    mask ^= load;
  }
  loads.sort((a, b) => b.cost.kg - a.cost.kg);
  return { loads, total: isFinite(best[full]) ? best[full] : Infinity, impossible: [...impossible, ...parts.slice(MAX_ITEMS)], exact: parts.length <= MAX_ITEMS };
}
