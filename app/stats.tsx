import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { GROUP_COLORS, GROUP_LABEL } from "../src/theme/colors";
import { staggerDelay } from "../src/theme/motion";
import { useApp } from "../src/store/appStore";
import { useWeek } from "../src/ui/derive";
import { goBack } from "../src/ui/nav";
import { PressableScale } from "../src/components/PressableScale";
import { AnimatedRing } from "../src/components/AnimatedRing";
import { AnimatedCounter } from "../src/components/AnimatedCounter";
import { CategoryRing } from "../src/components/CategoryRing";
import { BarChart } from "../src/components/BarChart";
import { Heatmap } from "../src/components/Heatmap";
import { Legend } from "../src/components/Bits";
import { EmptyState } from "../src/components/EmptyState";
import { BleedMatrix } from "../src/components/Widgets";
import { COLOR_ORDER } from "../src/lib/laundry";
import { addDays, daysBetween, weekStart } from "../src/lib/time";
import { pct } from "../src/ui/format";

const WEEKS = 12;

export default function Stats() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { washes, types, bleed, today, settings } = useApp();
  const w = useWeek();
  const [grp, setGrp] = useState<string | null>(null);

  const s = useMemo(() => {
    const typeOf = new Map(types.map((x) => [x.id, x]));
    const rows = washes.map((x) => {
      const es: { id: string; pieces: number }[] = JSON.parse(x.entries);
      const byGroup: Record<string, number> = {};
      for (const e of es) {
        const ty = typeOf.get(e.id);
        if (ty) byGroup[ty.color] = (byGroup[ty.color] ?? 0) + ty.kg * e.pieces;
      }
      return { w: x, byGroup };
    });
    const scoped = rows.filter((r) => !grp || (r.byGroup[grp] ?? 0) > 0);
    const kgOf = (r: (typeof rows)[number]) => (grp ? r.byGroup[grp] ?? 0 : r.w.kg);
    const month = scoped.filter((r) => daysBetween(r.w.day, today) < 30);
    const fill = month.length ? month.reduce((a, r) => a + r.w.kg / settings.capKg, 0) / month.length : 0;
    const ring = COLOR_ORDER.map((c) => ({ key: c, value: Math.round(rows.reduce((a, r) => a + (r.byGroup[c] ?? 0), 0) * 10) / 10, color: GROUP_COLORS[c] }));
    const start = addDays(weekStart(today), -7 * (WEEKS - 1));
    const weeks = Array.from({ length: 8 }, (_, i) => addDays(weekStart(today), -7 * (7 - i)));
    const bars = weeks.map((ws) => ({ label: `${Number(ws.slice(8))}`, value: Math.round(scoped.filter((r) => r.w.day >= ws && r.w.day < addDays(ws, 7)).reduce((a, r) => a + kgOf(r), 0) * 10) / 10 }));
    const count = new Map<string, number>();
    for (const r of scoped) count.set(r.w.day, (count.get(r.w.day) ?? 0) + 1);
    const cells = [];
    for (let d = 0; d < 7; d++)
      for (let k = 0; k < WEEKS; k++) {
        const day = addDays(start, k * 7 + d);
        cells.push({ key: day, intensity: day > today ? 0 : Math.min(1, (count.get(day) ?? 0) / 2) });
      }
    const fills = scoped.slice(0, 10).reverse().map((r, i) => ({ label: String(i + 1), value: Math.round((r.w.kg / settings.capKg) * 100) }));
    const reported = scoped.filter((r) => r.w.ran !== null);
    const ran = reported.filter((r) => r.w.ran === 1).length;
    const stock = types
      .filter((x) => !grp || x.color === grp)
      .map((x) => ({ x, days: w.rate[x.id] > 0.02 ? x.owned / w.rate[x.id] : Infinity }))
      .sort((a, b) => a.days - b.days)
      .slice(0, 5);
    return { month, fill, ring, bars, cells, fills, reported, ran, stock, kg30: month.reduce((a, r) => a + kgOf(r), 0) };
  }, [washes, types, grp, today, w, settings.capKg]);

  const heat = (i: number) => (i === 0 ? t.colors.backgroundAlt : i < 0.6 ? "#9CC6D6" : t.colors.accent);

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
        <PressableScale accessibilityLabel="Back" onPress={goBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.surface, alignItems: "center", justifyContent: "center" }}>
          <ArrowLeft size={20} color={t.colors.ink} />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <Text style={{ ...t.typography.subtitle, color: t.colors.ink }}>Laundry stats</Text>
          <Text style={{ ...t.typography.caption, color: grp ? t.colors.accent : t.colors.inkMuted }}>{grp ? `${GROUP_LABEL[grp]} only — tap the ring again to clear` : "All colors"}</Text>
        </View>
      </View>
      {washes.length === 0 ? (
        <EmptyState title="No washes yet" description="Start a load from the home screen — every wash, fill level and color report shows up here." />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 40 }}>
          <Animated.View entering={FadeInDown.duration(400)} style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: t.colors.surface, borderRadius: 20, padding: 12, alignItems: "center", gap: 2 }}>
              <AnimatedCounter value={s.month.length} style={{ fontSize: 28, fontWeight: "800", color: t.colors.ink, padding: 0, textAlign: "center", minWidth: 50 }} />
              <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>washes · 30 d</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: t.colors.surface, borderRadius: 20, padding: 12, alignItems: "center", gap: 2 }}>
              <AnimatedRing progress={s.fill} size={58} strokeWidth={7} color={t.colors.accent} trackColor={t.colors.accentSoft}>
                <Text style={{ ...t.typography.label, color: t.colors.ink }}>{pct(s.fill)}</Text>
              </AnimatedRing>
              <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>avg drum fill</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: t.colors.surface, borderRadius: 20, padding: 12, alignItems: "center", gap: 2 }}>
              <AnimatedCounter value={s.kg30} formatter={(v) => { "worklet"; return v.toFixed(1); }} style={{ fontSize: 28, fontWeight: "800", color: t.colors.ink, padding: 0, textAlign: "center", minWidth: 60 }} />
              <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>kg · 30 d</Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(staggerDelay(1)).duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, gap: 12 }}>
            <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>Kilograms washed by color · tap to focus</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <CategoryRing segments={s.ring} selected={grp} onSelect={setGrp} size={150} center={<Text style={{ ...t.typography.subtitle, color: t.colors.ink }}>{grp ? s.ring.find((x) => x.key === grp)?.value : s.ring.reduce((a, x) => a + x.value, 0).toFixed(1)} kg</Text>} />
              <View style={{ flex: 1 }}>
                <Legend rows={s.ring.filter((x) => x.value > 0).map((x) => ({ color: x.color, label: GROUP_LABEL[x.key], value: `${x.value} kg`, dim: !!grp && grp !== x.key }))} />
              </View>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(staggerDelay(2)).duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, gap: 10 }}>
            <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>Kilograms per week</Text>
            <BarChart data={s.bars} color={grp && grp !== "white" ? GROUP_COLORS[grp] : t.colors.accent} height={110} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(staggerDelay(3)).duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, gap: 10 }}>
            <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>Wash days · {WEEKS} weeks</Text>
            <View style={{ width: WEEKS * 21, alignSelf: "center" }}>
              <Heatmap cells={s.cells} colorForIntensity={heat} cellSize={18} gap={3} />
            </View>
            <Text style={{ ...t.typography.caption, color: t.colors.inkFaint }}>Rows Mon → Sun, columns are weeks.</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(staggerDelay(4)).duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, gap: 10 }}>
            <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>Learned color risk</Text>
            <BleedMatrix model={bleed} labels={GROUP_LABEL} />
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
              From {s.reported.length} reported washes ({s.ran} with colors running). Above 50% a mix is never planned.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(staggerDelay(5)).duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, gap: 10 }}>
            <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>Drum fill · last 10 washes, %</Text>
            <BarChart data={s.fills} color={t.colors.foam} height={90} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(staggerDelay(6)).duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, gap: 8 }}>
            <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>Shortest wardrobe runway</Text>
            {s.stock.map(({ x, days }) => (
              <View key={x.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: GROUP_COLORS[x.color] }} />
                <Text style={{ ...t.typography.body, color: t.colors.ink, flex: 1 }}>{x.name}</Text>
                <Text style={{ ...t.typography.label, color: days < 4 ? t.colors.coral : t.colors.inkMuted }}>{isFinite(days) ? `${days.toFixed(1)} days from clean` : "—"}</Text>
              </View>
            ))}
            <Text style={{ ...t.typography.caption, color: t.colors.inkFaint }}>How long a fully clean stock lasts at your usual pace — short runways need frequent washes.</Text>
          </Animated.View>
        </ScrollView>
      )}
    </View>
  );
}
