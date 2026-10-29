import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle, ArrowLeft, CheckCircle2 } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { GROUP_COLORS } from "../src/theme/colors";
import { staggerDelay } from "../src/theme/motion";
import { useApp } from "../src/store/appStore";
import { loadKey, useWeek } from "../src/ui/derive";
import { goBack } from "../src/ui/nav";
import { PressableScale } from "../src/components/PressableScale";
import { Segmented } from "../src/components/Segmented";
import { Chip, Stepper } from "../src/components/Bits";
import { Toggle } from "../src/components/Toggle";
import { WeekLanes } from "../src/components/Widgets";
import { WhySheet } from "../src/components/Sheets";
import { saveSetting } from "../src/data/repo";
import { DAYS, fixes } from "../src/lib/schedule";
import { COLOR_ORDER } from "../src/lib/laundry";
import { addDays, weekdayLabel } from "../src/lib/time";
import { plural } from "../src/ui/format";
import { haptics } from "../src/services/haptics";
import type { Load } from "../src/lib/packer";

type Tab = "week" | "whatif";

// Цвет блока недели — самая «тёмная» группа в загрузке (она и задаёт характер стирки).
function dominant(l: Load): string {
  const order = [...COLOR_ORDER].reverse();
  return GROUP_COLORS[order.find((c) => l.entries.some((e) => e.type.color === c)) ?? "light"];
}

export default function PlanScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { types, today, settings, extra, refresh } = useApp();
  const w = useWeek();
  const [tab, setTab] = useState<Tab>("week");
  const [sel, setSel] = useState<string | null>(null);
  const [why, setWhy] = useState<Load | null>(null);
  const labels = Array.from({ length: DAYS }, (_, d) => (d === 0 ? "Today" : weekdayLabel(addDays(today, d))));
  const s = w.sched;
  const fx = useMemo(() => (tab === "week" ? fixes(w.packing.loads, w.runOut, w.caps, s, w.dayName) : []), [tab, w]);

  const [cap, setCap] = useState(settings.capKg);
  const [perDay, setPerDay] = useState(settings.loadsPerDay);
  const [rack, setRack] = useState(settings.rackKg);
  const [dryer, setDryer] = useState(settings.dryer);
  const [plus, setPlus] = useState<string | null>(null);
  const alt = useMemo(() => (tab === "whatif" ? w.build({ capKg: cap, loadsPerDay: perDay, rackKg: rack, dryer, extra: plus ? { type: plus, pieces: 4 } : undefined }) : null), [tab, cap, perDay, rack, dryer, plus, w]);

  const selSlot = s.slots.find((x) => loadKey(x.load.entries) + x.day === sel);
  const col = (label: string, a: string, b: string, better: boolean | null) => (
    <View key={label} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 9, borderTopWidth: 1, borderTopColor: t.colors.border }}>
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, flex: 1.3 }}>{label}</Text>
      <Text style={{ ...t.typography.label, color: t.colors.ink, flex: 1, textAlign: "center" }}>{a}</Text>
      <Text style={{ ...t.typography.label, flex: 1, textAlign: "center", color: better === null ? t.colors.ink : better ? t.colors.fresh : t.colors.danger }}>{b}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 10 }}>
        <PressableScale accessibilityLabel="Back" onPress={goBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.surface, alignItems: "center", justifyContent: "center" }}>
          <ArrowLeft size={20} color={t.colors.ink} />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <Text style={{ ...t.typography.subtitle, color: t.colors.ink }}>Wash week</Text>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
            {plural(s.slots.length, "load")} · {settings.loadsPerDay} a day · rack {settings.rackKg} kg{settings.dryer ? " · dryer" : ""}
          </Text>
        </View>
      </View>
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <Segmented items={[{ key: "week" as Tab, label: "Week", badge: s.lateness > 0 ? s.slots.filter((x) => x.late).length : undefined }, { key: "whatif" as Tab, label: "What if" }]} value={tab} onChange={setTab} />
      </View>

      {tab === "week" ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: insets.bottom + 40 }}>
          <Animated.View entering={FadeInDown.duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 14, gap: 10 }}>
            <WeekLanes
              loads={s.slots.map((x) => ({ key: loadKey(x.load.entries) + x.day, day: x.day, kg: x.load.cost.kg, color: dominant(x.load), late: x.late > 0, deadline: x.deadline }))}
              labels={labels}
              capKg={settings.capKg}
              caps={w.caps.loads}
              selected={sel}
              onSelect={setSel}
            />
            {selSlot ? (
              <PressableScale accessibilityLabel="Why this load" onPress={() => setWhy(selSlot.load)} style={{ backgroundColor: t.colors.surfaceAlt, borderRadius: 14, padding: 12, gap: 4 }}>
                <Text style={{ ...t.typography.label, color: t.colors.ink }}>
                  {w.dayName(selSlot.day)} · {selSlot.load.cost.temp}° {selSlot.load.cost.delicate ? "delicate" : "normal"} · {selSlot.load.cost.kg.toFixed(1)} kg
                </Text>
                <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
                  {selSlot.load.entries.map((e) => `${e.type.name} × ${e.pieces}`).join(", ")}
                </Text>
                <Text style={{ ...t.typography.caption, color: selSlot.late ? t.colors.coral : t.colors.fresh }}>
                  {selSlot.late ? `${plural(selSlot.late, "day")} after something runs out` : `In time — needed by ${w.dayName(selSlot.deadline)}`} · tap for why
                </Text>
              </PressableScale>
            ) : (
              <Text style={{ ...t.typography.caption, color: t.colors.inkFaint, textAlign: "center" }}>Tap a block to see that load · red frame = runs late</Text>
            )}
          </Animated.View>

          {s.lateness > 0 ? (
            <Animated.View entering={FadeInDown.delay(staggerDelay(1)).duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, gap: 8, borderWidth: 1.5, borderColor: t.colors.coral }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={16} color={t.colors.coral} />
                <Text style={{ ...t.typography.label, fontSize: 15, color: t.colors.ink, flex: 1 }}>Something runs out before it's clean</Text>
              </View>
              {s.slots
                .filter((x) => x.late)
                .map((x) => (
                  <Text key={loadKey(x.load.entries) + x.day} style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
                    {x.load.entries.filter((e) => isFinite(w.runOut[e.type.id]) && Math.floor(w.runOut[e.type.id]) - 1 < x.day).map((e) => e.type.name).join(", ") || "This load"}: needed by {w.dayName(x.deadline)}, earliest free slot is {w.dayName(x.day)} — {settings.loadsPerDay} load a day{settings.dryer ? "" : " and the rack"} are full before that.
                  </Text>
                ))}
              {fx.length === 0 ? <Text style={{ ...t.typography.caption, color: t.colors.coral }}>No single change fixes it — wear something else for a day.</Text> : null}
              {fx.map((f, k) => (
                <View key={f.label} style={{ backgroundColor: t.colors.surfaceAlt, borderRadius: 14, padding: 10, gap: 4 }}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ ...t.typography.label, color: t.colors.ink, flex: 1 }}>
                      {k + 1}. {f.label}
                    </Text>
                    <Text style={{ ...t.typography.label, color: f.result.lateness === 0 ? t.colors.fresh : t.colors.signal }}>{f.result.lateness === 0 ? "all on time" : `${plural(f.result.lateness, "day")} late`}</Text>
                  </View>
                  <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{f.detail}</Text>
                  <PressableScale
                    accessibilityLabel={`Apply ${f.label}`}
                    onPress={async () => {
                      haptics.tap();
                      for (let d = 0; d < DAYS; d++) {
                        const add = f.caps.loads[d] - w.caps.loads[d];
                        if (add > 0) {
                          const date = addDays(today, d);
                          await saveSetting(`extra:${date}`, String((extra[date] ?? 0) + add));
                        }
                      }
                      if (f.caps.dryer !== w.caps.dryer) await saveSetting("dryer", f.caps.dryer ? "1" : "0");
                      if (f.caps.rackKg !== w.caps.rackKg) await saveSetting("rackKg", String(f.caps.rackKg));
                      await refresh();
                    }}
                    style={{ alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: t.colors.accentSoft }}
                  >
                    <Text style={{ ...t.typography.label, color: t.colors.accent }}>Apply</Text>
                  </PressableScale>
                </View>
              ))}
            </Animated.View>
          ) : s.slots.length ? (
            <Animated.View entering={FadeInDown.delay(staggerDelay(1)).duration(400)} style={{ backgroundColor: t.colors.freshSoft, borderRadius: 22, padding: 14, flexDirection: "row", gap: 10, alignItems: "center" }}>
              <CheckCircle2 size={18} color={t.colors.fresh} />
              <Text style={{ ...t.typography.caption, color: t.colors.ink, flex: 1 }}>Everything is clean before it runs out. {s.exact ? "Every day-by-load combination was checked." : ""}</Text>
            </Animated.View>
          ) : (
            <Text style={{ ...t.typography.body, color: t.colors.inkMuted, textAlign: "center" }}>Nothing to wash this week.</Text>
          )}

          {s.slots.map((x, i) => (
            <Animated.View key={loadKey(x.load.entries) + x.day} entering={FadeInDown.delay(staggerDelay(i + 2)).duration(350)}>
              <PressableScale accessibilityLabel={`Load row ${i + 1}`} onPress={() => setWhy(x.load)} style={{ backgroundColor: t.colors.surface, borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 46, alignItems: "center" }}>
                  <Text style={{ ...t.typography.label, color: x.late ? t.colors.coral : t.colors.accent }}>{labels[x.day]}</Text>
                  <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{x.load.cost.temp}°</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ ...t.typography.label, color: t.colors.ink }}>{x.load.entries.map((e) => e.type.name).join(", ")}</Text>
                  <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
                    {x.load.cost.kg.toFixed(1)} kg · {x.dryer ? "dryer" : "rack"} · score {x.load.cost.total.toFixed(2)}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 3 }}>
                  {x.load.entries.map((e) => (
                    <View key={e.type.id} style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: GROUP_COLORS[e.type.color] }} />
                  ))}
                </View>
              </PressableScale>
            </Animated.View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: insets.bottom + 40 }}>
          <Animated.View entering={FadeInDown.duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, gap: 12 }}>
            {[
              ["Machine size", <Stepper key="c" value={cap} onChange={setCap} step={0.5} min={3} max={12} format={(v) => `${v} kg`} />],
              ["Loads a day", <Stepper key="l" value={perDay} onChange={setPerDay} min={1} max={4} />],
              ["Drying rack", <Stepper key="r" value={rack} onChange={setRack} step={0.5} min={1} max={15} format={(v) => `${v} kg`} />],
            ].map(([l, c]) => (
              <View key={l as string} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ ...t.typography.label, color: t.colors.ink }}>{l}</Text>
                {c}
              </View>
            ))}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ ...t.typography.label, color: t.colors.ink }}>Use a dryer</Text>
              <Toggle value={dryer} onValueChange={setDryer} />
            </View>
            <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>And if 4 more go in</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {types.map((x) => (
                <Chip key={x.id} a11y={`Plus ${x.name}`} label={x.name} color={GROUP_COLORS[x.color]} active={plus === x.id} onPress={() => setPlus(plus === x.id ? null : x.id)} />
              ))}
            </View>
          </Animated.View>
          {alt ? (
            <Animated.View entering={FadeInDown.delay(staggerDelay(1)).duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16 }}>
              <View style={{ flexDirection: "row", paddingBottom: 6 }}>
                <Text style={{ flex: 1.3 }} />
                <Text style={{ ...t.typography.overline, color: t.colors.inkMuted, flex: 1, textAlign: "center" }}>Now</Text>
                <Text style={{ ...t.typography.overline, color: t.colors.accent, flex: 1, textAlign: "center" }}>What if</Text>
              </View>
              {col("Loads", String(w.packing.loads.length), String(alt.packing.loads.length), alt.packing.loads.length === w.packing.loads.length ? null : alt.packing.loads.length < w.packing.loads.length)}
              {col("Hamper score", w.packing.total.toFixed(2), alt.packing.total.toFixed(2), Math.abs(alt.packing.total - w.packing.total) < 0.01 ? null : alt.packing.total < w.packing.total)}
              {col("Days late", String(s.lateness), String(alt.sched.lateness), alt.sched.lateness === s.lateness ? null : alt.sched.lateness < s.lateness)}
              {col("Last wash", s.slots.length ? labels[Math.max(...s.slots.map((x) => x.day))] : "—", alt.sched.slots.length ? labels[Math.max(...alt.sched.slots.map((x) => x.day))] : "—", null)}
              <Text style={{ ...t.typography.caption, color: t.colors.inkFaint, marginTop: 6 }}>Hamper score adds up every load's cost (washes, cool-wash compromises, color risk, half-empty drums).</Text>
            </Animated.View>
          ) : null}
          {alt && (cap !== settings.capKg || perDay !== settings.loadsPerDay || rack !== settings.rackKg || dryer !== settings.dryer) ? (
            <PressableScale
              accessibilityLabel="Keep these settings"
              onPress={async () => {
                await saveSetting("capKg", String(cap));
                await saveSetting("loadsPerDay", String(perDay));
                await saveSetting("rackKg", String(rack));
                await saveSetting("dryer", dryer ? "1" : "0");
                await refresh();
                haptics.success();
                setTab("week");
              }}
              style={{ alignItems: "center", paddingVertical: 14, borderRadius: 999, backgroundColor: t.colors.ink }}
            >
              <Text style={{ ...t.typography.subtitle, color: "#FFFFFF" }}>Keep these settings</Text>
            </PressableScale>
          ) : null}
        </ScrollView>
      )}
      <WhySheet load={why} onClose={() => setWhy(null)} />
    </View>
  );
}
