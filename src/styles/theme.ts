/** UI 공통 토큰. 색과 간격을 컴포넌트마다 새로 정의하지 않는다. */

import { chosunKg, neoDunggeunmo } from "./fonts";

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
    /** 숫자·라벨 등 시스템 UI(설정·일시정지·로딩 등)에서 쓰던 자리. 대화창과 같은 ChosunKg 서체다. */
    mono: chosunKg.style.fontFamily,
    /**
     * 보스 이름·지역명·아이템명 같은 게임 세계 고유명사 라벨. (사용자 결정)
     * 원래 Pretendard였다가 네오둥근모로 바꿨다 — 대화(mono/ChosunKg)와 메인 타이틀
     * (이미지 로고라 폰트와 무관)은 대상이 아니다.
     */
    ui: `${neoDunggeunmo.style.fontFamily}, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif`,
  },
  z: {
    canvas: 0,
    hud: 10,
    panel: 20,
    debug: 30,
    /** 방 안에서 씬을 멈추고 뜨는 대화창. HUD보다는 위, 시스템 전환보다는 아래다. */
    dialogue: 40,
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
