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

/** MVP_PLAN §2 강화 6종 */
export type UpgradeId =
  | "MELEE_DAMAGE_UP"
  | "MELEE_FINISHER_RANGE_UP"
  /** 검 자체를 벼린다. 수치와 함께 궤적 색이 바뀌어 눈으로 확인된다. */
  | "BLADE_REFORGED"
  | "RANGED_COOLDOWN_DOWN"
  | "RANGED_PIERCE"
  /** 총 자체를 개조한다. 탄속과 피해가 오르고 탄 궤적이 길고 밝아진다. */
  | "BARREL_REFORGED"
  | "DASH_CHARGE_UP"
  | "DASH_FOLLOWUP_DAMAGE_UP";

export type UpgradeCategory = "MELEE" | "RANGED" | "MOBILITY";

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
  /** 지연 폭발 장판 함정 활성화 여부 (MVP_PLAN §2) */
  hazardsEnabled: boolean;
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
}
