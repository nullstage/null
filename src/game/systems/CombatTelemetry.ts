/**
 * 방 하나 분량의 전투 기록. (MVP_PLAN §3)
 *
 * 전투 담당(팀원)은 이 클래스의 `record*` 메서드만 호출하면 된다.
 * 평균 교전 거리, 이동 경로 분석, 실시간 학습은 MVP 범위 밖이다.
 */

import type { CombatTelemetry } from "../types/game";

export const emptyTelemetry = (): CombatTelemetry => ({
  meleeAttacks: 0,
  meleeHits: 0,
  rangedAttacks: 0,
  rangedHits: 0,
  dashCount: 0,
  airAttackCount: 0,
  damageTakenCount: 0,
  clearTimeMs: 0,
  remainingHp: 0,
});

export class CombatTelemetryRecorder {
  private data: CombatTelemetry = emptyTelemetry();
  private startedAtMs = 0;
  private running = false;

  /** 방 시작 시 호출한다. 이전 방 값이 남지 않도록 매번 초기화한다. */
  begin(nowMs: number): void {
    this.data = emptyTelemetry();
    this.startedAtMs = nowMs;
    this.running = true;
  }

  recordMeleeAttack(): void {
    this.data.meleeAttacks += 1;
  }

  recordMeleeHit(): void {
    this.data.meleeHits += 1;
  }

  recordRangedAttack(): void {
    this.data.rangedAttacks += 1;
  }

  recordRangedHit(): void {
    this.data.rangedHits += 1;
  }

  recordDash(): void {
    this.data.dashCount += 1;
  }

  recordAirAttack(): void {
    this.data.airAttackCount += 1;
  }

  recordDamageTaken(): void {
    this.data.damageTakenCount += 1;
  }

  /** 방 종료 시 호출한다. 이미 종료된 방에 두 번 호출해도 값이 덮이지 않는다. */
  end(nowMs: number, remainingHp: number): CombatTelemetry {
    if (this.running) {
      this.data.clearTimeMs = Math.max(0, nowMs - this.startedAtMs);
      this.data.remainingHp = remainingHp;
      this.running = false;
    }
    return this.snapshot();
  }

  /** 진행 중에도 안전하게 읽을 수 있는 복사본 */
  snapshot(): CombatTelemetry {
    return { ...this.data };
  }

  get isRunning(): boolean {
    return this.running;
  }
}
