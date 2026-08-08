/**
 * 방 프리셋. (MVP_PLAN §2, §5)
 *
 * 카운터 방 4종은 MVP_PLAN §5에 확정되어 있어 그대로 옮겼다.
 * 방 1 구성은 아직 정해지지 않았다. (OQ-009 미결정 — 임시 구성)
 *
 * 방 2는 OQ-010 RESOLVED(DEC-014)에 따라 방 1 분석 스타일별 축소판(2기) 카운터를 쓴다.
 * `room_2`는 그중 MIXED(또는 신뢰할 결과가 없을 때)용 중립 구성으로 남는다.
 * 어떤 프리셋을 쓸지는 `SOFT_COUNTER_ROOM_2_BY_STYLE`(directorRules.ts)이 정한다.
 */

import type { RoomId, RoomPreset } from "../types/game";

const ROOM_PRESET_LIST: RoomPreset[] = [
  /** 방 1 — 조작과 전투 학습용 중립 방 (OQ-009 미결정, 임시 구성) */
  {
    id: "room_1",
    template: "HORIZONTAL",
    hazardsEnabled: false,
    spawns: [
      { type: "CHASER", xRatio: 0.75, delayMs: 0 },
      { type: "CHASER", xRatio: 0.9, delayMs: 2500 },
    ],
  },

  /** 방 2 — MIXED(또는 방 1 분석 없음)용 중립 방 (OQ-009 미결정, 임시 구성) */
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

  /**
   * 방 2 소프트 카운터 3종. (MVP_PLAN §5 "방 2 소프트 카운터", DEC-014)
   * 각각 대응 방 3 카운터의 다수 그룹만 2기로 남긴 축소판이다.
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

/**
 * 방 1은 고정이고, 방 3은 Director가 고른다.
 * 방 2는 여기 있는 `room_2`가 기본값(MIXED·분석 없음)일 뿐, 실제로는
 * `SOFT_COUNTER_ROOM_2_BY_STYLE`(directorRules.ts)이 방 1 분석에 따라 고른다. (DEC-014)
 */
export const FIXED_ROOM_SEQUENCE: RoomId[] = ["room_1", "room_2"];

export const getRoomPreset = (id: RoomId): RoomPreset => {
  const preset = ROOM_PRESETS[id];
  if (!preset) throw new Error(`알 수 없는 방 프리셋: ${id}`);
  return preset;
};
