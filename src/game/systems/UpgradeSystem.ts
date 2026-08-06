/**
 * 강화 선택지 생성과 적용. (MVP_PLAN §2)
 *
 * OQ-016 미결정 — 강화를 몇 번 지급할지(2회/3회)가 정해지지 않았다.
 * OQ-017 미결정 — 이미 획득한 강화를 후보에서 제외할지가 정해지지 않았다.
 * 아래 구현은 "획득분 제외, 서로 다른 계열 우선"을 임시로 사용한다.
 *
 * 실제 효과 적용은 전투 담당(팀원)이 Player 쪽에서 처리한다.
 * 이 시스템은 무엇을 골랐는지만 관리한다.
 */

import { UPGRADES, UPGRADE_IDS } from "../data/upgrades";
import type { UpgradeDefinition, UpgradeId } from "../types/game";

export const OFFER_COUNT = 2;

/**
 * 후보 2개를 뽑는다.
 * `random`을 주입받는 이유는 테스트와 시연 재현을 위해서다.
 */
export const rollUpgradeChoices = (
  owned: readonly UpgradeId[],
  random: () => number = Math.random,
): UpgradeDefinition[] => {
  const pool = UPGRADE_IDS.filter((id) => !owned.includes(id));

  // 남은 후보가 부족하면 획득분까지 포함해 채운다. 선택지가 비는 상황을 만들지 않는다.
  const source = pool.length >= OFFER_COUNT ? pool : [...UPGRADE_IDS];
  const shuffled = shuffle(source, random);

  const picked: UpgradeId[] = [];
  for (const id of shuffled) {
    if (picked.length >= OFFER_COUNT) break;
    const sameCategory = picked.some(
      (chosen) => UPGRADES[chosen].category === UPGRADES[id].category,
    );
    if (!sameCategory) picked.push(id);
  }

  // 계열이 겹치지 않는 조합을 못 만들면 남은 것에서 그냥 채운다.
  for (const id of shuffled) {
    if (picked.length >= OFFER_COUNT) break;
    if (!picked.includes(id)) picked.push(id);
  }

  return picked.map((id) => UPGRADES[id]);
};

const shuffle = <T>(items: readonly T[], random: () => number): T[] => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
