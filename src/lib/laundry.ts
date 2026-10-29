// Совместимость вещей в одной стирке и накапливаемая модель «полиняет ли».
//
// Жёсткие запреты: белое с тёмным/линяющим, линяющее со светлым — если модель
// считает риск выше порога. Мягкие штрафы: недостираешь то, что хотело 60°
// (полотенца, постель), когда в загрузке есть вещь «не выше 40°»; деликатный
// режим для обычных вещей; риск прокраса для пар с умеренной вероятностью.
// Модель прокраса — бета на пару цветовых групп с забыванием: каждый отчёт
// «полиняло / всё чисто» после стирки обновляет все смешанные пары загрузки.

export type ColorGroup = "white" | "light" | "dark" | "bleed";
export type Care = "normal" | "delicate";
export type ItemType = { id: string; name: string; color: ColorGroup; care: Care; maxTemp: number; wantTemp: number; kg: number; dryer: boolean };

export const COLOR_ORDER: ColorGroup[] = ["white", "light", "dark", "bleed"];
export const MODEL_VERSION = 1;
export const FORGET = 0.9;

export type Beta = { a: number; b: number };
export type BleedModel = Record<string, Beta>;

export const pairKey = (x: ColorGroup, y: ColorGroup) => (COLOR_ORDER.indexOf(x) <= COLOR_ORDER.indexOf(y) ? `${x}|${y}` : `${y}|${x}`);

// Априор: насколько вероятно, что пара испортит светлую вещь.
const PRIOR: Record<string, Beta> = {
  "white|light": { a: 0.3, b: 6 },
  "white|dark": { a: 3, b: 2 },
  "white|bleed": { a: 4, b: 1 },
  "light|dark": { a: 1, b: 4 },
  "light|bleed": { a: 2, b: 3 },
  "dark|bleed": { a: 0.3, b: 6 },
};

export function bleedRisk(m: BleedModel, x: ColorGroup, y: ColorGroup): { p: number; n: number } {
  if (x === y) return { p: 0, n: 0 };
  const k = pairKey(x, y);
  const pr = PRIOR[k] ?? { a: 0.3, b: 6 };
  const o = m[k] ?? { a: 0, b: 0 };
  return { p: (pr.a + o.a) / (pr.a + pr.b + o.a + o.b), n: o.a + o.b };
}

export function observeLoad(m: BleedModel, colors: ColorGroup[], ran: boolean): BleedModel {
  const uniq = [...new Set(colors)];
  const next = { ...m };
  for (let i = 0; i < uniq.length; i++)
    for (let j = i + 1; j < uniq.length; j++) {
      const k = pairKey(uniq[i], uniq[j]);
      const o = next[k] ?? { a: 0, b: 0 };
      next[k] = { a: o.a * FORGET + (ran ? 1 : 0), b: o.b * FORGET + (ran ? 0 : 1) };
    }
  return next;
}

export const HARD_RISK = 0.5;
export const SOFT_WEIGHT = 3;

export type PairVerdict = { hard: boolean; risk: number; reason: string | null };

export function pairVerdict(m: BleedModel, a: ItemType, b: ItemType): PairVerdict {
  const r = bleedRisk(m, a.color, b.color);
  if (r.p >= HARD_RISK) return { hard: true, risk: r.p, reason: `${Math.round(r.p * 100)}% chance ${a.color === "white" || b.color === "white" ? "whites" : "the lighter one"} pick up color` };
  return { hard: false, risk: r.p, reason: r.p > 0.05 ? `${Math.round(r.p * 100)}% color risk` : null };
}

// Цикл загрузки: температура — минимум «не выше», режим деликатный, если есть деликатное.
export type LoadCost = { total: number; base: number; hygiene: number; gentle: number; bleed: number; underfill: number; temp: number; delicate: boolean; kg: number };

export function loadCost(items: { t: ItemType; pieces: number }[], m: BleedModel, capKg: number): LoadCost | null {
  const kg = items.reduce((s, x) => s + x.t.kg * x.pieces, 0);
  if (kg > capKg + 1e-9) return null;
  let bleed = 0;
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      const v = pairVerdict(m, items[i].t, items[j].t);
      if (v.hard) return null;
      bleed += v.risk * SOFT_WEIGHT;
    }
  const temp = Math.min(...items.map((x) => x.t.maxTemp));
  const delicate = items.some((x) => x.t.care === "delicate");
  // Недостир: каждый «шаг» 20° ниже желаемого — 0.5 на килограмм такой вещи.
  const hygiene = items.reduce((s, x) => s + (Math.max(0, x.t.wantTemp - temp) / 20) * 0.5 * x.t.kg * x.pieces, 0);
  const gentle = delicate ? items.filter((x) => x.t.care === "normal").reduce((s, x) => s + 0.15 * x.t.kg * x.pieces, 0) : 0;
  const underfill = kg < 0.4 * capKg ? 0.3 : 0;
  const base = 1;
  return { total: base + hygiene + gentle + bleed + underfill, base, hygiene, gentle, bleed, underfill, temp, delicate, kg };
}
