import type { NewType } from "./repo";

// Частые типы белья с настройками ухода — добавляются одним тапом.
export const PRESETS: NewType[] = [
  { name: "Bath towels", color: "white", care: "normal", max_temp: 60, want_temp: 60, kg: 0.6, dryer: 1, owned: 6 },
  { name: "Bed sheets", color: "white", care: "normal", max_temp: 60, want_temp: 60, kg: 0.8, dryer: 1, owned: 3 },
  { name: "Kitchen towels", color: "white", care: "normal", max_temp: 60, want_temp: 60, kg: 0.1, dryer: 1, owned: 8 },
  { name: "White tees", color: "white", care: "normal", max_temp: 40, want_temp: 40, kg: 0.2, dryer: 1, owned: 6 },
  { name: "Socks & underwear", color: "light", care: "normal", max_temp: 60, want_temp: 60, kg: 0.05, dryer: 1, owned: 14 },
  { name: "Light shirts", color: "light", care: "normal", max_temp: 40, want_temp: 40, kg: 0.25, dryer: 1, owned: 5 },
  { name: "Wool sweater", color: "light", care: "delicate", max_temp: 30, want_temp: 30, kg: 0.5, dryer: 0, owned: 3 },
  { name: "Silk blouse", color: "light", care: "delicate", max_temp: 30, want_temp: 30, kg: 0.15, dryer: 0, owned: 2 },
  { name: "Dark jeans", color: "dark", care: "normal", max_temp: 40, want_temp: 40, kg: 0.7, dryer: 0, owned: 4 },
  { name: "Dark tees", color: "dark", care: "normal", max_temp: 40, want_temp: 40, kg: 0.2, dryer: 1, owned: 7 },
  { name: "Gym wear", color: "dark", care: "normal", max_temp: 40, want_temp: 40, kg: 0.25, dryer: 0, owned: 5 },
  { name: "Red tops", color: "bleed", care: "normal", max_temp: 30, want_temp: 30, kg: 0.25, dryer: 1, owned: 3 },
  { name: "New denim", color: "bleed", care: "normal", max_temp: 30, want_temp: 30, kg: 0.7, dryer: 0, owned: 2 },
];
