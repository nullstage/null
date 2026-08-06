/** MVP_PLAN §2 강화 6종. 등급·인벤토리·조합 효과는 범위 밖이다. */

import type { UpgradeDefinition, UpgradeId } from "../types/game";

export const UPGRADES: Record<UpgradeId, UpgradeDefinition> = {
  MELEE_DAMAGE_UP: {
    id: "MELEE_DAMAGE_UP",
    category: "MELEE",
    name: "예리한 날",
    description: "근거리 공격력이 20% 증가한다.",
  },
  MELEE_FINISHER_RANGE_UP: {
    id: "MELEE_FINISHER_RANGE_UP",
    category: "MELEE",
    name: "확장된 마무리",
    description: "근거리 마지막 타격의 범위가 넓어진다.",
  },
  RANGED_COOLDOWN_DOWN: {
    id: "RANGED_COOLDOWN_DOWN",
    category: "RANGED",
    name: "속사",
    description: "원거리 공격 쿨타임이 20% 감소한다.",
  },
  RANGED_PIERCE: {
    id: "RANGED_PIERCE",
    category: "RANGED",
    name: "관통탄",
    description: "투사체가 적 1명을 관통한다.",
  },
  DASH_CHARGE_UP: {
    id: "DASH_CHARGE_UP",
    category: "MOBILITY",
    name: "추가 회피",
    description: "대시 충전이 1 증가한다.",
  },
  DASH_FOLLOWUP_DAMAGE_UP: {
    id: "DASH_FOLLOWUP_DAMAGE_UP",
    category: "MOBILITY",
    name: "기습",
    description: "대시 직후 첫 공격의 피해가 증가한다.",
  },
};

export const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];
