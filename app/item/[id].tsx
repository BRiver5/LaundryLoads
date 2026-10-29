import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Ban, TriangleAlert } from "lucide-react-native";
import { useTheme } from "../../src/theme";
import { GROUP_COLORS, GROUP_LABEL } from "../../src/theme/colors";
import { staggerDelay } from "../../src/theme/motion";
import { useApp } from "../../src/store/appStore";
import { useWeek } from "../../src/ui/derive";
import { goBack } from "../../src/ui/nav";
import { PressableScale } from "../../src/components/PressableScale";
import { BarChart } from "../../src/components/BarChart";
import { Chip, Stepper } from "../../src/components/Bits";
import { Toggle } from "../../src/components/Toggle";
import { StockBar } from "../../src/components/Widgets";
import { updateType } from "../../src/data/repo";
import { pairVerdict } from "../../src/lib/laundry";
import { addDays } from "../../src/lib/time";

export default function ItemScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { types, adds, bleed, hamper, today, refresh } = useApp();
  const w = useWeek();
  const row = types.find((x) => x.id === id);
  const item = w.items.get(id ?? "");
  if (!row || !item) return null;

  const others = types.filter((x) => x.id !== row.id).map((x) => ({ x, v: pairVerdict(bleed, item, w.items.get(x.id)!) }));
  const never = others.filter((o) => o.v.hard);
  const risky = others.filter((o) => !o.v.hard && o.v.risk > 0.05).sort((a, b) => b.v.risk - a.v.risk);
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const bars = days.map((d) => ({ label: d === today ? "T" : String(Number(d.slice(8))), value: adds.filter((a) => a.type_id === row.id && a.day === d).reduce((s, a) => s + a.pieces, 0) }));
  const inHamper = hamper.find((h) => h.type_id === row.id)?.pieces ?? 0;
  const save = async (patch: Parameters<typeof updateType>[1]) => {
    await updateType(row.id, patch);
    await refresh();
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
        <PressableScale accessibilityLabel="Back" onPress={goBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.surface, alignItems: "center", justifyContent: "center" }}>
          <ArrowLeft size={20} color={t.colors.ink} />
        </PressableScale>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: GROUP_COLORS[row.color], borderWidth: 2, borderColor: t.colors.surface }} />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ ...t.typography.subtitle, color: t.colors.ink }}>{row.name}</Text>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
            {GROUP_LABEL[row.color]} · up to {row.max_temp}° · {row.kg.toFixed(2)} kg each
          </Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 40 }}>
        <Animated.View entering={FadeInDown.duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, gap: 12 }}>
          <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>Clean stock</Text>
          <StockBar clean={w.clean[row.id]} owned={row.owned} days={inHamper ? w.runOut[row.id] : Infinity} color={GROUP_COLORS[row.color]} />
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
            You go through about {w.rate[row.id].toFixed(1)} a day (learned from what goes into the hamper, older days fade). {inHamper} in the hamper now.
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ ...t.typography.label, color: t.colors.ink }}>You own</Text>
            <Stepper value={row.owned} min={1} max={60} onChange={(v) => save({ owned: v })} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(staggerDelay(1)).duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, gap: 10 }}>
          <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>Care label</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[30, 40, 60].map((x) => (
              <Chip key={x} label={`${x}°`} active={row.max_temp === x} onPress={() => save({ max_temp: x, want_temp: x })} />
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(["white", "light", "dark", "bleed"] as const).map((c) => (
              <Chip key={c} label={GROUP_LABEL[c]} color={GROUP_COLORS[c]} active={row.color === c} onPress={() => save({ color: c })} />
            ))}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ ...t.typography.label, color: t.colors.ink }}>Delicate cycle</Text>
            <Toggle value={row.care === "delicate"} onValueChange={(v) => save({ care: v ? "delicate" : "normal" })} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ ...t.typography.label, color: t.colors.ink }}>Dryer safe</Text>
            <Toggle value={row.dryer === 1} onValueChange={(v) => save({ dryer: v ? 1 : 0 })} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(staggerDelay(2)).duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, gap: 8 }}>
          <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>Never washed with</Text>
          {never.length === 0 ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Goes with anything in your wardrobe.</Text> : null}
          {never.map((o) => (
            <View key={o.x.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ban size={14} color={t.colors.coral} />
              <Text style={{ ...t.typography.body, color: t.colors.ink, flex: 1 }}>{o.x.name}</Text>
              <Text style={{ ...t.typography.caption, color: t.colors.coral }}>{Math.round(o.v.risk * 100)}%</Text>
            </View>
          ))}
          {risky.length ? <Text style={{ ...t.typography.overline, color: t.colors.inkMuted, marginTop: 6 }}>Allowed, with some risk</Text> : null}
          {risky.map((o) => (
            <View key={o.x.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <TriangleAlert size={14} color={t.colors.signal} />
              <Text style={{ ...t.typography.body, color: t.colors.ink, flex: 1 }}>{o.x.name}</Text>
              <Text style={{ ...t.typography.caption, color: t.colors.signal }}>{Math.round(o.v.risk * 100)}%</Text>
            </View>
          ))}
          <Text style={{ ...t.typography.caption, color: t.colors.inkFaint }}>Risks are learned from your "colors ran / all clean" answers after each wash.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(staggerDelay(3)).duration(400)} style={{ backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, gap: 10 }}>
          <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>Into the hamper · last 14 days</Text>
          <BarChart data={bars} color={GROUP_COLORS[row.color] === "#C7D0D6" ? t.colors.foam : GROUP_COLORS[row.color]} height={90} />
        </Animated.View>
      </ScrollView>
    </View>
  );
}
