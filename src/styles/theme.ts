/** UI 공통 토큰. 색과 간격을 컴포넌트마다 새로 정의하지 않는다. */

export const theme = {
  color: {
    bg: "#12151c",
    panel: "rgba(18, 21, 28, 0.92)",
    border: "#2a3140",
    text: "#e9edf5",
    textMuted: "#8b95a7",
    accent: "#6fd3ff",
    danger: "#ff6b6b",
    warning: "#ffd166",
    success: "#7ee787",
  },
  space: (n: number) => `${n * 4}px`,
  radius: "10px",
  font: {
    mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
  z: {
    canvas: 0,
    hud: 10,
    panel: 20,
    debug: 30,
  },
} as const;

export type Theme = typeof theme;
