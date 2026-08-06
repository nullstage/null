/**
 * Counter Director 정책 엔진. (MVP_PLAN §4, §5, §6, §8 / DEC-003)
 *
 * 전부 순수 함수다. Phaser에 의존하지 않으므로 단위 테스트가 가능하다.
 * 같은 입력에는 항상 같은 결과가 나와야 한다. 무작위성을 넣지 않는다.
 *
 * 금지 사항 (DEC-004):
 * - 적 체력·공격력을 성향에 따라 조정하지 않는다.
 * - 플레이어의 주력 수단을 봉쇄하지 않는다.
 */

import {
  BOSS_WEIGHTS_BY_STYLE,
  CLASSIFY,
  CONFIDENCE,
  COUNTER_ROOM_BY_STYLE,
  DASH_RELIANCE_BANDS,
  RECENCY_WEIGHT,
  analysisDialogueId,
} from "../data/directorRules";
import type {
  BossPatternWeights,
  CombatTelemetry,
  DeceptionResult,
  DirectorAnalysis,
  PlayStyle,
  RoomId,
} from "../types/game";

export interface StyleBreakdown {
  style: PlayStyle;
  confidence: number;
  meleeRatio: number;
  rangedRatio: number;
  /** 대시 기준치 대비 비율. 1이면 기준치와 같다. */
  mobilityScore: number;
}

/**
 * 최근 두 방을 합친 가중 텔레메트리를 만든다. (MVP_PLAN §4)
 *
 * OQ-011 미결정 — 방 1처럼 이전 방이 없을 때의 처리가 확정되지 않았다.
 * 현재는 현재 방 100%로 계산한다.
 */
export const mergeRecent = (
  current: CombatTelemetry,
  previous: CombatTelemetry | null,
): CombatTelemetry => {
  if (!previous) return { ...current };

  const { current: cw, previous: pw } = RECENCY_WEIGHT;
  const blend = (a: number, b: number) => a * cw + b * pw;

  return {
    meleeAttacks: blend(current.meleeAttacks, previous.meleeAttacks),
    meleeHits: blend(current.meleeHits, previous.meleeHits),
    rangedAttacks: blend(current.rangedAttacks, previous.rangedAttacks),
    rangedHits: blend(current.rangedHits, previous.rangedHits),
    dashCount: blend(current.dashCount, previous.dashCount),
    airAttackCount: blend(current.airAttackCount, previous.airAttackCount),
    damageTakenCount: blend(current.damageTakenCount, previous.damageTakenCount),
    clearTimeMs: blend(current.clearTimeMs, previous.clearTimeMs),
    remainingHp: current.remainingHp,
  };
};

/** MVP_PLAN §4 분류 규칙과 신뢰도 계산 */
export const classify = (telemetry: CombatTelemetry): StyleBreakdown => {
  const totalHits = telemetry.meleeHits + telemetry.rangedHits;
  const mobilityScore = telemetry.dashCount / CLASSIFY.dashThreshold;

  // 전체 적중이 0이면 판단 근거가 없으므로 MIXED다. (MVP_PLAN §4)
  if (totalHits <= 0) {
    return {
      style: "MIXED",
      confidence: CONFIDENCE.mixed,
      meleeRatio: 0,
      rangedRatio: 0,
      mobilityScore,
    };
  }

  const meleeRatio = telemetry.meleeHits / totalHits;
  const rangedRatio = telemetry.rangedHits / totalHits;

  if (rangedRatio >= CLASSIFY.dominantRatio) {
    return {
      style: "RANGED",
      confidence: round(rangedRatio * 100),
      meleeRatio,
      rangedRatio,
      mobilityScore,
    };
  }

  if (meleeRatio >= CLASSIFY.dominantRatio) {
    return {
      style: "MELEE",
      confidence: round(meleeRatio * 100),
      meleeRatio,
      rangedRatio,
      mobilityScore,
    };
  }

  const balanced = Math.abs(meleeRatio - rangedRatio) < CLASSIFY.balancedRatioGap;
  if (balanced && telemetry.dashCount >= CLASSIFY.dashThreshold) {
    return {
      style: "MOBILE",
      confidence: round(Math.min(mobilityScore * CONFIDENCE.mobileScale, CONFIDENCE.mobileMax)),
      meleeRatio,
      rangedRatio,
      mobilityScore,
    };
  }

  return {
    style: "MIXED",
    confidence: CONFIDENCE.mixed,
    meleeRatio,
    rangedRatio,
    mobilityScore,
  };
};

/** 방 클리어 후 분석 결과를 만든다. 이 결과가 다음 방과 UI를 결정한다. */
export const analyze = (
  current: CombatTelemetry,
  previous: CombatTelemetry | null,
): DirectorAnalysis => {
  const breakdown = classify(mergeRecent(current, previous));

  return {
    style: breakdown.style,
    confidence: breakdown.confidence,
    meleeRatio: breakdown.meleeRatio,
    rangedRatio: breakdown.rangedRatio,
    mobilityScore: breakdown.mobilityScore,
    counterRoomId: counterRoomFor(breakdown.style),
    dialogueId: analysisDialogueId(breakdown.style),
  };
};

export const counterRoomFor = (style: PlayStyle): RoomId => COUNTER_ROOM_BY_STYLE[style];

export const bossWeightsFor = (style: PlayStyle): BossPatternWeights => ({
  ...BOSS_WEIGHTS_BY_STYLE[style],
});

/** MVP_PLAN §7 대시 의존도 표기 */
export const dashReliance = (dashCount: number): "낮음" | "보통" | "높음" => {
  if (dashCount <= DASH_RELIANCE_BANDS.low) return "낮음";
  if (dashCount <= DASH_RELIANCE_BANDS.medium) return "보통";
  return "높음";
};

/**
 * MVP_PLAN §6 역기만 판정.
 *
 * 의도적 기만인지는 추론하지 않는다. 예측이 빗나갔고 방을 통과했으면 성공이다.
 * `MIXED`로 바뀐 경우도 예측 실패로 인정한다.
 */
export const evaluateDeception = (
  predictedStyle: PlayStyle,
  actualStyle: PlayStyle,
  roomCleared: boolean,
  maxHp: number,
): DeceptionResult => {
  const succeeded = roomCleared && predictedStyle !== actualStyle;
  return {
    predictedStyle,
    actualStyle,
    succeeded,
    healedAmount: succeeded ? Math.floor(maxHp * 0.2) : 0,
  };
};

/**
 * 가중치에 따라 보스 패턴 하나를 고른다.
 *
 * 동일 패턴 연속 제한은 호출부(BossController)가 `excluded`로 넘긴다. (MVP_PLAN §8)
 * `random`을 주입받는 이유는 테스트에서 결과를 고정하기 위해서다.
 */
export const pickBossPattern = (
  weights: BossPatternWeights,
  excluded: (keyof BossPatternWeights)[] = [],
  random: () => number = Math.random,
): keyof BossPatternWeights => {
  const entries = (Object.entries(weights) as [keyof BossPatternWeights, number][]).filter(
    ([pattern, weight]) => weight > 0 && !excluded.includes(pattern),
  );

  // 제외 규칙 때문에 후보가 비면 제한을 풀어 반드시 하나를 고른다.
  const pool = entries.length > 0
    ? entries
    : (Object.entries(weights) as [keyof BossPatternWeights, number][]);

  const total = pool.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [pattern, weight] of pool) {
    roll -= weight;
    if (roll <= 0) return pattern;
  }
  return pool[pool.length - 1][0];
};

const round = (value: number): number => Math.round(value);
