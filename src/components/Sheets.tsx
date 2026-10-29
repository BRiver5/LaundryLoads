import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { Shirt } from "lucide-react-native";
import { useTheme } from "../theme";
import { GROUP_COLORS, GROUP_LABEL } from "../theme/colors";
import { Sheet, Field, inputStyle } from "./Sheet";
import { Chip, Stepper } from "./Bits";
import { Segmented } from "./Segmented";
import { Toggle } from "./Toggle";
import { PrimaryButton } from "./PrimaryButton";
import { SuccessBurst } from "./SuccessBurst";
import { useApp } from "../store/appStore";
import { addType, runWash, toHamper } from "../data/repo";
import { PRESETS } from "../data/presets";
import { pairVerdict, type ColorGroup } from "../lib/laundry";
import type { Load } from "../lib/packer";
import { haptics } from "../services/haptics";

export function AddSheet({ visible, preset, onClose, onSaved, onNewType }: { visible: boolean; preset: string | null; onClose: () => void; onSaved: (m: string) => void; onNewType: () => void }) {
  const t = useTheme();
  const { types, today, refresh } = useApp();
  const [type, setType] = useState<string | null>(null);
  const [preName, setPreName] = useState<string | null>(null);
  const [pieces, setPieces] = useState(2);
  const [q, setQ] = useState("");
  useEffect(() => {
    if (!visible) return;
    setType(preset);
    setPreName(null);
    setPieces(2);
    setQ("");
  }, [visible]);
  const known = new Set(types.map((x) => x.name.toLowerCase()));
  const query = q.trim().toLowerCase();
  const presets = PRESETS.filter((p) => !known.has(p.name.toLowerCase()) && (!query || p.name.toLowerCase().includes(query)));
  const shown = types.filter((x) => !query || x.name.toLowerCase().includes(query));
  const label = types.find((x) => x.id === type)?.name ?? preName;
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Into the hamper"
      subtitle="What just went into the wash basket — the planner sorts it into loads."
      footer={
        <PrimaryButton
          label={label ? `Add ${pieces} × ${label}` : "Pick what it is"}
          disabled={!label}
          onPress={async () => {
            let id = type;
            if (!id && preName) {
              const p = PRESETS.find((x) => x.name === preName)!;
              id = await addType(p);
            }
            if (!id) return;
            await toHamper(id, pieces, today);
            await refresh();
            haptics.success();
            onClose();
            onSaved(`${pieces} × ${label} in the hamper`);
          }}
        />
      }
    >
      <TextInput value={q} onChangeText={setQ} placeholder="Search laundry" placeholderTextColor={t.colors.inkFaint} style={inputStyle(t)} />
      <Field label="Your laundry">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {shown.map((x) => (
            <Chip key={x.id} a11y={`Type ${x.name}`} label={x.name} color={GROUP_COLORS[x.color]} active={type === x.id} onPress={() => { setType(x.id); setPreName(null); }} />
          ))}
          <Chip a11y="New type" label="+ New type" active={false} onPress={onNewType} />
        </View>
      </Field>
      {presets.length ? (
        <Field label="Common items">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {presets.map((p) => (
              <Chip key={p.name} a11y={`Type ${p.name}`} label={p.name} color={GROUP_COLORS[p.color]} active={preName === p.name} onPress={() => { setPreName(p.name); setType(null); }} />
            ))}
          </View>
        </Field>
      ) : null}
      <Field label="Pieces">
        <Stepper value={pieces} onChange={setPieces} min={1} max={30} />
      </Field>
    </Sheet>
  );
}

const TEMPS = [
  { key: "30", label: "30°" },
  { key: "40", label: "40°" },
  { key: "60", label: "60°" },
] as const;

export function TypeSheet({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: (m: string) => void }) {
  const t = useTheme();
  const { refresh } = useApp();
  const [name, setName] = useState("");
  const [color, setColor] = useState<ColorGroup>("light");
  const [delicate, setDelicate] = useState(false);
  const [max, setMax] = useState<"30" | "40" | "60">("40");
  const [kg, setKg] = useState(0.3);
  const [dryer, setDryer] = useState(true);
  const [owned, setOwned] = useState(5);
  useEffect(() => {
    if (!visible) return;
    setName("");
    setColor("light");
    setDelicate(false);
    setMax("40");
    setKg(0.3);
    setDryer(true);
    setOwned(5);
  }, [visible]);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="New laundry type"
      subtitle="Care rules decide what can share a load."
      footer={
        <PrimaryButton
          label="Save type"
          disabled={!name.trim()}
          onPress={async () => {
            await addType({ name: name.trim(), color, care: delicate ? "delicate" : "normal", max_temp: Number(max), want_temp: Number(max), kg, dryer: dryer ? 1 : 0, owned });
            await refresh();
            haptics.success();
            onClose();
            onSaved(`${name.trim()} saved`);
          }}
        />
      }
    >
      <Field label="Name">
        <TextInput value={name} onChangeText={setName} placeholder="e.g. Baby clothes" placeholderTextColor={t.colors.inkFaint} style={inputStyle(t)} />
      </Field>
      <Field label="Color group" hint="Bleeders are new or strongly dyed items that lose color.">
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(["white", "light", "dark", "bleed"] as ColorGroup[]).map((c) => (
            <Chip key={c} label={GROUP_LABEL[c]} color={GROUP_COLORS[c]} active={color === c} onPress={() => setColor(c)} />
          ))}
        </View>
      </Field>
      <Field label="Hottest wash on the label">
        <Segmented items={TEMPS.map((x) => ({ key: x.key, label: x.label }))} value={max} onChange={setMax} />
      </Field>
      <Field label="Weight of one piece">
        <Stepper value={kg} onChange={setKg} step={0.05} min={0.05} max={3} format={(v) => `${v.toFixed(2)} kg`} />
      </Field>
      <Field label="How many you own">
        <Stepper value={owned} onChange={setOwned} min={1} max={60} />
      </Field>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ ...t.typography.label, color: t.colors.ink }}>Delicate cycle only</Text>
        <Toggle value={delicate} onValueChange={setDelicate} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ ...t.typography.label, color: t.colors.ink }}>Dryer safe</Text>
        <Toggle value={dryer} onValueChange={setDryer} />
      </View>
    </Sheet>
  );
}

export function RunSheet({ load, dryer, onClose, onDone }: { load: Load | null; dryer: boolean; onClose: () => void; onDone: (m: string) => void }) {
  const t = useTheme();
  const { today, refresh } = useApp();
  if (!load) return null;
  return (
    <Sheet
      visible
      onClose={onClose}
      title={`Start · ${load.cost.temp}° ${load.cost.delicate ? "delicate" : "normal"}`}
      subtitle={`${load.cost.kg.toFixed(1)} kg · ${dryer ? "dryer afterwards" : "air-dry on the rack"}`}
      footer={
        <PrimaryButton
          label="It's in the machine"
          onPress={async () => {
            await runWash(load.entries.map((e) => ({ id: e.type.id, pieces: e.pieces })), load.cost.temp, load.cost.kg, today);
            await refresh();
            haptics.success();
            onClose();
            onDone(`${load.cost.temp}° load started`);
          }}
        />
      }
    >
      {load.entries.map((e) => (
        <View key={e.type.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: GROUP_COLORS[e.type.color] }} />
          <Text style={{ ...t.typography.body, color: t.colors.ink, flex: 1 }}>{e.type.name}</Text>
          <Text style={{ ...t.typography.label, color: t.colors.inkMuted }}>× {e.pieces}</Text>
        </View>
      ))}
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>These pieces leave the hamper. Later, tell the app whether any colors ran — it learns which mixes are safe.</Text>
    </Sheet>
  );
}

function Row({ label, value, note, tone }: { label: string; value: string; note: string; tone?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 2, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.colors.border }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ ...t.typography.label, color: t.colors.ink }}>{label}</Text>
        <Text style={{ ...t.typography.label, color: tone ?? t.colors.ink }}>{value}</Text>
      </View>
      <Text style={{ ...t.typography.caption, color: t.colors.inkMuted }}>{note}</Text>
    </View>
  );
}

// Почему эти вещи вместе: слагаемые стоимости загрузки и риск по каждой паре.
export function WhySheet({ load, onClose }: { load: Load | null; onClose: () => void }) {
  const t = useTheme();
  const { bleed, settings } = useApp();
  if (!load) return null;
  const c = load.cost;
  const pairs: { a: string; b: string; risk: number }[] = [];
  for (let i = 0; i < load.entries.length; i++)
    for (let j = i + 1; j < load.entries.length; j++) {
      const v = pairVerdict(bleed, load.entries[i].type, load.entries[j].type);
      if (v.risk > 0.01) pairs.push({ a: load.entries[i].type.name, b: load.entries[j].type.name, risk: v.risk });
    }
  return (
    <Sheet visible onClose={onClose} title="Why these go together" subtitle={`Score ${c.total.toFixed(2)} — lower is better. The planner picked the split of the whole hamper with the lowest total.`}>
      <Row label="One wash" value={c.base.toFixed(2)} note="Every load costs water, power and an hour — fewer loads is better." />
      <Row label="Cooler than wanted" value={`+${c.hygiene.toFixed(2)}`} tone={c.hygiene > 0 ? t.colors.signal : undefined} note={c.hygiene > 0 ? `Runs at ${c.temp}° because of the most delicate label; towels and bedding prefer 60°.` : `Everything here is happy at ${c.temp}°.`} />
      <Row label="Gentle cycle" value={`+${c.gentle.toFixed(2)}`} tone={c.gentle > 0 ? t.colors.signal : undefined} note={c.delicate ? "A delicate item puts sturdy pieces on a gentler, less thorough cycle." : "Normal cycle."} />
      <Row label="Color risk" value={`+${c.bleed.toFixed(2)}`} tone={c.bleed > 0.3 ? t.colors.coral : undefined} note={pairs.length ? pairs.map((p) => `${p.a} + ${p.b}: ${Math.round(p.risk * 100)}%`).join(" · ") : "No color mixes that have ever caused trouble."} />
      <Row label="Half-empty drum" value={`+${c.underfill.toFixed(2)}`} note={`${c.kg.toFixed(1)} of ${settings.capKg} kg.`} />
    </Sheet>
  );
}

export function BurstOverlay({ msg, onDone }: { msg: string | null; onDone: () => void }) {
  const t = useTheme();
  if (!msg) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: 80, elevation: 80 }}>
      <Animated.View entering={ZoomIn.duration(220)} style={{ backgroundColor: t.colors.surface, borderRadius: 24, paddingVertical: 20, paddingHorizontal: 28, alignItems: "center", gap: 8, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 16, elevation: 8 }}>
        <SuccessBurst visible size={72} onDone={() => setTimeout(onDone, 650)} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Shirt size={16} color={t.colors.accent} />
          <Text style={{ ...t.typography.label, color: t.colors.ink }}>{msg}</Text>
        </View>
      </Animated.View>
    </View>
  );
}
