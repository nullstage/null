/**
 * 방 프리셋. (MVP_PLAN §2, §5)
 *
 * 카운터 방 4종은 MVP_PLAN §5에 확정되어 있어 그대로 옮겼다.
 * 방 1은 무전투 튜토리얼이라 텔레메트리가 없다(OQ-009 미결정 — 적 구성은 별개 문제).
 *
 * 방 2는 OQ-010 RESOLVED(DEC-016)에 따라 소프트 카운터를 쓴다. 방 1이 무전투로 바뀌면서
 * "방 1 분석"이라는 원래 전제가 사라져, 방 2 자신의 1웨이브 텔레메트리로 2·3웨이브를
 * 정하는 방식으로 조정했다 — `room_2`가 1웨이브(중립 구성)이고, `room_2_soft_*`가
 * 2·3웨이브 후보다. 실제 선택은 `RoomController.resolveWaveOverride`(CombatScene에서 주입)가
 * `SOFT_COUNTER_ROOM_2_BY_STYLE`(directorRules.ts)로 한다.
 */

import type { RoomId, RoomPreset } from "../types/game";

const ROOM_PRESET_LIST: RoomPreset[] = [
  /**
   * 방 1 — 조작 학습용 무전투 방.
   * 적을 두지 않는다. 진행은 전투가 아니라 방 끝 전송 게이트로 한다(`CombatScene` 참조).
   */
  {
    id: "room_1",
    template: "HORIZONTAL",
    hazardsEnabled: false,
    spawns: [],
  },

  /**
   * 방 2 — 성향 분석용 혼합 방 (OQ-009 미결정, 임시 구성). 3웨이브 중 1웨이브다.
   * 전멸시켜야 다음 웨이브(또는 포탈)가 열린다. 2·3웨이브 구성은 1웨이브 텔레메트리로
   * `RoomController`의 `resolveWaveOverride`가 정한다 — 아래 `room_2_soft_*` 참고. (DEC-016)
   */
  {
    id: "room_2",
    template: "PLATFORM",
    hazardsEnabled: false,
    extraWaves: 2,
    spawns: [
      { type: "CHASER", xRatio: 0.7, delayMs: 0 },
      { type: "RANGED", xRatio: 0.9, delayMs: 1500 },
      { type: "CHASER", xRatio: 0.2, delayMs: 4000 },
      { type: "RANGED", xRatio: 0.4, delayMs: 5500 },
    ],
  },

  /**
   * 방 2 소프트 카운터 3종. (MVP_PLAN §5 "방 2 소프트 카운터", DEC-016)
   * 방 2의 2·3웨이브 전용 구성이다 — 대응 방 3 카운터의 다수 그룹만 2기로 남긴 축소판.
   * `room_2` 자체의 `spawns`(1웨이브)는 그대로 두고, `RoomController.resolveWaveOverride`가
   * 1웨이브 텔레메트리로 이 중 하나를 골라 2·3웨이브에 대신 쓴다.
   */
  {
    id: "room_2_soft_ranged",
    template: "HORIZONTAL",
    hazardsEnabled: false,
    spawns: [
      { type: "CHASER", xRatio: 0.7, delayMs: 0 },
      { type: "CHASER", xRatio: 0.9, delayMs: 800 },
    ],
  },
  {
    id: "room_2_soft_melee",
    template: "PLATFORM",
    hazardsEnabled: false,
    spawns: [
      { type: "RANGED", xRatio: 0.1, delayMs: 0 },
      { type: "RANGED", xRatio: 0.9, delayMs: 0 },
    ],
  },
  {
    id: "room_2_soft_mobile",
    template: "PLATFORM",
    hazardsEnabled: true,
    spawns: [
      { type: "MOBILITY_COUNTER", xRatio: 0.25, delayMs: 0 },
      { type: "MOBILITY_COUNTER", xRatio: 0.75, delayMs: 1200 },
    ],
  },

  /** MVP_PLAN §5 — RANGED 대응: 추격형 다수, 견제형 소수, 스폰 간격 좁게 */
  {
    id: "counter_ranged",
    template: "HORIZONTAL",
    hazardsEnabled: false,
    extraWaves: 2,
    spawns: [
      { type: "CHASER", xRatio: 0.7, delayMs: 0 },
      { type: "CHASER", xRatio: 0.9, delayMs: 800 },
      { type: "RANGED", xRatio: 0.95, delayMs: 1600 },
      { type: "CHASER", xRatio: 0.5, delayMs: 2400 },
    ],
  },

  /** MVP_PLAN §5 — MELEE 대응: 견제형 다수, 추격형 소수, 좌우 분산 스폰 */
  {
    id: "counter_melee",
    template: "PLATFORM",
    hazardsEnabled: false,
    extraWaves: 2,
    spawns: [
      { type: "RANGED", xRatio: 0.1, delayMs: 0 },
      { type: "RANGED", xRatio: 0.9, delayMs: 0 },
      { type: "CHASER", xRatio: 0.5, delayMs: 2000 },
      { type: "RANGED", xRatio: 0.5, delayMs: 3200 },
    ],
  },

  /** MVP_PLAN §5 — MOBILE 대응: 기동 카운터형 다수, 추격형 소수, 지연 장판 활성화 */
  {
    id: "counter_mobile",
    template: "PLATFORM",
    hazardsEnabled: true,
    extraWaves: 2,
    spawns: [
      { type: "MOBILITY_COUNTER", xRatio: 0.25, delayMs: 0 },
      { type: "MOBILITY_COUNTER", xRatio: 0.75, delayMs: 1200 },
      { type: "CHASER", xRatio: 0.9, delayMs: 2400 },
      { type: "MOBILITY_COUNTER", xRatio: 0.5, delayMs: 3600 },
    ],
  },

  /** MVP_PLAN §5 — MIXED 대응: 세 역할 고르게, 함정 없음 */
  {
    id: "counter_mixed",
    template: "HORIZONTAL",
    hazardsEnabled: false,
    extraWaves: 2,
    spawns: [
      { type: "CHASER", xRatio: 0.8, delayMs: 0 },
      { type: "RANGED", xRatio: 0.95, delayMs: 1500 },
      { type: "MOBILITY_COUNTER", xRatio: 0.2, delayMs: 3000 },
      { type: "CHASER", xRatio: 0.4, delayMs: 4200 },
    ],
  },
];

export const ROOM_PRESETS: Record<RoomId, RoomPreset> = Object.fromEntries(
  ROOM_PRESET_LIST.map((preset) => [preset.id, preset]),
);

/**
 * 방 1·방 2는 고정이고, 방 3은 Director가 고른다.
 * 방 2는 이 `room_2` 프리셋으로 시작하지만, 1웨이브를 클리어하면
 * `SOFT_COUNTER_ROOM_2_BY_STYLE`(directorRules.ts)이 2·3웨이브 구성을 다시 정한다. (DEC-016)
 */
export const FIXED_ROOM_SEQUENCE: RoomId[] = ["room_1", "room_2"];

export const getRoomPreset = (id: RoomId): RoomPreset => {
  const preset = ROOM_PRESETS[id];
  if (!preset) throw new Error(`존재하지 않는 시험 구역입니다: ${id}`);
  return preset;
};
