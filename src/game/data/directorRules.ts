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

/**
 * MVP_PLAN §5 "방 2 소프트 카운터" (OQ-010 RESOLVED, DEC-014).
 *
 * 방 1 텔레메트리만으로 분류한 스타일에 따라 방 2를 축소판(2기) 카운터로 바꾼다.
 * MIXED는 기존 중립 방(`room_2`)을 그대로 쓴다 — 방 2를 억지로 몰면 방 2 텔레메트리가
 * 방 3 분석의 35% 가중치에 되먹임될 위험이 있어, 확실한 신호가 없을 때는 건드리지 않는다.
 */
export const SOFT_COUNTER_ROOM_2_BY_STYLE: Record<PlayStyle, RoomId> = {
  RANGED: "room_2_soft_ranged",
  MELEE: "room_2_soft_melee",
  MOBILE: "room_2_soft_mobile",
  MIXED: "room_2",
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

/**
 * 플레이 스타일에 붙는 칭호.
 *
 * 「기록」이나 「분석」 같은 말로는 무엇을 봤다는 건지 전해지지 않는다.
 * "너는 이런 자였다"를 한 줄로 못 박아야 다음 방이 왜 바뀌는지도 같이 납득된다.
 *
 * 대사(`analysis_*`)와 같은 관찰을 짧게 줄인 것이라 어조를 맞춘다.
 */
export const STYLE_TITLE: Record<PlayStyle, string> = {
  MELEE: "주먹을 믿는 자",
  RANGED: "거리를 두는 자",
  MOBILE: "붙잡히지 않는 자",
  MIXED: "아직 이름 없는 자",
};

/** 다음 방이 어떻게 달라지는지 한 줄로 알려 준다. 카운터가 안 보이면 시스템이 없는 것과 같다. */
export const COUNTER_SUMMARY: Record<PlayStyle, string> = {
  MELEE: "다가서기 어려운 자들이 기다린다",
  RANGED: "거리를 지우는 자들이 기다린다",
  MOBILE: "지나갈 자리를 막는 자들이 기다린다",
  MIXED: "아직 정해지지 않았다",
};

export const analysisDialogueId = (style: PlayStyle): string =>
  `analysis_${style.toLowerCase()}`;

export const counterDialogueId = (style: PlayStyle): string =>
  `counter_${style.toLowerCase()}`;
