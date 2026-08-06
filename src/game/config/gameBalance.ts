/**
 * 전투 수치.
 *
 * 여기 있는 값은 대부분 아직 결정되지 않았다. `docs/OpenQuestions.md`를 정본으로 본다.
 * 뼈대가 동작하려면 값이 필요하므로 임시값을 두되, 확정 전까지는 결정된 수치로 취급하지 않는다.
 * 실제 조율은 전투 담당(팀원)이 MVP_PLAN §12 오후 밸런스 목표에 맞춰 진행한다.
 */

/** OQ-007 미결정 — 최대 체력, 피격 데미지, 무적 시간 */
export const PLAYER = {
  maxHp: 100,
  damagePerHit: 20,
  invulnerabilityMs: 800,
  moveSpeed: 220,
  jumpVelocity: 520,
  dashDistance: 180,
  dashInvulnerabilityMs: 200,
  dashCharges: 1,
  meleeCooldownMs: 260,
  rangedCooldownMs: 420,
  modeSwitchMs: 0,
} as const;

/**
 * OQ-007 미결정 — 적 수치.
 * MVP_PLAN §5에 따라 Director는 이 값을 성향에 맞춰 올리거나 내리지 않는다.
 * 적 체력·공격력은 어떤 경우에도 분석 결과에 연동하지 않는다.
 */
export const ENEMY = {
  CHASER: { hp: 30, contactDamage: 20, moveSpeed: 150, telegraphMs: 450 },
  RANGED: { hp: 24, contactDamage: 20, moveSpeed: 90, telegraphMs: 550 },
  MOBILITY_COUNTER: { hp: 28, contactDamage: 20, moveSpeed: 110, telegraphMs: 700 },
} as const;

/** OQ-007 미결정 — 보스 수치. 성향에 따라 변경하지 않는다. (MVP_PLAN §8) */
export const BOSS = {
  hp: 600,
  patternCooldownMs: 1200,
  /** 동일 패턴이 이 횟수만큼 연속 선택되지 않도록 제한한다. (MVP_PLAN §8) */
  maxSamePatternStreak: 2,
} as const;

/** 지연 폭발 장판. 예고 시간이 충분해야 소프트 카운터가 된다. (DEC-004) */
export const HAZARD = {
  telegraphMs: 900,
  damage: 20,
} as const;

/** MVP_PLAN §12 밸런스 목표. 플레이 테스트 판정 기준으로만 쓴다. */
export const PACING_TARGET = {
  roomClearMsMin: 45_000,
  roomClearMsMax: 70_000,
  bossFightMsMin: 90_000,
  bossFightMsMax: 120_000,
  runMsMin: 5 * 60_000,
  runMsMax: 8 * 60_000,
} as const;
