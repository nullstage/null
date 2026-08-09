/**
 * 각인(刻印) — 기록 제단에서 그림자 조각으로 새기는 영구 해금. (사용자 요청)
 *
 * 런이 끝나도 남는 유일한 성장이다. 세계관과 잇는다 — 기록자가 판에 새긴 각인은
 * 침식이 삼키지 못한다. 저장은 `systems/Engravings.ts`가 localStorage로 관리한다.
 *
 * 육각 트리: `col`/`row`는 패널의 격자 좌표다. ROOT(중앙)에서 인접 노드로 퍼진다.
 */

export type EngravingId =
  | "ROOT"
  | "VIGOR"
  | "MEMORY"
  | "SPARE_SHELL"
  | "SWORD_PATH"
  | "AFTERIMAGE";

export interface EngravingDef {
  id: EngravingId;
  name: string;
  description: string;
  /** 그림자 조각 비용. 0이면 처음부터 새겨져 있다. */
  cost: number;
  /** 패널 육각 격자 좌표. */
  col: number;
  row: number;
  /** 먼저 새겨져 있어야 하는 각인. */
  requires: readonly EngravingId[];
}

/** 각인 효과 수치. 시작값에만 얹는 소폭 보정 — 런 내 아티팩트를 대체하지 않는다. */
export const ENGRAVING_EFFECT = {
  hpBonus: 10,
  startShards: 4,
  magazineBonus: 1,
  skillCooldownScale: 0.88,
  dashChargeBonus: 1,
} as const;

export const ENGRAVINGS: readonly EngravingDef[] = [
  {
    id: "ROOT",
    name: "첫 각인",
    description: "기록자가 네 이름의 첫 글자를 새겼다. 모든 각인은 여기서 뻗는다.",
    cost: 0,
    col: 1,
    row: 1,
    requires: [],
  },
  {
    id: "VIGOR",
    name: "견딤",
    description: "최대 체력이 10 오른 채로 깨어난다.",
    cost: 8,
    col: 0,
    row: 0,
    requires: ["ROOT"],
  },
  {
    id: "MEMORY",
    name: "기억 갈무리",
    description: "새 여정을 그림자 조각 4개와 함께 시작한다.",
    cost: 10,
    col: 2,
    row: 0,
    requires: ["ROOT"],
  },
  {
    id: "SPARE_SHELL",
    name: "여분의 탄피",
    description: "탄창이 1발 늘어난 채로 깨어난다.",
    cost: 8,
    col: 0,
    row: 2,
    requires: ["ROOT"],
  },
  {
    id: "SWORD_PATH",
    name: "검로(劍路)",
    description: "스킬 재사용 대기시간이 12% 짧아진다.",
    cost: 12,
    col: 2,
    row: 2,
    requires: ["ROOT"],
  },
  {
    id: "AFTERIMAGE",
    name: "잔영",
    description: "대시 충전이 1 늘어난 채로 깨어난다.",
    cost: 12,
    col: 1,
    row: 3,
    requires: ["SPARE_SHELL", "SWORD_PATH"],
  },
];

/** 패널이 그리는 노드 상태 — 정의 + 해금·해금 가능 여부. */
export interface EngravingView extends EngravingDef {
  unlocked: boolean;
  available: boolean;
}
