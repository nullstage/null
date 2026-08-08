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
    name: "예리한 날",
    description: "근거리 공격력이 20% 증가한다.",
  },
  MELEE_FINISHER_RANGE_UP: {
    id: "MELEE_FINISHER_RANGE_UP",
    category: "MELEE",
    name: "확장된 마무리",
    description: "근거리 마지막 타격의 범위가 넓어진다.",
  },
  BLADE_REFORGED: {
    id: "BLADE_REFORGED",
    category: "MELEE",
    name: "다시 벼린 검",
    description: "검이 더 길고 무거워진다. 피해 35%, 사거리 증가. 궤적이 흰빛으로 바뀐다.",
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
  BARREL_REFORGED: {
    id: "BARREL_REFORGED",
    category: "RANGED",
    name: "개조된 총열",
    description: "탄이 더 빠르고 무겁게 나간다. 피해 40%, 탄속 증가. 탄 궤적이 길어진다.",
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
  DASH_COOLDOWN_DOWN: {
    id: "DASH_COOLDOWN_DOWN",
    category: "MOBILITY",
    name: "가벼운 발놀림",
    description: "대시 충전 시간이 25% 감소한다.",
  },
  DASH_INVULN_UP: {
    id: "DASH_INVULN_UP",
    category: "MOBILITY",
    name: "잔영",
    description: "대시 중 무적 시간이 늘어난다.",
  },
  MELEE_BLADE_SIZE_UP: {
    id: "MELEE_BLADE_SIZE_UP",
    category: "MELEE",
    name: "거대화",
    description: "검의 판정 범위와 궤적이 커진다.",
  },
  MELEE_FIRE_EDGE: {
    id: "MELEE_FIRE_EDGE",
    category: "MELEE",
    name: "화염의 검",
    element: "FIRE",
    description: "근접 공격이 화염 속성을 띤다. 적중한 대상이 잠시 불타 추가 피해를 입는다.",
  },
  MELEE_SWORD_WAVE: {
    id: "MELEE_SWORD_WAVE",
    category: "MELEE",
    name: "검기",
    description: "스킬 해금 — Q를 눌러 멀리 베는 참격을 날린다. 재사용 4초.",
  },
  RANGED_BULLET_SIZE_UP: {
    id: "RANGED_BULLET_SIZE_UP",
    category: "RANGED",
    name: "확장탄",
    description: "탄이 커져 판정 범위가 넓어진다.",
  },
  RANGED_FROST_ROUND: {
    id: "RANGED_FROST_ROUND",
    category: "RANGED",
    name: "냉기탄",
    element: "FROST",
    description: "원거리 공격이 냉기 속성을 띤다. 적중한 대상이 잠시 느려진다.",
  },
  RANGED_POISON_ROUND: {
    id: "RANGED_POISON_ROUND",
    category: "RANGED",
    name: "맹독탄",
    element: "POISON",
    description: "원거리 공격이 맹독 속성을 띤다. 적중한 대상이 서서히 독 피해를 입는다.",
  },
  RANGED_FIRE_ROUND: {
    id: "RANGED_FIRE_ROUND",
    category: "RANGED",
    name: "소이탄",
    element: "FIRE",
    description: "원거리 공격이 화염 속성을 띤다. 적중한 대상이 잠시 불타 추가 피해를 입는다.",
  },
  RANGED_MAG_UP: {
    id: "RANGED_MAG_UP",
    category: "RANGED",
    name: "확장 탄창",
    description: "탄창이 3발 늘어난다. 재장전 없이 더 오래 쏠 수 있다.",
  },
  HEALTH_MAX_UP: {
    id: "HEALTH_MAX_UP",
    category: "HEALTH",
    name: "튼튼한 몸",
    description: "최대 체력이 늘어난다. 늘어난 만큼 즉시 회복된다.",
  },
  HEALTH_REGEN: {
    id: "HEALTH_REGEN",
    category: "HEALTH",
    name: "회복의 기운",
    description: "방을 클리어할 때마다 체력을 소량 회복한다.",
  },
  HEALTH_ARMOR: {
    id: "HEALTH_ARMOR",
    category: "HEALTH",
    name: "내구",
    description: "받는 피해가 소폭 감소한다.",
  },
};

export const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];
