/**
 * 플레이어.
 *
 * ─────────────────────────────────────────────
 * 이 파일은 전투 담당(팀원)의 영역이다. (DEC-007)
 * 시스템 담당은 텔레메트리 기록 지점과 이벤트 발신만 미리 심어두었다.
 * 구현할 때 `// 팀원 담당` 주석을 지우고 채우되, 아래 두 가지는 지우지 않는다.
 *   1. `this.telemetry.record*()` 호출 — Director 분석의 유일한 입력이다.
 *   2. `emitHud()` 호출 — React HUD가 이걸로만 갱신된다.
 * ─────────────────────────────────────────────
 *
 * 수치는 `config/gameBalance.ts`, 키 매핑은 `config/inputConfig.ts`를 참조한다.
 * 여기에 숫자나 키 코드를 직접 쓰지 않는다.
 */

import type Phaser from "phaser";

import { eventBus } from "../EventBus";
import { PLAYER } from "../config/gameBalance";
import type { CombatTelemetryRecorder } from "../systems/CombatTelemetry";
import type { AttackMode, UpgradeId } from "../types/game";

export interface PlayerDeps {
  scene: Phaser.Scene;
  telemetry: CombatTelemetryRecorder;
  /** 획득한 강화 목록. 효과 적용은 전투 담당이 한다. */
  upgrades: readonly UpgradeId[];
  onDamaged: (amount: number) => void;
  onDeath: () => void;
}

export class Player {
  readonly scene: Phaser.Scene;
  private readonly telemetry: CombatTelemetryRecorder;
  private readonly deps: PlayerDeps;

  /** 팀원 담당: 실제 스프라이트/바디로 교체한다. */
  sprite: Phaser.GameObjects.GameObject | null = null;

  mode: AttackMode = "MELEE";
  hp: number = PLAYER.maxHp;
  isGrounded = true;
  isDashing = false;

  constructor(deps: PlayerDeps) {
    this.deps = deps;
    this.scene = deps.scene;
    this.telemetry = deps.telemetry;
  }

  /** 방 시작 시 호출된다. */
  spawn(_x: number, _y: number): void {
    // 팀원 담당: 스프라이트 생성, 물리 바디 설정, 애니메이션 등록
    this.emitHud();
  }

  /** 씬의 update에서 매 프레임 호출된다. */
  update(_time: number, _deltaMs: number): void {
    // 팀원 담당: 입력 처리, 이동, 점프, 중력 처리
  }

  /** 근거리 공격 입력. 3연속 베기. */
  attackMelee(): void {
    this.telemetry.recordMeleeAttack();
    if (!this.isGrounded) this.telemetry.recordAirAttack();
    // 팀원 담당: 히트박스 생성, 콤보 단계 처리, 타격 피드백
  }

  /** 원거리 공격 입력. 짧은 쿨타임의 투사체. */
  attackRanged(): void {
    this.telemetry.recordRangedAttack();
    if (!this.isGrounded) this.telemetry.recordAirAttack();
    // 팀원 담당: 투사체 발사, 쿨타임 처리
  }

  /**
   * 공격이 적에게 실제로 맞았을 때 호출한다.
   * 분류는 시도가 아니라 적중 기준이므로(MVP_PLAN §4) 이 호출을 빠뜨리면 분석이 무너진다.
   */
  notifyHit(mode: AttackMode): void {
    if (mode === "MELEE") this.telemetry.recordMeleeHit();
    else this.telemetry.recordRangedHit();
  }

  dash(): void {
    this.telemetry.recordDash();
    // 팀원 담당: 대시 이동, 무적 또는 충돌 회피, 충전 관리
  }

  /** 근거리 ↔ 원거리 모드 전환. 즉시 또는 최대 0.3초. */
  switchMode(): void {
    this.mode = this.mode === "MELEE" ? "RANGED" : "MELEE";
    // 팀원 담당: 전환 연출
    this.emitHud();
  }

  takeDamage(amount: number = PLAYER.damagePerHit): void {
    if (this.isDashing) return;

    this.telemetry.recordDamageTaken();
    this.hp = Math.max(0, this.hp - amount);
    this.deps.onDamaged(amount);
    this.emitHud();

    // 팀원 담당: 피격 연출, 무적 시간, 넉백

    if (this.hp <= 0) this.deps.onDeath();
  }

  destroy(): void {
    // 팀원 담당: 스프라이트와 타이머 정리
    this.sprite = null;
  }

  /** HUD 갱신. 전투 담당은 상태가 바뀌는 지점에서 이걸 호출하기만 하면 된다. */
  emitHud(enemiesRemaining = 0, roomIndex = 0): void {
    eventBus.emit("hud:update", {
      hud: {
        hp: this.hp,
        maxHp: PLAYER.maxHp,
        mode: this.mode,
        roomIndex,
        enemiesRemaining,
      },
    });
  }
}
