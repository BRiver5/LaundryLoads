import { test } from "node:test";
import assert from "node:assert/strict";
import { bleedRisk, loadCost, observeLoad, pairVerdict, type ItemType } from "./laundry.ts";
import { pack } from "./packer.ts";
import { daysLeft, fixes, observeDay, perDay, schedule } from "./schedule.ts";

const T = (id: string, color: ItemType["color"], maxTemp: number, wantTemp: number, kg: number, care: ItemType["care"] = "normal", dryer = true): ItemType => ({ id, name: id, color, care, maxTemp, wantTemp, kg, dryer });
const towels = T("towels", "white", 60, 60, 0.6);
const jeans = T("jeans", "dark", 40, 40, 0.7, "normal", false);
const tees = T("tees", "light", 40, 40, 0.2);
const red = T("red", "bleed", 30, 30, 0.3);
const silk = T("silk", "light", 30, 30, 0.15, "delicate", false);

test("whites never go with darks; the bleed model learns from reports", () => {
  assert.ok(pairVerdict({}, towels, jeans).hard);
  const before = bleedRisk({}, "light", "bleed").p;
  let m = {};
  for (let i = 0; i < 4; i++) m = observeLoad(m, ["light", "bleed"], true);
  assert.ok(bleedRisk(m, "light", "bleed").p > before);
  assert.ok(pairVerdict(m, tees, red).hard);
  let ok = {};
  for (let i = 0; i < 6; i++) ok = observeLoad(ok, ["light", "dark"], false);
  assert.ok(bleedRisk(ok, "light", "dark").p < bleedRisk({}, "light", "dark").p);
});

test("load cost charges hygiene for towels washed cool", () => {
  const hot = loadCost([{ t: towels, pieces: 4 }], {}, 7)!;
  const cool = loadCost([{ t: towels, pieces: 4 }, { t: silk, pieces: 2 }], {}, 7)!;
  assert.equal(hot.temp, 60);
  assert.equal(cool.temp, 30);
  assert.ok(cool.hygiene > 0 && cool.gentle > 0);
  assert.equal(loadCost([{ t: towels, pieces: 20 }], {}, 7), null);
});

// Эталон: перебор всех разбиений (номер загрузки для каждой части).
function brutePartition(items: { t: ItemType; pieces: number }[], cap: number): number {
  const n = items.length;
  let best = Infinity;
  const lab = Array(n).fill(0);
  const rec = (i: number, k: number) => {
    if (i === n) {
      let tot = 0;
      for (let g = 0; g < k; g++) {
        const c = loadCost(items.filter((_, j) => lab[j] === g), {}, cap);
        if (!c) return;
        tot += c.total;
      }
      best = Math.min(best, tot);
      return;
    }
    for (let g = 0; g <= k; g++) {
      lab[i] = g;
      rec(i + 1, Math.max(k, g + 1));
    }
  };
  rec(0, 0);
  return best;
}

test("packer is optimal against brute-force partitions", () => {
  const sets = [
    [towels, jeans, tees, red, silk],
    [tees, silk, red, jeans],
    [towels, tees, silk],
  ];
  for (const s of sets) {
    const entries = s.map((t) => ({ type: t, pieces: 2 }));
    const p = pack(entries, {}, 7);
    const b = brutePartition(entries.map((e) => ({ t: e.type, pieces: e.pieces })), 7);
    assert.ok(Math.abs(p.total - b) < 1e-9, `${p.total} vs ${b}`);
    assert.equal(p.loads.reduce((s2, l) => s2 + l.entries.reduce((x, e) => x + e.pieces, 0), 0), entries.length * 2);
  }
});

test("schedule meets deadlines, and fixes are verified", () => {
  assert.ok(perDay(observeDay(observeDay(undefined, 3), 3)) > 1.5);
  assert.equal(daysLeft(0, 1), 0);
  const p = pack([{ type: towels, pieces: 6 }, { type: jeans, pieces: 4 }, { type: tees, pieces: 6 }], {}, 7);
  const caps = { loads: [1, 1, 1, 1, 1, 1, 1], rackKg: 8, dryer: false };
  const runOut = { towels: 1, jeans: 1, tees: 5 };
  const s = schedule(p.loads, runOut, caps);
  assert.ok(s.lateness > 0);
  const f = fixes(p.loads, runOut, caps, s, (d) => `day ${d}`);
  assert.ok(f.length > 0);
  for (const x of f) assert.ok(x.result.lateness < s.lateness);
  const relaxed = schedule(p.loads, runOut, { ...caps, loads: [3, 3, 3, 3, 3, 3, 3], rackKg: 20 });
  assert.equal(relaxed.lateness, 0);
});
