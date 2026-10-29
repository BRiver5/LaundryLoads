// Неделя стирок. Темп «сколько штук типа уходит в корзину в день» — гамма-
// пуассон с забыванием, обновляется по каждому закрытому дню, когда что-то
// клали в корзину. Из темпа и запаса чистого — день, когда тип кончится, а из
// него дедлайн загрузки (постирать накануне, чтобы успело высохнуть).
// Расписание — точный перебор с отсечением: каждая загрузка в один из 7 дней,
// не больше N стирок в день, сушилка-стойка вмещает ограниченные килограммы
// в день (то, что нельзя в сушильную машину, — всегда на стойку).
// Цель: сначала опоздания (дни × 10), потом — пораньше.

import type { Load } from "./packer.ts";

export const DAYS = 7;
export const FORGET_DAY = 0.93;

export type Rate = { a: number; b: number };
export function observeDay(r: Rate | undefined, pieces: number): Rate {
  const o = r ?? { a: 0, b: 0 };
  return { a: o.a * FORGET_DAY + pieces, b: o.b * FORGET_DAY + 1 };
}
export function perDay(r: Rate | undefined): number {
  const o = r ?? { a: 0, b: 0 };
  return (o.a + 0.2) / (o.b + 1);
}

// Сколько дней хватит чистого: запас / темп; Infinity — тип не кончается.
export function daysLeft(clean: number, rate: number): number {
  if (rate <= 0.02) return Infinity;
  return Math.max(0, clean / rate);
}

export type DayCaps = { loads: number[]; rackKg: number; dryer: boolean };
export type Slot = { load: Load; day: number; deadline: number; late: number; dryer: boolean };
export type Schedule = { slots: Slot[]; lateness: number; cost: number; exact: boolean };

export function loadDeadline(load: Load, runOut: Record<string, number>): number {
  let d = DAYS - 1;
  for (const e of load.entries) {
    const r = runOut[e.type.id];
    if (r !== undefined && isFinite(r)) d = Math.min(d, Math.max(0, Math.floor(r) - 1));
  }
  return d;
}

export function usesDryer(load: Load, caps: DayCaps): boolean {
  return caps.dryer && load.entries.every((e) => e.type.dryer);
}

export function schedule(loads: Load[], runOut: Record<string, number>, caps: DayCaps): Schedule {
  const items = loads.map((load) => ({ load, deadline: loadDeadline(load, runOut), dryer: usesDryer(load, caps) }));
  const order = items.map((_, i) => i).sort((a, b) => items[a].deadline - items[b].deadline);
  const used = Array(DAYS).fill(0);
  const rack = Array(DAYS).fill(0);
  const cur = Array(items.length).fill(-1);
  let best = Infinity;
  let bestAt: number[] = [];
  let nodes = 0;
  let exact = true;
  const dfs = (k: number, cost: number) => {
    if (++nodes > 400_000) {
      exact = false;
      return;
    }
    if (cost >= best) return;
    if (k === order.length) {
      best = cost;
      bestAt = [...cur];
      return;
    }
    const i = order[k];
    const it = items[i];
    for (let d = 0; d < DAYS; d++) {
      if (used[d] >= caps.loads[d]) continue;
      // Загрузка тяжелее стойки занимает её целиком — в этот день больше ничего не сушится.
      if (!it.dryer && rack[d] > 0 && rack[d] + it.load.cost.kg > caps.rackKg + 1e-9) continue;
      const late = Math.max(0, d - it.deadline);
      used[d]++;
      if (!it.dryer) rack[d] += it.load.cost.kg;
      cur[i] = d;
      dfs(k + 1, cost + late * 10 + d * 0.1);
      used[d]--;
      if (!it.dryer) rack[d] -= it.load.cost.kg;
      cur[i] = -1;
    }
  };
  dfs(0, 0);
  if (!isFinite(best)) return { slots: [], lateness: Infinity, cost: Infinity, exact };
  const slots = items.map((it, i) => ({ load: it.load, day: bestAt[i], deadline: it.deadline, late: Math.max(0, bestAt[i] - it.deadline), dryer: it.dryer }));
  slots.sort((a, b) => a.day - b.day || b.load.cost.kg - a.load.cost.kg);
  return { slots, lateness: slots.reduce((s, x) => s + x.late, 0), cost: best, exact };
}

// Почему загрузка опаздывает и что поможет — каждое предложение проверено перерасчётом.
export type Fix = { label: string; detail: string; caps: DayCaps; result: Schedule };

export function fixes(loads: Load[], runOut: Record<string, number>, caps: DayCaps, base: Schedule, dayName: (d: number) => string): Fix[] {
  if (base.lateness === 0) return [];
  const out: Fix[] = [];
  for (let d = 0; d < DAYS; d++) {
    const c = { ...caps, loads: caps.loads.map((x, i) => (i === d ? x + 1 : x)) };
    const r = schedule(loads, runOut, c);
    if (r.lateness < base.lateness) out.push({ label: `One more load on ${dayName(d)}`, detail: `${dayName(d)} takes ${c.loads[d]} loads instead of ${caps.loads[d]}.`, caps: c, result: r });
    else if (!caps.dryer) {
      // Одна лишняя стирка упирается в стойку — проверяем её вместе с сушилкой.
      const cd = { ...c, dryer: true };
      const rd = schedule(loads, runOut, cd);
      if (rd.lateness < base.lateness) out.push({ label: `Extra load on ${dayName(d)} + dryer`, detail: `Two loads that day; the dryer-safe one skips the rack.`, caps: cd, result: rd });
    }
  }
  if (!caps.dryer) {
    const c = { ...caps, dryer: true };
    const r = schedule(loads, runOut, c);
    if (r.lateness < base.lateness) out.push({ label: "Use the dryer this week", detail: "Dryer-safe loads skip the rack, so more fits each day.", caps: c, result: r });
  }
  const c2 = { ...caps, rackKg: caps.rackKg + 2 };
  const r2 = schedule(loads, runOut, c2);
  if (r2.lateness < base.lateness) out.push({ label: "Add a second rack (+2 kg)", detail: "More air-dry space each day.", caps: c2, result: r2 });
  out.sort((a, b) => a.result.lateness - b.result.lateness || a.result.cost - b.result.cost);
  // Одинаковые по результату «ещё стирка в день X» — оставляем самый ранний.
  return out.filter((f, i) => out.findIndex((g) => g.result.lateness === f.result.lateness && Math.abs(g.result.cost - f.result.cost) < 1e-9) === i).slice(0, 3);
}
