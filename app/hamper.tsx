import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Minus, Plus, Search, X } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { GROUP_COLORS, GROUP_LABEL } from "../src/theme/colors";
import { staggerDelay } from "../src/theme/motion";
import { useApp } from "../src/store/appStore";
import { useWeek } from "../src/ui/derive";
import { goBack } from "../src/ui/nav";
import { PressableScale } from "../src/components/PressableScale";
import { SwipeRow } from "../src/components/SwipeRow";
import { Stepper } from "../src/components/Bits";
import { Sheet } from "../src/components/Sheet";
import { AddSheet, BurstOverlay, TypeSheet } from "../src/components/Sheets";
import { setHamper, toHamper } from "../src/data/repo";
import { COLOR_ORDER } from "../src/lib/laundry";
import { haptics } from "../src/services/haptics";

export default function Hamper() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { types, hamper, today, refresh } = useApp();
  const w = useWeek();
  const [q, setQ] = useState("");
  const [add, setAdd] = useState<string | null | undefined>(undefined);
  const [newType, setNewType] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [burst, setBurst] = useState<string | null>(null);
  const query = q.trim().toLowerCase();
  const inH = (id: string) => hamper.find((h) => h.type_id === id)?.pieces ?? 0;
  const list = types.filter((x) => !query || x.name.toLowerCase().includes(query));
  const groups = COLOR_ORDER.map((c) => ({ c, items: list.filter((x) => x.color === c) })).filter((g) => g.items.length);

  // Липкие заголовки групп: первый ребёнок — пустой, дальше пары «заголовок, строки».
  const children: React.ReactNode[] = [];
  const sticky: number[] = [];
  groups.forEach((g) => {
    const kg = g.items.reduce((s, x) => s + inH(x.id) * x.kg, 0);
    sticky.push(children.length + 1);
    children.push(
      <View key={`h${g.c}`} style={{ backgroundColor: t.colors.background, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: GROUP_COLORS[g.c] }} />
          <Text style={{ ...t.typography.overline, color: t.colors.inkMuted, flex: 1 }}>{GROUP_LABEL[g.c]}</Text>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{kg.toFixed(1)} kg in hamper</Text>
        </View>
      </View>
    );
    children.push(
      <View key={`b${g.c}`} style={{ paddingHorizontal: 16, gap: 8 }}>
        {g.items.map((x, i) => {
          const n = inH(x.id);
          const days = w.runOut[x.id];
          return (
            <Animated.View key={x.id} entering={FadeInDown.delay(staggerDelay(i)).duration(350)}>
              <SwipeRow
                right={{ label: "+1", icon: <Plus size={18} color="#FFFFFF" />, onTrigger: async () => { await toHamper(x.id, 1, today); await refresh(); } }}
                left={{ label: "Clear", icon: <Minus size={18} color="#FFFFFF" />, onTrigger: async () => { await setHamper(x.id, 0); await refresh(); } }}
              >
                <PressableScale
                  accessibilityLabel={`Hamper ${x.name}`}
                  onPress={() => router.push({ pathname: "/item/[id]", params: { id: x.id } })}
                  onLongPress={() => {
                    haptics.press();
                    setMenu(x.id);
                  }}
                  style={{ backgroundColor: t.colors.surface, borderRadius: 16, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, opacity: n ? 1 : 0.7 }}
                >
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ ...t.typography.label, fontSize: 15, color: t.colors.ink }}>{x.name}</Text>
                    <Text numberOfLines={1} style={{ ...t.typography.caption, color: isFinite(days) && days < 2 ? t.colors.coral : t.colors.inkMuted }}>
                      {x.max_temp}° {x.care === "delicate" ? "delicate" : ""} · {w.clean[x.id]} clean{isFinite(days) ? ` · ~${Math.floor(days)}d left` : ""}
                    </Text>
                  </View>
                  <Stepper value={n} min={0} max={60} onChange={async (v) => { await setHamper(x.id, v); await refresh(); }} />
                </PressableScale>
              </SwipeRow>
            </Animated.View>
          );
        })}
      </View>
    );
  });

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>
        <PressableScale accessibilityLabel="Back" onPress={goBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.surface, alignItems: "center", justifyContent: "center" }}>
          <ArrowLeft size={20} color={t.colors.ink} />
        </PressableScale>
        <View style={{ flex: 1 }}>
          <Text style={{ ...t.typography.subtitle, color: t.colors.ink }}>Hamper & wardrobe</Text>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{w.packing.loads.length} loads' worth · {w.entries.reduce((s, e) => s + e.pieces, 0)} pieces</Text>
        </View>
        <PressableScale accessibilityLabel="Add laundry" onPress={() => setAdd(null)} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: t.colors.accent }}>
          <Plus size={16} color="#FFFFFF" />
          <Text style={{ ...t.typography.label, color: "#FFFFFF" }}>Add</Text>
        </PressableScale>
      </View>
      <View style={{ paddingHorizontal: 16, paddingBottom: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: t.colors.surface, borderRadius: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: t.colors.border }}>
          <Search size={16} color={t.colors.inkFaint} />
          <TextInput value={q} onChangeText={setQ} placeholder="Find an item type" placeholderTextColor={t.colors.inkFaint} style={{ flex: 1, paddingVertical: 9, color: t.colors.ink, ...t.typography.body }} />
          {q ? (
            <PressableScale accessibilityLabel="Clear search" onPress={() => setQ("")}>
              <X size={16} color={t.colors.inkMuted} />
            </PressableScale>
          ) : null}
        </View>
      </View>
      <ScrollView stickyHeaderIndices={sticky} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View />
        {children}
        {types.length === 0 ? <Text style={{ ...t.typography.body, color: t.colors.inkMuted, padding: 20 }}>No laundry types yet — tap Add and pick from common items.</Text> : list.length === 0 ? <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, padding: 20 }}>Nothing matches “{q}”.</Text> : null}
        {types.length ? <Text style={{ ...t.typography.caption, color: t.colors.inkFaint, textAlign: "center", marginTop: 10 }}>Swipe right for +1 · left to clear · hold for more</Text> : null}
      </ScrollView>
      <AddSheet visible={add !== undefined} preset={add ?? null} onClose={() => setAdd(undefined)} onSaved={setBurst} onNewType={() => { setAdd(undefined); setNewType(true); }} />
      <TypeSheet visible={newType} onClose={() => setNewType(false)} onSaved={setBurst} />
      <Sheet visible={!!menu} onClose={() => setMenu(null)} title={types.find((x) => x.id === menu)?.name ?? ""} subtitle="Quick actions">
        {menu
          ? [
              { l: "Add some to the hamper", run: () => setAdd(menu) },
              { l: "Open care & stock", run: () => router.push({ pathname: "/item/[id]", params: { id: menu } }) },
            ].map((a) => (
              <PressableScale key={a.l} accessibilityLabel={a.l} onPress={() => { setMenu(null); a.run(); }} style={{ paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, backgroundColor: t.colors.surfaceAlt }}>
                <Text style={{ ...t.typography.body, color: t.colors.ink }}>{a.l}</Text>
              </PressableScale>
            ))
          : null}
      </Sheet>
      <BurstOverlay msg={burst} onDone={() => setBurst(null)} />
    </View>
  );
}
