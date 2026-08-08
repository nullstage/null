/**
 * 런 하나의 단일 진실 원천. (CLAUDE.md 게임 상태 관리)
 *
 * Scene, UI, 적 객체가 각각 독립적으로 진행 상태를 바꾸지 않도록
 * 방 번호·텔레메트리·강화·예측은 전부 여기를 거친다.
 *
 * MVP_PLAN §9의 "반드시 초기화할 값"은 `reset()` 하나로 전부 되돌아가야 한다.
 */

import { eventBus } from "../EventBus";
import { PLAYER } from "../config/gameBalance";
import { DEFAULT_BOSS_WEIGHTS } from "../data/directorRules";
import { FIXED_ROOM_SEQUENCE } from "../data/rooms";
import { TUNING } from "../entities/Player";
import type {
  BossPattern,
  BossPatternWeights,
  CombatTelemetry,
  DeceptionResult,
  DirectorAnalysis,
  GamePhase,
  PlayStyle,
  RoomId,
  RoomRecord,
  RunResult,
  UpgradeId,
} from "../types/game";

const emptyPatternUsage = (): Record<BossPattern, number> => ({
  slash: 0,
  dash: 0,
  projectile: 0,
  slam: 0,
});

export class RunState {
  phase: GamePhase = "BOOT";
  roomIndex = 0;
  currentRoomId: RoomId = "";

  currentTelemetry: CombatTelemetry | null = null;
  previousTelemetry: CombatTelemetry | null = null;

  /** 방 3 입장 전에 Director가 확정한 예측. 역기만 판정의 기준이 된다. */
  predictedStyle: PlayStyle | null = null;
  counterRoomId: RoomId | null = null;
  latestAnalysis: DirectorAnalysis | null = null;

  selectedUpgrades: UpgradeId[] = [];
  bossWeights: BossPatternWeights = { ...DEFAULT_BOSS_WEIGHTS };
  bossPatternUsage: Record<BossPattern, number> = emptyPatternUsage();
  deception: DeceptionResult | null = null;

  hp: number = PLAYER.maxHp;
  maxHp: number = PLAYER.maxHp;

  /** 사망·포기로 튜토리얼에 되돌아온 상태인지. true면 방 1 기록자 대화창을 건너뛴다. */
  skipTutorialIntro = false;

  /** 이번 시도(런 시작 또는 마지막 부활 이후)에 처치한 적 수. 사망 결과창에 쓴다. */
  kills = 0;
  /** 이번 시도가 시작된 시각. 사망 결과창의 생존 시간 계산 기준. */
  private attemptStartedAtMs = 0;

  private rooms: RoomRecord[] = [];
  private runStartedAtMs = 0;
  private runEndedAtMs = 0;

  /** MVP_PLAN §9 — 재시작 시 이전 런 데이터가 남아 있으면 안 된다. */
  reset(nowMs: number): void {
    this.roomIndex = 0;
    this.currentRoomId = "";
    this.currentTelemetry = null;
    this.previousTelemetry = null;
    this.predictedStyle = null;
    this.counterRoomId = null;
    this.latestAnalysis = null;
    this.selectedUpgrades = [];
    this.bossWeights = { ...DEFAULT_BOSS_WEIGHTS };
    this.bossPatternUsage = emptyPatternUsage();
    this.deception = null;
    this.hp = PLAYER.maxHp;
    this.maxHp = PLAYER.maxHp;
    this.rooms = [];
    this.skipTutorialIntro = false;
    this.kills = 0;
    this.attemptStartedAtMs = nowMs;
    this.runStartedAtMs = nowMs;
    this.runEndedAtMs = 0;

    // 필드를 모두 비운 뒤에 알린다. 직접 대입하면 setPhase의 중복 가드에 걸려
    // `phase:change`가 발행되지 않고, React 레이어가 READY 화면을 띄우지 못한다.
    this.setPhase("READY");
  }

  /**
   * 사망 시 런을 끝내지 않고 튜토리얼 방으로 되돌린다. (게임 루프 변경 — 사용자 확정)
   * 강화(`selectedUpgrades`)와 `maxHp`는 그대로 둔다 — 그게 "런을 유지한다"는 뜻이다.
   * 그 외 방 진행·텔레메트리·분석·보스 가중치는 `reset()`과 동일하게 되돌려야
   * 방 1부터 다시 겪을 때 이전 시도의 기록과 섞이지 않는다.
   */
  respawnAtTutorial(nowMs: number): void {
    this.roomIndex = 0;
    this.currentRoomId = "";
    this.currentTelemetry = null;
    this.previousTelemetry = null;
    this.predictedStyle = null;
    this.counterRoomId = null;
    this.latestAnalysis = null;
    this.bossWeights = { ...DEFAULT_BOSS_WEIGHTS };
    this.bossPatternUsage = emptyPatternUsage();
    this.deception = null;
    this.rooms = [];
    this.hp = this.maxHp;
    this.skipTutorialIntro = true;
    this.kills = 0;
    this.attemptStartedAtMs = nowMs;
  }

  recordKill(): void {
    this.kills += 1;
  }

  /** 이번 시도의 생존 시간. 사망 결과창에 쓴다. */
  attemptDurationMs(nowMs: number): number {
    return Math.max(0, nowMs - this.attemptStartedAtMs);
  }

  setPhase(phase: GamePhase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    eventBus.emit("phase:change", { phase });
  }

  beginRoom(roomId: RoomId): void {
    this.roomIndex += 1;
    this.currentRoomId = roomId;
    eventBus.emit("room:start", {
      roomIndex: this.roomIndex,
      roomId,
      showIntro: roomId === FIXED_ROOM_SEQUENCE[0] && !this.skipTutorialIntro,
    });
  }

  /** 방 클리어 기록. 같은 방에 두 번 호출되면 무시한다. (MVP_PLAN §12 중복 이벤트 대응) */
  completeRoom(telemetry: CombatTelemetry): boolean {
    if (this.rooms.some((room) => room.roomIndex === this.roomIndex)) return false;

    this.rooms.push({
      roomIndex: this.roomIndex,
      roomId: this.currentRoomId,
      telemetry,
      analysis: null,
    });
    this.previousTelemetry = this.currentTelemetry;
    this.currentTelemetry = telemetry;

    if (this.selectedUpgrades.includes("HEALTH_REGEN")) this.heal(TUNING.upgrade.healthRegenAmount);

    eventBus.emit("room:clear", { roomIndex: this.roomIndex, telemetry });
    return true;
  }

  attachAnalysis(analysis: DirectorAnalysis): void {
    this.latestAnalysis = analysis;
    this.predictedStyle = analysis.style;
    this.counterRoomId = analysis.counterRoomId;

    const record = this.rooms.find((room) => room.roomIndex === this.roomIndex);
    if (record) record.analysis = analysis;

    eventBus.emit("analysis:ready", { analysis });
  }

  addUpgrade(upgradeId: UpgradeId): void {
    if (this.selectedUpgrades.includes(upgradeId)) return;
    this.selectedUpgrades.push(upgradeId);

    if (upgradeId === "HEALTH_MAX_UP") {
      this.maxHp += TUNING.upgrade.healthMaxBonus;
      this.heal(TUNING.upgrade.healthMaxBonus);
    }
  }

  setBossWeights(weights: BossPatternWeights): void {
    this.bossWeights = { ...weights };
    eventBus.emit("boss:weights", { weights: this.bossWeights });
  }

  recordBossPattern(pattern: BossPattern): void {
    this.bossPatternUsage[pattern] += 1;
  }

  setDeception(result: DeceptionResult): void {
    this.deception = result;
    if (result.succeeded) this.heal(result.healedAmount);
    eventBus.emit("deception:result", { result });
  }

  damage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
  }

  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  get isDead(): boolean {
    return this.hp <= 0;
  }

  get roomRecords(): readonly RoomRecord[] {
    return this.rooms;
  }

  buildResult(nowMs: number, cleared: boolean): RunResult {
    this.runEndedAtMs = nowMs;
    return {
      cleared,
      totalTimeMs: Math.max(0, this.runEndedAtMs - this.runStartedAtMs),
      rooms: this.rooms.map((room) => ({ ...room })),
      finalStyle: this.latestAnalysis?.style ?? "MIXED",
      deception: this.deception,
      bossWeights: { ...this.bossWeights },
      bossPatternUsage: { ...this.bossPatternUsage },
      selectedUpgrades: [...this.selectedUpgrades],
    };
  }
}

/** 런타임 전역 인스턴스. 게임을 파괴하고 다시 만들 때도 같은 객체를 reset해서 쓴다. */
export const runState = new RunState();
