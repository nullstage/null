/**
 * 방 프리셋. (MVP_PLAN §2, §5)
 *
 * 카운터 방 4종은 MVP_PLAN §5에 확정되어 있어 그대로 옮겼다.
 * 방 1·방 2 구성은 아직 정해지지 않았다.
 *   OQ-009 미결정 — 방 1 중립 / 방 2 혼합 구성의 적 종류와 수
 *   OQ-010 미결정 — 방 2가 방 1 분석 결과를 반영할지 여부
 * 아래 `room_1`, `room_2`는 흐름을 굴리기 위한 임시 구성이다.
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

  /** 방 2 — 성향 분석용 혼합 방 (OQ-009, OQ-010 미결정, 임시 구성) */
  {
    id: "room_2",
    template: "PLATFORM",
    hazardsEnabled: false,
    spawns: [
      { type: "CHASER", xRatio: 0.7, delayMs: 0 },
      { type: "RANGED", xRatio: 0.9, delayMs: 1500 },
      { type: "CHASER", xRatio: 0.2, delayMs: 4000 },
    ],
  },

  /** MVP_PLAN §5 — RANGED 대응: 추격형 2, 견제형 1, 스폰 간격 좁게 */
  {
    id: "counter_ranged",
    template: "HORIZONTAL",
    hazardsEnabled: false,
    spawns: [
      { type: "CHASER", xRatio: 0.7, delayMs: 0 },
      { type: "CHASER", xRatio: 0.9, delayMs: 800 },
      { type: "RANGED", xRatio: 0.95, delayMs: 1600 },
    ],
  },

  /** MVP_PLAN §5 — MELEE 대응: 견제형 2, 추격형 1, 좌우 분산 스폰 */
  {
    id: "counter_melee",
    template: "PLATFORM",
    hazardsEnabled: false,
    spawns: [
      { type: "RANGED", xRatio: 0.1, delayMs: 0 },
      { type: "RANGED", xRatio: 0.9, delayMs: 0 },
      { type: "CHASER", xRatio: 0.5, delayMs: 2000 },
    ],
  },

  /** MVP_PLAN §5 — MOBILE 대응: 기동 카운터형 2, 추격형 1, 지연 장판 활성화 */
  {
    id: "counter_mobile",
    template: "PLATFORM",
    hazardsEnabled: true,
    spawns: [
      { type: "MOBILITY_COUNTER", xRatio: 0.25, delayMs: 0 },
      { type: "MOBILITY_COUNTER", xRatio: 0.75, delayMs: 1200 },
      { type: "CHASER", xRatio: 0.9, delayMs: 2400 },
    ],
  },

  /** MVP_PLAN §5 — MIXED 대응: 각 1기, 함정 없음 */
  {
    id: "counter_mixed",
    template: "HORIZONTAL",
    hazardsEnabled: false,
    spawns: [
      { type: "CHASER", xRatio: 0.8, delayMs: 0 },
      { type: "RANGED", xRatio: 0.95, delayMs: 1500 },
      { type: "MOBILITY_COUNTER", xRatio: 0.2, delayMs: 3000 },
    ],
  },
];

export const ROOM_PRESETS: Record<RoomId, RoomPreset> = Object.fromEntries(
  ROOM_PRESET_LIST.map((preset) => [preset.id, preset]),
);

/** 런에서 방 1, 방 2는 고정이고 방 3만 Director가 고른다. */
export const FIXED_ROOM_SEQUENCE: RoomId[] = ["room_1", "room_2"];

export const getRoomPreset = (id: RoomId): RoomPreset => {
  const preset = ROOM_PRESETS[id];
  if (!preset) throw new Error(`알 수 없는 방 프리셋: ${id}`);
  return preset;
};
