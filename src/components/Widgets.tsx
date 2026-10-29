import { useEffect } from "react";
import { Pressable, Text, View, type GestureResponderEvent } from "react-native";
import Svg, { Circle, G, Path } from "react-native-svg";
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme";
import { GROUP_COLORS } from "../theme/colors";
import { PressableScale } from "./PressableScale";
import { haptics } from "../services/haptics";
import type { Entry } from "../lib/packer";
import { COLOR_ORDER, bleedRisk, type BleedModel } from "../lib/laundry";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const TAU = Math.PI * 2;

function sector(cx: number, r0: number, r1: number, a0: number, a1: number) {
  const p = (r: number, a: number) => `${cx + r * Math.cos(a)} ${cx + r * Math.sin(a)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${p(r1, a0)} A ${r1} ${r1} 0 ${large} 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 ${large} 0 ${p(r0, a0)} Z`;
}

// Барабан машины: внешнее кольцо — заполнение по весу, за «стеклом» дверцы —
// сектора вещей (доля ∝ килограммам, цвет — цветовая группа). Тап по сектору
// выбирает вещь, повторный — снимает выбор.
export function LoadDrum({ entries, capKg, size = 230, selected, onSelect, center }: { entries: Entry[]; capKg: number; size?: number; selected: string | null; onSelect: (id: string | null) => void; center?: React.ReactNode }) {
  const t = useTheme();
  const c = size / 2;
  const ringR = c - 10;
  const C = TAU * ringR;
  const kg = entries.reduce((s, e) => s + e.type.kg * e.pieces, 0);
  const fill = Math.min(1, kg / capKg);
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = 0;
    p.value = withTiming(fill, { duration: 750, easing: Easing.out(Easing.cubic) });
  }, [fill]);
  const ring = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - p.value) }));
  const r1 = c - 30;
  const r0 = r1 * 0.48;
  let acc = 0;
  const segs = entries.map((e) => {
    const f = (e.type.kg * e.pieces) / Math.max(kg, 1e-9);
    const s = { e, a0: acc * TAU - Math.PI / 2, a1: (acc + f) * TAU - Math.PI / 2 };
    acc += f;
    return s;
  });
  const onPress = (ev: GestureResponderEvent) => {
    const dx = ev.nativeEvent.locationX - c;
    const dy = ev.nativeEvent.locationY - c;
    const d = Math.hypot(dx, dy);
    if (d < r0 || d > r1) return onSelect(null);
    let a = Math.atan2(dy, dx);
    if (a < -Math.PI / 2) a += TAU;
    const hit = segs.find((s) => a >= s.a0 && a < s.a1);
    if (hit) {
      haptics.tick();
      onSelect(selected === hit.e.type.id ? null : hit.e.type.id);
    }
  };
  return (
    <Pressable onPress={onPress} accessibilityLabel="Load drum, tap a slice" style={{ width: size, height: size, alignSelf: "center" }}>
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={ringR} stroke={t.colors.accentSoft} strokeWidth={10} fill="none" />
        <G rotation={-90} originX={c} originY={c}>
          <AnimatedCircle cx={c} cy={c} r={ringR} stroke={fill > 0.95 ? t.colors.coral : t.colors.accent} strokeWidth={10} strokeDasharray={`${C} ${C}`} animatedProps={ring} strokeLinecap="round" fill="none" />
        </G>
        <Circle cx={c} cy={c} r={r1 + 8} fill={t.colors.surfaceAlt} stroke={t.colors.border} strokeWidth={6} />
        {segs.length === 1 ? (
          <Circle cx={c} cy={c} r={(r0 + r1) / 2} stroke={GROUP_COLORS[segs[0].e.type.color]} strokeWidth={r1 - r0} fill="none" strokeOpacity={selected && selected !== segs[0].e.type.id ? 0.3 : 1} />
        ) : (
          segs.map((s) => (
            <Path key={s.e.type.id} d={sector(c, r0, selected === s.e.type.id ? r1 + 5 : r1, s.a0 + 0.02, s.a1 - 0.02)} fill={GROUP_COLORS[s.e.type.color]} fillOpacity={selected && selected !== s.e.type.id ? 0.3 : 1} stroke={t.colors.surface} strokeWidth={1.5} />
          ))
        )}
        <Circle cx={c} cy={c} r={r0 - 4} fill={t.colors.surface} />
      </Svg>
      <View pointerEvents="none" style={{ position: "absolute", left: c - r0, top: c - r0, width: r0 * 2, height: r0 * 2, alignItems: "center", justifyContent: "center" }}>
        {center}
      </View>
    </Pressable>
  );
}

function Block({ h, color, delay, late, on }: { h: number; color: string; delay: number; late: boolean; on: boolean }) {
  const t = useTheme();
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = 0;
    v.value = withDelay(delay, withTiming(h, { duration: 500, easing: Easing.out(Easing.cubic) }));
  }, [h, delay]);
  const st = useAnimatedStyle(() => ({ height: v.value }));
  return <Animated.View style={[{ width: "100%", borderRadius: 8, backgroundColor: color, borderWidth: on ? 2.5 : late ? 2 : 0, borderColor: on ? t.colors.ink : t.colors.coral }, st]} />;
}

export type LaneLoad = { key: string; day: number; kg: number; color: string; late: boolean; deadline: number };

// Неделя полосами: столбец — день, блоки — стирки (высота ∝ кг); красная
// рамка — опаздывает к дню, когда кончится нужная вещь. Тап по блоку — выбор.
export function WeekLanes({ loads, labels, capKg, caps, selected, onSelect }: { loads: LaneLoad[]; labels: string[]; capKg: number; caps: number[]; selected: string | null; onSelect: (k: string | null) => void }) {
  const t = useTheme();
  const H = 120;
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {labels.map((l, d) => {
        const mine = loads.filter((x) => x.day === d);
        return (
          <View key={l} style={{ flex: 1, alignItems: "center", gap: 6 }}>
            <View style={{ height: H, width: "100%", justifyContent: "flex-end", gap: 4, backgroundColor: t.colors.surfaceAlt, borderRadius: 10, padding: 3 }}>
              {mine.map((x, i) => (
                <PressableScale key={x.key} accessibilityLabel={`Lane ${l} ${i + 1}`} onPress={() => onSelect(selected === x.key ? null : x.key)}>
                  <Block h={Math.max(14, ((H - 10) / Math.max(1, caps[d])) * Math.min(1, x.kg / capKg))} color={x.color} delay={d * 50 + i * 60} late={x.late} on={selected === x.key} />
                </PressableScale>
              ))}
            </View>
            <Text numberOfLines={1} style={{ ...t.typography.caption, fontSize: 11, color: d === 0 ? t.colors.accent : t.colors.inkMuted, fontWeight: d === 0 ? "700" : "400" }}>
              {l}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// Запас чистого: заполненная часть — сколько осталось из имеющегося; подпись — на сколько дней хватит.
export function StockBar({ clean, owned, days, color }: { clean: number; owned: number; days: number; color: string }) {
  const t = useTheme();
  const w = useSharedValue(0);
  const frac = owned > 0 ? clean / owned : 0;
  useEffect(() => {
    w.value = 0;
    w.value = withTiming(frac, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [frac]);
  const st = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  const tone = days < 1.5 ? t.colors.coral : days < 3.5 ? t.colors.signal : t.colors.fresh;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: t.colors.surfaceAlt, overflow: "hidden", flexDirection: "row" }}>
        <Animated.View style={[{ height: 10, borderRadius: 5, backgroundColor: color }, st]} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
          {clean} of {owned} clean
        </Text>
        <Text style={{ ...t.typography.label, color: tone }}>{isFinite(days) ? (days < 1 ? "out today" : `~${Math.floor(days)} days left`) : "plenty"}</Text>
      </View>
    </View>
  );
}

// Выученный риск прокраса по парам цветовых групп: 4×4, ячейка — вероятность.
export function BleedMatrix({ model, labels }: { model: BleedModel; labels: Record<string, string> }) {
  const t = useTheme();
  const cell = (p: number) => (p < 0.05 ? t.colors.freshSoft : p < 0.25 ? "#F2E2B8" : p < 0.5 ? "#EDB59F" : t.colors.coral);
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", gap: 4, paddingLeft: 64 }}>
        {COLOR_ORDER.map((c) => (
          <Text key={c} numberOfLines={1} style={{ flex: 1, ...t.typography.caption, fontSize: 10, color: t.colors.inkMuted, textAlign: "center" }}>
            {labels[c]}
          </Text>
        ))}
      </View>
      {COLOR_ORDER.map((r) => (
        <View key={r} style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
          <Text numberOfLines={1} style={{ width: 60, ...t.typography.caption, fontSize: 11, color: t.colors.inkMuted }}>
            {labels[r]}
          </Text>
          {COLOR_ORDER.map((c) => {
            const p = bleedRisk(model, r, c).p;
            return (
              <View key={c} style={{ flex: 1, height: 30, borderRadius: 8, backgroundColor: r === c ? t.colors.surfaceAlt : cell(p), alignItems: "center", justifyContent: "center" }}>
                <Text style={{ ...t.typography.caption, fontSize: 11, color: t.colors.ink }}>{r === c ? "—" : `${Math.round(p * 100)}%`}</Text>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
