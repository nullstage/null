/**
 * MVP_PLAN §2 강화 8종. 등급·인벤토리·조합 효과는 범위 밖이다.
 *
 * 이 중 둘(`BLADE_REFORGED`, `BARREL_REFORGED`)은 무기 자체를 바꾼다.
 * 수치만 오르면 무엇이 좋아졌는지 화면에서 알 수 없으므로,
 * 이 둘은 궤적의 색과 굵기까지 함께 바뀌어 눈으로 확인된다.
 */

import type { UpgradeDefinition, UpgradeId } from "../types/game";

export const UPGRADES: Record<UpgradeId, UpgradeDefinition> = {
  MELEE_DAMAGE_UP: {
    id: "MELEE_DAMAGE_UP",
    category: "MELEE",
    name: "날 세우기",
    description: "근거리 공격력이 20% 증가한다.",
  },
  MELEE_FINISHER_RANGE_UP: {
    id: "MELEE_FINISHER_RANGE_UP",
    category: "MELEE",
    name: "긴 궤적",
    description: "근거리 연속 공격의 마지막 타격 범위가 넓어진다.",
  },
  BLADE_REFORGED: {
    id: "BLADE_REFORGED",
    category: "MELEE",
    name: "다시 벼린 검",
    description: "검이 더욱 길고 무거워진다. 피해량이 35% 증가하고 사거리가 늘어난다. 공격 궤적이 흰빛으로 변한다.",
  },
  RANGED_COOLDOWN_DOWN: {
    id: "RANGED_COOLDOWN_DOWN",
    category: "RANGED",
    name: "속사",
    description: "원거리 공격의 발사 간격이 20% 감소한다.",
  },
  RANGED_PIERCE: {
    id: "RANGED_PIERCE",
    category: "RANGED",
    name: "관통탄",
    description: "투사체가 적 1명을 추가로 관통한다.",
  },
  BARREL_REFORGED: {
    id: "BARREL_REFORGED",
    category: "RANGED",
    name: "개조된 총열",
    description: "탄환의 피해량이 40% 증가하고 탄속이 빨라진다. 탄 궤적도 더욱 선명해진다.",
  },
  DASH_CHARGE_UP: {
    id: "DASH_CHARGE_UP",
    category: "MOBILITY",
    name: "두 번째 발걸음",
    description: "대시 충전 횟수가 1 증가한다.",
  },
  DASH_FOLLOWUP_DAMAGE_UP: {
    id: "DASH_FOLLOWUP_DAMAGE_UP",
    category: "MOBILITY",
    name: "틈새 베기",
    description: "대시 직후 사용하는 첫 공격의 피해량이 증가한다.",
  },
  DASH_COOLDOWN_DOWN: {
    id: "DASH_COOLDOWN_DOWN",
    category: "MOBILITY",
    name: "가벼운 발",
    description: "대시 충전 시간이 25% 감소한다.",
  },
  DASH_INVULN_UP: {
    id: "DASH_INVULN_UP",
    category: "MOBILITY",
    name: "잔영",
    description: "대시 중 무적 시간이 증가한다.",
  },
  MELEE_BLADE_SIZE_UP: {
    id: "MELEE_BLADE_SIZE_UP",
    category: "MELEE",
    name: "거대한 칼날",
    description: "검의 공격 판정과 궤적 크기가 증가한다.",
  },
  MELEE_FIRE_EDGE: {
    id: "MELEE_FIRE_EDGE",
    category: "MELEE",
    name: "타오르는 칼날",
    element: "FIRE",
    description: "근거리 공격에 화염이 깃든다. 적중한 대상은 잠시 불타며 추가 피해를 입는다.",
  },
  MELEE_SWORD_WAVE: {
    id: "MELEE_SWORD_WAVE",
    category: "MELEE",
    name: "검기",
    description: "스킬 해금 — Q를 눌러 전방으로 날아가는 참격을 사용한다. 재사용 대기시간 4초.",
  },
  MELEE_SPIKE_ERUPTION: {
    id: "MELEE_SPIKE_ERUPTION",
    category: "MELEE",
    name: "검극(劍棘)",
    description: "스킬 해금 — R를 눌러 전방의 지면에서 검의 가시를 연속으로 솟구치게 한다. 재사용 대기시간 6초.",
  },
  MELEE_BLADE_CYCLONE: {
    id: "MELEE_BLADE_CYCLONE",
    category: "MELEE",
    name: "검무(劍舞)",
    description: "스킬 해금 — F를 눌러 몸 주변을 휩쓰는 검의 폭풍을 일으킨다. 재사용 대기시간 8초.",
  },
  RANGED_BULLET_SIZE_UP: {
    id: "RANGED_BULLET_SIZE_UP",
    category: "RANGED",
    name: "중탄",
    description: "탄환 크기와 적중 판정 범위가 증가한다.",
  },
  RANGED_FROST_ROUND: {
    id: "RANGED_FROST_ROUND",
    category: "RANGED",
    name: "냉기탄",
    element: "FROST",
    description: "원거리 공격에 냉기가 깃든다. 적중한 대상의 움직임이 잠시 느려진다.",
  },
  RANGED_POISON_ROUND: {
    id: "RANGED_POISON_ROUND",
    category: "RANGED",
    name: "맹독탄",
    element: "POISON",
    description: "원거리 공격에 맹독이 깃든다. 적중한 대상은 일정 시간 지속 피해를 입는다.",
  },
  RANGED_FIRE_ROUND: {
    id: "RANGED_FIRE_ROUND",
    category: "RANGED",
    name: "소이탄",
    element: "FIRE",
    description: "원거리 공격에 화염이 깃든다. 적중한 대상은 잠시 불타며 추가 피해를 입는다.",
  },
  RANGED_MAG_UP: {
    id: "RANGED_MAG_UP",
    category: "RANGED",
    name: "확장 탄창",
    description: "탄창 용량이 3발 증가한다.",
  },
  HEALTH_MAX_UP: {
    id: "HEALTH_MAX_UP",
    category: "HEALTH",
    name: "남은 숨",
    description: "최대 체력이 증가하고 증가한 만큼 즉시 회복한다.",
  },
  HEALTH_REGEN: {
    id: "HEALTH_REGEN",
    category: "HEALTH",
    name: "되찾은 숨",
    description: "방을 클리어할 때마다 체력을 소량 회복한다.",
  },
  HEALTH_ARMOR: {
    id: "HEALTH_ARMOR",
    category: "HEALTH",
    name: "굳은 몸",
    description: "받는 피해가 소폭 감소한다.",
  },
  HEALTH_MASK: {
    id: "HEALTH_MASK",
    category: "HEALTH",
    name: "이름 없는 낯",
    description: "피격 직후 무적 시간이 늘어난다.",
  },
  MELEE_BERSERK: {
    id: "MELEE_BERSERK",
    category: "MELEE",
    name: "분노한 칼날",
    description: "체력이 30% 이하일 때 근접 공격력이 25% 증가한다.",
  },
  RANGED_RELOAD_BURST: {
    id: "RANGED_RELOAD_BURST",
    category: "RANGED",
    name: "사냥꾼의 리볼버",
    description: "재장전 직후 첫 발의 피해가 50% 증가한다.",
  },
  MOBILITY_FEATHER: {
    id: "MOBILITY_FEATHER",
    category: "MOBILITY",
    name: "떨어지지 않는 깃털",
    description: "낭떠러지에 떨어져도 피해를 입지 않는다.",
  },
  HEALTH_VAMPIRE: {
    id: "HEALTH_VAMPIRE",
    category: "HEALTH",
    name: "멈추지 않는 심장",
    description: "근접 공격 적중 시 15% 확률로 체력을 1 회복한다.",
  },
};

export const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];
