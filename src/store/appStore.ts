import { create } from "zustand";
import { loadAll, DEFAULT_SETTINGS, type AddRow, type HamperRow, type Settings, type TypeRow, type WashRow } from "../data/repo";
import type { BleedModel } from "../lib/laundry";
import type { Rate } from "../lib/schedule";
import { todayLocal } from "../lib/time";
import { setHapticsEnabled } from "../services/haptics";

type State = {
  ready: boolean;
  version: number;
  today: string;
  types: TypeRow[];
  hamper: HamperRow[];
  adds: AddRow[];
  washes: WashRow[];
  bleed: BleedModel;
  rates: Record<string, Rate>;
  settings: Settings;
  extra: Record<string, number>;
  refresh: () => Promise<void>;
};

// refresh() — через очередь: два перезапроса внахлёст не перетирают друг друга.
let queue: Promise<void> = Promise.resolve();

export const useApp = create<State>((set) => ({
  ready: false,
  version: 0,
  today: todayLocal(),
  types: [],
  hamper: [],
  adds: [],
  washes: [],
  bleed: {},
  rates: {},
  settings: DEFAULT_SETTINGS,
  extra: {},
  refresh: () => {
    queue = queue
      .then(async () => {
        const today = todayLocal();
        const d = await loadAll(today);
        setHapticsEnabled(d.settings.haptics);
        set((s) => ({ ...d, ready: true, today, version: s.version + 1 }));
      })
      .catch(() => {});
    return queue;
  },
}));
