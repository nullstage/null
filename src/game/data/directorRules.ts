/**
 * Counter Director 규칙 데이터.
 *
 * 여기 있는 값은 `MVP_PLAN.md` §4, §5, §8에 이미 확정된 정본이다.
 * 임의로 바꾸지 않고, 바꿔야 하면 MVP_PLAN을 먼저 갱신한다.
 */

import type { BossPatternWeights, PlayStyle, RoomId } from "../types/game";

/** MVP_PLAN §4 분류 규칙 */
export const CLASSIFY = {
  /** 원거리 또는 근거리 비율이 이 값 이상이면 해당 스타일로 본다. */
  dominantRatio: 0.6,
  /** MOBILE 판정: 두 비율 차이가 이 값 미만이어야 한다. */
  balancedRatioGap: 0.2,
  /**
   * MOBILE 판정 대시 기준치(방당).
   * OQ-013 미결정 — 가중 평균에도 이 절대값을 그대로 쓸지 결정되지 않았다.
   */
  dashThreshold: 8,
} as const;

/** MVP_PLAN §4 최근 데이터 가중치 */
export const RECENCY_WEIGHT = {
  current: 0.65,
  previous: 0.35,
} as const;

/** MVP_PLAN §4 신뢰도 */
export const CONFIDENCE = {
  mobileScale: 70,
  mobileMax: 95,
  mixed: 50,
} as const;

/** MVP_PLAN §7 대시 의존도 구간 */
export const DASH_RELIANCE_BANDS = {
  low: 3,
  medium: 7,
} as const;

/** MVP_PLAN §5 카운터 방 매핑 */
export const COUNTER_ROOM_BY_STYLE: Record<PlayStyle, RoomId> = {
  RANGED: "counter_ranged",
  MELEE: "counter_melee",
  MOBILE: "counter_mobile",
  MIXED: "counter_mixed",
};

/** MVP_PLAN §8 보스 패턴 가중치 */
export const BOSS_WEIGHTS_BY_STYLE: Record<PlayStyle, BossPatternWeights> = {
  MIXED: { slash: 25, dash: 25, projectile: 25, slam: 25 },
  RANGED: { slash: 15, dash: 40, projectile: 10, slam: 35 },
  MELEE: { slash: 25, dash: 10, projectile: 45, slam: 20 },
  MOBILE: { slash: 15, dash: 20, projectile: 20, slam: 45 },
};

export const DEFAULT_BOSS_WEIGHTS: BossPatternWeights = BOSS_WEIGHTS_BY_STYLE.MIXED;

/**
 * Director 대사.
 *
 * 화자는 NULL의 기록자이자 심판이다. 시험받는 자를 지켜보고 적어 두는 쪽이므로
 * 감탄하거나 위협하지 않는다. 담담한 고어체 단문으로 쓴다. (사용자 확정 톤)
 *
 * OQ-012 미결정 — 카운터 예고에서 어디까지 공개할지 정해지지 않았다.
 * 현재 문구는 스타일과 대응 방향까지만 말하고 적 구성은 밝히지 않는 수준으로 작성했다.
 * OQ-021 해소 — 영문 헤더는 쓰지 않고 「기록」/「판결」 계열 한국어 표기로 통일한다.
 */
export const DIRECTOR_DIALOGUE: Record<string, string> = {
  analysis_ranged: "가까이 오는 법을 잊었군.",
  analysis_melee: "주먹을 믿는 자였나.",
  analysis_mobile: "멈추지 않는다고 닿지 않는 것은 아니다.",
  analysis_mixed: "아직 네 이름을 적을 자리를 찾지 못했다.",
  counter_ranged: "다음 방에는 네가 설 거리가 남지 않을 것이다.",
  counter_melee: "다음 방에서는 그 거리를 좁히기 어려울 것이다.",
  counter_mobile: "네가 지나갈 자리를 먼저 적어 두었다.",
  counter_mixed: "판단을 미루겠다. 더 보여라.",
  deception_success: "기록이 어긋났다. 다시 본다.",
  deception_failed: "적어 둔 그대로였다.",
};

export const analysisDialogueId = (style: PlayStyle): string =>
  `analysis_${style.toLowerCase()}`;

export const counterDialogueId = (style: PlayStyle): string =>
  `counter_${style.toLowerCase()}`;
