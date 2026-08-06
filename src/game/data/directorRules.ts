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
 * OQ-012 미결정 — 카운터 예고에서 어디까지 공개할지 정해지지 않았다.
 * 현재 문구는 스타일과 대응 방향까지만 말하고 적 구성은 밝히지 않는 수준으로 작성했다.
 * OQ-021 미결정 — 영문 헤더 + 한국어 본문 혼용 표기도 확정 전이다.
 */
export const DIRECTOR_DIALOGUE: Record<string, string> = {
  analysis_ranged: "거리를 유지하는 것이 네 유일한 장점인 것 같군.",
  analysis_melee: "파고드는 것 말고는 할 줄 아는 게 없나.",
  analysis_mobile: "많이도 움직이는군. 발이 닿는 곳을 세어 두었다.",
  analysis_mixed: "아직 네가 무엇을 하려는지 모르겠다.",
  counter_ranged: "다음 방에서는 그 거리를 유지하기 어려울 것이다.",
  counter_melee: "다음 방에서는 그렇게 쉽게 붙지 못할 것이다.",
  counter_mobile: "다음 방에서는 네가 지나갈 자리를 먼저 밟아 두었다.",
  counter_mixed: "판단을 유보하겠다. 마음껏 해봐라.",
  deception_success: "…예측이 빗나갔다.",
  deception_failed: "예상대로군.",
};

export const analysisDialogueId = (style: PlayStyle): string =>
  `analysis_${style.toLowerCase()}`;

export const counterDialogueId = (style: PlayStyle): string =>
  `counter_${style.toLowerCase()}`;
