import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, RotateCcw } from "lucide-react-native";
import { useTheme } from "../src/theme";
import { staggerDelay } from "../src/theme/motion";
import { useApp } from "../src/store/appStore";
import { goBack } from "../src/ui/nav";
import { PressableScale } from "../src/components/PressableScale";
import { Stepper } from "../src/components/Bits";
import { Toggle } from "../src/components/Toggle";
import { resetAll, saveSetting } from "../src/data/repo";

// Settings — сгруппированный список секций в духе iOS: заголовок группы, строки в одной карточке.
export default function SettingsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, refresh } = useApp();
  const [confirm, setConfirm] = useState(false);
  const save = async (k: string, v: string) => {
    await saveSetting(k, v);
    await refresh();
  };
  const row = (title: string, note: string, control: React.ReactNode, last = false) => (
    <View key={title} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: t.colors.border }}>
      <View style={{ flex: 1 }}>
        <Text style={{ ...t.typography.body, color: t.colors.ink }}>{title}</Text>
        <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{note}</Text>
      </View>
      {control}
    </View>
  );
  const group = (i: number, title: string, rows: React.ReactNode[]) => (
    <Animated.View key={title} entering={FadeInDown.delay(staggerDelay(i)).duration(400)} style={{ gap: 6 }}>
      <Text style={{ ...t.typography.overline, color: t.colors.inkMuted, paddingHorizontal: 6 }}>{title}</Text>
      <View style={{ backgroundColor: t.colors.surface, borderRadius: 18, paddingHorizontal: 14 }}>{rows}</View>
    </Animated.View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: t.colors.background, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}>
        <PressableScale accessibilityLabel="Back" onPress={goBack} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.surface, alignItems: "center", justifyContent: "center" }}>
          <ArrowLeft size={20} color={t.colors.ink} />
        </PressableScale>
        <Text style={{ ...t.typography.subtitle, color: t.colors.ink }}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: insets.bottom + 40 }}>
        {group(0, "Machine", [
          row("Drum size", "Dry laundry it takes per load.", <Stepper value={settings.capKg} step={0.5} min={3} max={12} format={(v) => `${v} kg`} onChange={(v) => save("capKg", String(v))} />),
          row("Loads a day", "How many washes you're happy to run.", <Stepper value={settings.loadsPerDay} min={1} max={4} onChange={(v) => save("loadsPerDay", String(v))} />, true),
        ])}
        {group(1, "Drying", [
          row("Rack space", "Air-dry kilograms per day.", <Stepper value={settings.rackKg} step={0.5} min={1} max={15} format={(v) => `${v} kg`} onChange={(v) => save("rackKg", String(v))} />),
          row("Tumble dryer", "Dryer-safe loads skip the rack.", <Toggle value={settings.dryer} onValueChange={(v) => save("dryer", v ? "1" : "0")} />, true),
        ])}
        {group(2, "App", [row("Vibration", "Light taps on swipes and saves.", <Toggle value={settings.haptics} onValueChange={(v) => save("haptics", v ? "1" : "0")} />, true)])}
        <Animated.View entering={FadeInDown.delay(staggerDelay(3)).duration(400)}>
          <PressableScale
            accessibilityLabel={confirm ? "Tap again to erase" : "Erase all data"}
            onPress={async () => {
              if (!confirm) return setConfirm(true);
              await resetAll();
              await refresh();
              setConfirm(false);
              goBack();
            }}
            style={{ flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 999, backgroundColor: confirm ? t.colors.danger : t.colors.surface }}
          >
            <RotateCcw size={16} color={confirm ? "#FFFFFF" : t.colors.danger} />
            <Text style={{ ...t.typography.label, color: confirm ? "#FFFFFF" : t.colors.danger }}>{confirm ? "Tap again to erase everything" : "Erase all data"}</Text>
          </PressableScale>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
