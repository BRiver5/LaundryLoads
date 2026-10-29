// Палитра Laundry Loads: глубокий «синий ополаскивателя» на свежей мятно-белой
// бумаге. Компоненты и экраны берут цвета только отсюда.

export const light = {
  background: "#EFF4F3",
  backgroundAlt: "#E3EBEA",
  surface: "#FFFFFF",
  surfaceAlt: "#F5F8F8",
  border: "#D9E3E2",
  ink: "#15262E",
  inkMuted: "#566A72",
  inkFaint: "#93A3A9",
  onAccent: "#FFFFFF",
  accent: "#1B526A",
  accentSoft: "#DCEAF0",
  // Барабан и пена — второй тон; коралл — предупреждения о прокрасе.
  foam: "#4FA3B8",
  coral: "#C9573F",
  coralSoft: "#F7E1DA",
  fresh: "#2F8A5E",
  freshSoft: "#DCEFE4",
  danger: "#B3362F",
  success: "#2F8A5E",
  signal: "#99600F",
  scrim: "rgba(21,38,46,0.45)",
  statusDimmed: "#8B9497",
};

export const dark = {
  background: "#0F171A",
  backgroundAlt: "#152024",
  surface: "#1A272C",
  surfaceAlt: "#223238",
  border: "#2C3E45",
  ink: "#EAF2F3",
  inkMuted: "#A2B4BA",
  inkFaint: "#687B82",
  onAccent: "#FFFFFF",
  accent: "#4F9BBA",
  accentSoft: "#1D3540",
  foam: "#6FBCD0",
  coral: "#E07A62",
  coralSoft: "#3A241F",
  fresh: "#5DB88A",
  freshSoft: "#1C3328",
  danger: "#E0675F",
  success: "#5DB88A",
  signal: "#E0A040",
  scrim: "rgba(0,0,0,0.6)",
  statusDimmed: "#07090A",
};

export type Palette = typeof light;

// Цветовые группы белья — фиксированный порядок, свотч принадлежит группе.
export const GROUP_COLORS: Record<string, string> = {
  white: "#C7D0D6",
  light: "#8DB6D6",
  dark: "#2E3A4E",
  bleed: "#B23A48",
};
export const GROUP_LABEL: Record<string, string> = { white: "Whites", light: "Lights", dark: "Darks", bleed: "Bleeders" };
