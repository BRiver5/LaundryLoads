import { useState } from "react";
import { FlatList, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { router } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BarChart3, CalendarDays, Info, Play, Plus, Settings2, ShoppingBasket, Wind } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { GROUP_COLORS } from "../src/theme/colors";
import { staggerDelay } from "../src/theme/motion";
import { useApp } from "../src/store/appStore";
import { useWeek } from "../src/ui/derive";
import { PressableScale } from "../src/components/PressableScale";
import { LoadDrum, StockBar } from "../src/components/Widgets";
import { AddSheet, BurstOverlay, RunSheet, TypeSheet, WhySheet } from "../src/components/Sheets";
import { reportWash } from "../src/data/repo";
import { dayLabel, weekdayLabel } from "../src/lib/time";
import { plural } from "../src/ui/format";
import { haptics } from "../src/services/haptics";
import type { Load } from "../src/lib/packer";

export default function Home() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { types, washes, today, settings, refresh } = useApp();
  const w = useWeek();
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<string | null>(null);
  const [add, setAdd] = useState<string | null | undefined>(undefined);
  const [newType, setNewType] = useState(false);
  const [run, setRun] = useState<Load | null>(null);
  const [why, setWhy] = useState<Load | null>(null);
  const [burst, setBurst] = useState<string | null>(null);

  const slots = w.sched.slots;
  const cardW = width - 32;
  const low = types
    .map((x) => ({ x, days: w.runOut[x.id] }))
    .filter((r) => isFinite(r.days) && r.days < 4)
    .sort((a, b) => a.days - b.days);
  const unreported = washes.find((x) => x.ran === null);
  const hamperKg = w.entries.reduce((s, e) => s + e.type.kg * e.pieces, 0);

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 10, paddingBottom: 4 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...t.typography.overline, color: t.colors.accent }}>Laundry Loads</Text>
          <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>
            {weekdayLabel(today)}, {dayLabel(today)} · hamper {hamperKg.toFixed(1)} kg
          </Text>
        </View>
        {[
          { l: "Hamper", i: <ShoppingBasket size={18} color={t.colors.ink} />, go: "/hamper" as const },
          { l: "Week", i: <CalendarDays size={18} color={t.colors.ink} />, go: "/plan" as const },
          { l: "Stats", i: <BarChart3 size={18} color={t.colors.ink} />, go: "/stats" as const },
          { l: "Settings", i: <Settings2 size={18} color={t.colors.ink} />, go: "/settings" as const },
        ].map((b) => (
          <PressableScale key={b.l} accessibilityLabel={b.l} onPress={() => router.push(b.go)} style={{ width: 38, height: 38, borderRadius: 19, marginLeft: 6, backgroundColor: t.colors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: t.colors.border }}>
            {b.i}
          </PressableScale>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {slots.length === 0 ? (
          <Animated.View entering={FadeInDown.duration(400)} style={{ margin: 16, backgroundColor: t.colors.surface, borderRadius: 28, padding: 22, gap: 14 }}>
            <Text style={{ ...t.typography.title, color: t.colors.ink }}>The hamper is empty</Text>
            {["Drop laundry in as you take it off — a tap per item type.", "The app sorts the hamper into the fewest safe loads.", "It plans the week so towels and gym wear never run out."].map((x, i) => (
              <Animated.View key={x} entering={FadeInDown.delay(staggerDelay(i + 1)).duration(400)} style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: t.colors.accentSoft, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ ...t.typography.label, color: t.colors.accent }}>{i + 1}</Text>
                </View>
                <Text style={{ ...t.typography.body, color: t.colors.ink, flex: 1 }}>{x}</Text>
              </Animated.View>
            ))}
          </Animated.View>
        ) : (
          <>
            <FlatList
              data={slots}
              horizontal
              pagingEnabled
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(s, i) => `${i}-${s.day}`}
              onMomentumScrollEnd={(e) => {
                setPage(Math.round(e.nativeEvent.contentOffset.x / width));
                setSel(null);
              }}
              renderItem={({ item: s, index }) => {
                const L = s.load;
                const picked = L.entries.find((e) => e.type.id === sel);
                return (
                  <View style={{ width, paddingHorizontal: 16, paddingTop: 10 }}>
                    <Animated.View entering={FadeInDown.duration(450)} style={{ width: cardW, backgroundColor: t.colors.surface, borderRadius: 30, padding: 18, gap: 12 }}>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ ...t.typography.overline, color: s.late ? t.colors.coral : t.colors.inkMuted }}>
                            Load {index + 1} of {slots.length} · {w.dayName(s.day)}
                            {s.late ? ` · ${plural(s.late, "day")} late` : ""}
                          </Text>
                          <Text style={{ ...t.typography.title, color: t.colors.ink }}>
                            {L.cost.temp}° {L.cost.delicate ? "delicate" : "normal"}
                          </Text>
                        </View>
                        <PressableScale accessibilityLabel={`Why load ${index + 1}`} onPress={() => setWhy(L)} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: t.colors.accentSoft }}>
                          <Info size={14} color={t.colors.accent} />
                          <Text style={{ ...t.typography.label, color: t.colors.accent }}>Why</Text>
                        </PressableScale>
                      </View>
                      <LoadDrum
                        entries={L.entries}
                        capKg={settings.capKg}
                        size={Math.min(250, cardW - 40)}
                        selected={sel}
                        onSelect={setSel}
                        center={
                          picked ? (
                            <>
                              <Text numberOfLines={2} style={{ ...t.typography.label, color: t.colors.ink, textAlign: "center" }}>{picked.type.name}</Text>
                              <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>× {picked.pieces}</Text>
                            </>
                          ) : (
                            <>
                              <Text style={{ fontSize: 26, fontWeight: "800", color: t.colors.ink }}>{L.cost.kg.toFixed(1)}</Text>
                              <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>of {settings.capKg} kg</Text>
                            </>
                          )
                        }
                      />
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                        {L.entries.map((e) => (
                          <PressableScale key={e.type.id} accessibilityLabel={`Piece ${e.type.name}`} onPress={() => setSel(sel === e.type.id ? null : e.type.id)} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: sel === e.type.id ? t.colors.accentSoft : t.colors.surfaceAlt }}>
                            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: GROUP_COLORS[e.type.color] }} />
                            <Text numberOfLines={1} style={{ ...t.typography.label, color: t.colors.ink }}>
                              {e.type.name} × {e.pieces}
                            </Text>
                          </PressableScale>
                        ))}
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Wind size={14} color={t.colors.inkMuted} />
                        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted, flex: 1 }}>
                          {s.dryer ? "Dryer afterwards" : "Air-dry on the rack"}
                          {isFinite(s.deadline) && s.deadline < 6 ? ` · needed by ${w.dayName(s.deadline)}` : ""}
                        </Text>
                      </View>
                      {s.day === 0 ? (
                        <PressableScale accessibilityLabel={`Start load ${index + 1}`} onPress={() => { haptics.press(); setRun(L); }} style={{ flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingVertical: 13, borderRadius: 999, backgroundColor: t.colors.accent }}>
                          <Play size={18} color="#FFFFFF" />
                          <Text style={{ ...t.typography.subtitle, color: "#FFFFFF" }}>Start this load</Text>
                        </PressableScale>
                      ) : (
                        <PressableScale accessibilityLabel={`Start early ${index + 1}`} onPress={() => setRun(L)} style={{ alignItems: "center", paddingVertical: 12, borderRadius: 999, backgroundColor: t.colors.surfaceAlt }}>
                          <Text style={{ ...t.typography.label, color: t.colors.accent }}>Start it now anyway</Text>
                        </PressableScale>
                      )}
                    </Animated.View>
                  </View>
                );
              }}
            />
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10 }}>
              {slots.map((_, i) => (
                <View key={i} style={{ width: i === page ? 18 : 7, height: 7, borderRadius: 4, backgroundColor: i === page ? t.colors.accent : t.colors.border }} />
              ))}
            </View>
          </>
        )}

        <View style={{ paddingHorizontal: 16, marginTop: 14 }}>
          <PressableScale
            accessibilityLabel="Add to hamper"
            onPress={() => {
              haptics.press();
              setAdd(null);
            }}
            style={{ flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 999, backgroundColor: slots.length ? t.colors.ink : t.colors.accent }}
          >
            <Plus size={18} color="#FFFFFF" />
            <Text style={{ ...t.typography.subtitle, color: "#FFFFFF" }}>Add to hamper</Text>
          </PressableScale>
        </View>

        {unreported ? (
          <Animated.View entering={FadeInDown.delay(staggerDelay(1)).duration(400)} style={{ margin: 16, marginBottom: 0, backgroundColor: t.colors.surface, borderRadius: 22, padding: 16, gap: 10 }}>
            <Text style={{ ...t.typography.label, fontSize: 15, color: t.colors.ink }}>How did the {unreported.temp}° load from {dayLabel(unreported.day)} come out?</Text>
            <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>Your answer teaches the planner which color mixes are safe for your clothes.</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <PressableScale accessibilityLabel="All clean" onPress={async () => { await reportWash(unreported.id, false, today); await refresh(); haptics.success(); setBurst("Noted — mix looks safe"); }} style={{ flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 999, backgroundColor: t.colors.freshSoft }}>
                <Text style={{ ...t.typography.label, color: t.colors.fresh }}>All clean</Text>
              </PressableScale>
              <PressableScale accessibilityLabel="Colors ran" onPress={async () => { await reportWash(unreported.id, true, today); await refresh(); haptics.warning(); }} style={{ flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 999, backgroundColor: t.colors.coralSoft }}>
                <Text style={{ ...t.typography.label, color: t.colors.coral }}>Colors ran</Text>
              </PressableScale>
            </View>
          </Animated.View>
        ) : null}

        {low.length ? (
          <View style={{ margin: 16, marginBottom: 0, gap: 10 }}>
            <Text style={{ ...t.typography.overline, color: t.colors.inkMuted }}>Running low</Text>
            {low.map((r, i) => (
              <Animated.View key={r.x.id} entering={FadeInDown.delay(staggerDelay(i + 2)).duration(400)}>
                <PressableScale accessibilityLabel={`Stock ${r.x.name}`} onPress={() => router.push({ pathname: "/item/[id]", params: { id: r.x.id } })} style={{ backgroundColor: t.colors.surface, borderRadius: 18, padding: 14, gap: 8 }}>
                  <Text style={{ ...t.typography.label, fontSize: 15, color: t.colors.ink }}>{r.x.name}</Text>
                  <StockBar clean={w.clean[r.x.id]} owned={r.x.owned} days={r.days} color={GROUP_COLORS[r.x.color]} />
                </PressableScale>
              </Animated.View>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <AddSheet visible={add !== undefined} preset={add ?? null} onClose={() => setAdd(undefined)} onSaved={setBurst} onNewType={() => { setAdd(undefined); setNewType(true); }} />
      <TypeSheet visible={newType} onClose={() => setNewType(false)} onSaved={(m) => { setBurst(m); setAdd(null); }} />
      <RunSheet load={run} dryer={!!run && w.caps.dryer && run.entries.every((e) => e.type.dryer)} onClose={() => setRun(null)} onDone={setBurst} />
      <WhySheet load={why} onClose={() => setWhy(null)} />
      <BurstOverlay msg={burst} onDone={() => setBurst(null)} />
    </View>
  );
}
