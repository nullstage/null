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
    /** 프롤로그는 로딩이 걷힌 자리를 이어받는다. */
    prologue: 65,
    /** 첫 방문 안내처럼 모든 것을 막아야 하는 알림. */
    prompt: 70,
    /** 커스텀 커서는 언제나 맨 위여야 한다. */
    cursor: 9999,
  },
} as const;

export type Theme = typeof theme;
