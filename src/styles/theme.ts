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
    /** 시작 화면 등 아트가 붙는 화면의 한글 본문. Figma 지정 서체. */
    ui: "Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif",
  },
  z: {
    canvas: 0,
    hud: 10,
    panel: 20,
    debug: 30,
    transition: 50,
    /** 로딩 화면은 전환 커버보다 위다. 전환 중에도 로딩을 보여 주기 때문이다. */
    loading: 60,
  },
} as const;

export type Theme = typeof theme;
