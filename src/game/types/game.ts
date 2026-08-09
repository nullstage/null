/**
 * 시스템 공통 계약.
 *
 * 이 파일은 시스템 담당이 관리한다. (DEC-007)
 * 여기 정의된 타입은 `MVP_PLAN.md` §3, §4, §8, §9에서 온 정본이므로
 * 임의로 이름이나 필드를 바꾸지 않는다. 변경이 필요하면 먼저 질문으로 등록한다.
 */

/** MVP_PLAN §9 게임 상태 흐름 */
export type GamePhase =
  | "BOOT"
  | "READY"
  | "COMBAT"
  | "ANALYSIS"
  | "UPGRADE"
  | "BOSS"
  | "RESULT"
  | "GAME_OVER";

/** MVP_PLAN §4 플레이 스타일 */
export type PlayStyle = "MELEE" | "RANGED" | "MOBILE" | "MIXED";

/** 플레이어의 공격 모드. 무기 두 개가 아니라 한 무기의 두 모드다. (MVP_PLAN §2) */
export type AttackMode = "MELEE" | "RANGED";

/** MVP_PLAN §2 적 3종 */
export type EnemyType = "CHASER" | "RANGED" | "MOBILITY_COUNTER";

/** MVP_PLAN §2 방 템플릿 */
export type RoomTemplate = "HORIZONTAL" | "PLATFORM";

/** 방 프리셋 식별자. 카운터 방은 `counter_*` 접두사를 쓴다. */
export type RoomId = string;

/** MVP_PLAN §2 강화. 공격(근접·원거리)·기동 8종에 체력 계열과 속성 무기를 더했다. */
export type UpgradeId =
  | "MELEE_DAMAGE_UP"
  | "MELEE_FINISHER_RANGE_UP"
  /** 검 자체를 벼린다. 수치와 함께 궤적 색이 바뀌어 눈으로 확인된다. */
  | "BLADE_REFORGED"
  | "MELEE_BLADE_SIZE_UP"
  /** 화염 속성. 근접 적중 시 짧은 화상 대미지가 따로 들어간다. */
  | "MELEE_FIRE_EDGE"
  /** 스킬 해금(Q) — 멀리 베는 참격. */
  | "MELEE_SWORD_WAVE"
  /** 스킬 해금(R) — 전방 바닥에서 연쇄로 솟구치는 검의 가시. */
  | "MELEE_SPIKE_ERUPTION"
  /** 스킬 해금(F) — 주위 전방위를 베는 검의 폭풍. */
  | "MELEE_BLADE_CYCLONE"
  | "RANGED_COOLDOWN_DOWN"
  | "RANGED_PIERCE"
  /** 총 자체를 개조한다. 탄속과 피해가 오르고 탄 궤적이 길고 밝아진다. */
  | "BARREL_REFORGED"
  | "RANGED_BULLET_SIZE_UP"
  /** 냉기 속성. 원거리 적중 시 대상이 짧게 느려진다. */
  | "RANGED_FROST_ROUND"
  /** 맹독 속성. 원거리 적중 시 길고 약한 독 틱이 들어간다. */
  | "RANGED_POISON_ROUND"
  /** 화염 속성 탄. 근접 화염과 같은 화상 틱을 원거리에도 붙인다. */
  | "RANGED_FIRE_ROUND"
  /** 탄창 확장. 재장전 없이 쏠 수 있는 발수가 늘어난다. */
  | "RANGED_MAG_UP"
  | "DASH_CHARGE_UP"
  | "DASH_FOLLOWUP_DAMAGE_UP"
  | "DASH_COOLDOWN_DOWN"
  | "DASH_INVULN_UP"
  | "HEALTH_MAX_UP"
  /** 방을 클리어할 때마다 소량 회복한다. 큰 폭은 아니다. */
  | "HEALTH_REGEN"
  /** 받는 피해를 소폭 줄인다(내구력). */
  | "HEALTH_ARMOR"
  /**
   * 아티팩트 — 이름 없는 낯. 그림자에게 이름을 삼켜진 자가 남긴 가면.
   * 이름이 없으면 침식도 오래 붙잡지 못한다 — 피격 직후 무적 시간이 늘어난다.
   */
  | "HEALTH_MASK";

export type UpgradeCategory = "MELEE" | "RANGED" | "MOBILITY" | "HEALTH";

/** 무기에 붙는 속성. 지금은 얕은 부가 효과 하나씩만 준다(화상 틱 / 감속 / 독 틱) — 상성표는 없다. */
export type UpgradeElement = "FIRE" | "FROST" | "POISON";

/** MVP_PLAN §3 전투 텔레메트리. 방 하나마다 하나씩 만든다. */
export interface CombatTelemetry {
  meleeAttacks: number;
  meleeHits: number;
  rangedAttacks: number;
  rangedHits: number;
  dashCount: number;
  airAttackCount: number;
  damageTakenCount: number;
  clearTimeMs: number;
  remainingHp: number;
}

/** MVP_PLAN §3 분석 결과 */
export interface DirectorAnalysis {
  style: PlayStyle;
  confidence: number;
  meleeRatio: number;
  rangedRatio: number;
  mobilityScore: number;
  counterRoomId: RoomId;
  dialogueId: string;
}

/** MVP_PLAN §8 보스 패턴 가중치 */
export interface BossPatternWeights {
  slash: number;
  dash: number;
  projectile: number;
  slam: number;
}

export type BossPattern = keyof BossPatternWeights;

/** MVP_PLAN §6 역기만 판정 결과 */
export interface DeceptionResult {
  predictedStyle: PlayStyle;
  actualStyle: PlayStyle;
  succeeded: boolean;
  healedAmount: number;
}

export interface UpgradeDefinition {
  id: UpgradeId;
  category: UpgradeCategory;
  name: string;
  description: string;
  /** 있으면 이 강화는 속성 무기다. UI·이펙트 색 결정에 쓴다. */
  element?: UpgradeElement;
}

export interface EnemySpawn {
  type: EnemyType;
  /** 방 폭에 대한 비율(0~1). 실제 좌표는 방 템플릿이 환산한다. */
  xRatio: number;
  /** 방 시작 후 스폰까지의 지연 시간(ms) */
  delayMs: number;
}

export interface RoomPreset {
  id: RoomId;
  template: RoomTemplate;
  spawns: EnemySpawn[];
  /**
   * `spawns`를 전멸시킨 뒤 몇 번 더 같은 구성으로 다시 스폰할지. 생략하면 0(웨이브 없음).
   * 방은 이 웨이브를 전부 전멸시켜야 클리어된다 — 포탈은 그때만 열린다.
   */
  extraWaves?: number;
}

/** 결과 리포트에 쓰는 방 단위 기록 */
export interface RoomRecord {
  roomIndex: number;
  roomId: RoomId;
  telemetry: CombatTelemetry;
  analysis: DirectorAnalysis | null;
}

export interface RunResult {
  cleared: boolean;
  totalTimeMs: number;
  rooms: RoomRecord[];
  finalStyle: PlayStyle;
  deception: DeceptionResult | null;
  bossWeights: BossPatternWeights;
  bossPatternUsage: Record<BossPattern, number>;
  selectedUpgrades: UpgradeId[];
}

/** 전투 중 React HUD가 표시하는 최소 상태 */
export interface HudState {
  hp: number;
  maxHp: number;
  mode: AttackMode;
  roomIndex: number;
  enemiesRemaining: number;
  /** 상태창(E)이 보여줄 보유 아티팩트 목록. */
  selectedUpgrades: readonly UpgradeId[];
  /** 남은 탄. 원거리 모드일 때만 HUD에 그린다. */
  ammo: number;
  magazineSize: number;
  /** 재장전 중인가. HUD가 "재장전" 표시로 바꾼다. */
  reloading: boolean;
  /** 그림자 조각 — 적 처치로 모으고 마을 상인에게 쓰는 런 화폐. */
  shards: number;
  /** 해금된 액티브 스킬 목록. key는 현재 바인딩 키, ready는 재사용 대기 여부. */
  skills: readonly { id: UpgradeId; key: string; ready: boolean }[];
}
