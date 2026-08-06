/**
 * 적 3종 정의. (MVP_PLAN §2)
 *
 * 수치는 `config/gameBalance.ts`에서 가져오고, 여기에는 역할과 카운터 의도만 둔다.
 * Director는 이 정의를 조합만 바꿔 사용하고 체력·공격력을 조정하지 않는다. (DEC-004)
 */

import { ENEMY } from "../config/gameBalance";
import type { EnemyType } from "../types/game";

export interface EnemyDefinition {
  type: EnemyType;
  name: string;
  /** 어떤 플레이 스타일을 압박하기 위한 적인지 */
  countersStyle: "RANGED" | "MELEE" | "MOBILE";
  hp: number;
  contactDamage: number;
  moveSpeed: number;
  /** 공격 예고 시간. 소프트 카운터 유지를 위해 0으로 두지 않는다. */
  telegraphMs: number;
  /** 플레이어가 이 적을 무력화하는 방법. 밸런스 검토 기준으로 쓴다. */
  weakness: string;
}

export const ENEMIES: Record<EnemyType, EnemyDefinition> = {
  CHASER: {
    type: "CHASER",
    name: "추격형",
    countersStyle: "RANGED",
    ...ENEMY.CHASER,
    weakness: "근거리 공격에 경직되기 쉽다.",
  },
  RANGED: {
    type: "RANGED",
    name: "견제형",
    countersStyle: "MELEE",
    ...ENEMY.RANGED,
    weakness: "벽에 몰리면 취약하고 투사체는 점프나 대시로 피할 수 있다.",
  },
  MOBILITY_COUNTER: {
    type: "MOBILITY_COUNTER",
    name: "기동 카운터형",
    countersStyle: "MOBILE",
    ...ENEMY.MOBILITY_COUNTER,
    weakness: "장판 예고를 보고 이동 방향을 바꾸면 회피할 수 있다.",
  },
};
