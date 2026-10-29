import { useMemo } from "react";
import { useApp } from "../store/appStore";
import type { TypeRow } from "../data/repo";
import type { ItemType } from "../lib/laundry";
import { pack, type Entry, type Packing } from "../lib/packer";
import { DAYS, daysLeft, perDay, schedule, type DayCaps, type Schedule } from "../lib/schedule";
import { addDays, weekdayLabel } from "../lib/time";

export function toItem(t: TypeRow): ItemType {
  return { id: t.id, name: t.name, color: t.color, care: t.care, maxTemp: t.max_temp, wantTemp: t.want_temp, kg: t.kg, dryer: t.dryer === 1 };
}

export type Overrides = { capKg?: number; loadsPerDay?: number; rackKg?: number; dryer?: boolean; extra?: { type: string; pieces: number } };
export type Week = {
  items: Map<string, ItemType>;
  rows: Map<string, TypeRow>;
  entries: Entry[];
  packing: Packing;
  sched: Schedule;
  caps: DayCaps;
  rate: Record<string, number>;
  clean: Record<string, number>;
  runOut: Record<string, number>;
  dayName: (d: number) => string;
  build: (o: Overrides) => { packing: Packing; sched: Schedule; caps: DayCaps; runOut: Record<string, number> };
};

// Всё производное от стора: раскладка корзины, запасы чистого, дедлайны, неделя.
export function useWeek(): Week {
  const version = useApp((s) => s.version);
  return useMemo(() => {
    const st = useApp.getState();
    const items = new Map(st.types.map((t) => [t.id, toItem(t)]));
    const rows = new Map(st.types.map((t) => [t.id, t]));
    const dayName = (d: number) => (d === 0 ? "today" : d === 1 ? "tomorrow" : weekdayLabel(addDays(st.today, d)));
    const rate: Record<string, number> = Object.fromEntries(st.types.map((t) => [t.id, perDay(st.rates[t.id])]));
    const build = (o: Overrides) => {
      const hamper = st.hamper.map((h) => ({ ...h }));
      if (o.extra) {
        const f = hamper.find((h) => h.type_id === o.extra!.type);
        if (f) f.pieces += o.extra.pieces;
        else hamper.push({ type_id: o.extra.type, pieces: o.extra.pieces });
      }
      const entries: Entry[] = hamper.filter((h) => items.has(h.type_id)).map((h) => ({ type: items.get(h.type_id)!, pieces: h.pieces }));
      const capKg = o.capKg ?? st.settings.capKg;
      const packing = pack(entries, st.bleed, capKg);
      const runOut: Record<string, number> = {};
      for (const t of st.types) {
        const dirty = hamper.find((h) => h.type_id === t.id)?.pieces ?? 0;
        runOut[t.id] = dirty > 0 ? daysLeft(Math.max(0, t.owned - dirty), rate[t.id]) : Infinity;
      }
      const caps: DayCaps = { loads: Array.from({ length: DAYS }, (_, d) => (o.loadsPerDay ?? st.settings.loadsPerDay) + (st.extra[addDays(st.today, d)] ?? 0)), rackKg: o.rackKg ?? st.settings.rackKg, dryer: o.dryer ?? st.settings.dryer };
      return { packing, sched: schedule(packing.loads, runOut, caps), caps, runOut, entries };
    };
    const b = build({});
    const clean: Record<string, number> = Object.fromEntries(st.types.map((t) => [t.id, Math.max(0, t.owned - (st.hamper.find((h) => h.type_id === t.id)?.pieces ?? 0))]));
    return { items, rows, entries: b.entries, packing: b.packing, sched: b.sched, caps: b.caps, rate, clean, runOut: b.runOut, dayName, build };
  }, [version]);
}

export function loadKey(e: Entry[]): string {
  return e.map((x) => `${x.type.id}:${x.pieces}`).sort().join("|");
}
