/**
 * 보스.
 *
 * 이 파일은 두 담당의 경계다. (DEC-007)
 * - 패턴 "선택"은 시스템 담당 영역이라 구현되어 있다. 가중치와 연속 제한이 여기에 걸려 있다.
 * - 패턴 "실행"은 전투 담당(팀원) 영역이라 비어 있다. `execute*` 메서드를 채우면 된다.
 *
 * 제약 (MVP_PLAN §8):
 * - 보스전 시작 전에 최종 성향을 확정하고, 전투 중 재분석하지 않는다.
 * - 동일 패턴이 3회 연속 선택되지 않는다.
 * - 체력·공격력·공격 속도는 성향에 따라 변경하지 않는다.
 */

import type Phaser from "phaser";

import { BOSS } from "../config/gameBalance";
import { pickBossPattern } from "../systems/DirectorPolicy";
import type { BossPattern, BossPatternWeights } from "../types/game";

export interface BossDeps {
  scene: Phaser.Scene;
  /** 보스전 시작 전에 확정된 가중치. 전투 중 바뀌지 않는다. */
  weights: BossPatternWeights;
  onPatternSelected: (pattern: BossPattern) => void;
  onDefeated: () => void;
}

export class Boss {
  private readonly deps: BossDeps;
  private readonly scene: Phaser.Scene;

  /** 팀원 담당: 실제 스프라이트/바디로 교체한다. */
  sprite: Phaser.GameObjects.GameObject | null = null;

  hp: number = BOSS.hp;
  readonly maxHp: number = BOSS.hp;

  private lastPattern: BossPattern | null = null;
  private sameStreak = 0;
  private nextPatternAtMs = 0;
  private busy = false;
  private defeated = false;

  constructor(deps: BossDeps) {
    this.deps = deps;
    this.scene = deps.scene;
  }

  spawn(_x: number, _y: number): void {
    this.nextPatternAtMs = this.scene.time.now + BOSS.patternCooldownMs;
    // 팀원 담당: 스프라이트 생성, 등장 연출
  }

  update(time: number, _deltaMs: number): void {
    if (this.defeated || this.busy) return;
    if (time < this.nextPatternAtMs) return;

    this.runPattern(this.selectPattern());
  }

  /**
   * 가중치 기반 패턴 선택. 동일 패턴 3연속을 막는다.
   * 순수 로직이므로 여기를 고치지 말고, 실행부만 채운다.
   */
  private selectPattern(): BossPattern {
    const excluded: BossPattern[] =
      this.lastPattern && this.sameStreak >= BOSS.maxSamePatternStreak ? [this.lastPattern] : [];

    const pattern = pickBossPattern(this.deps.weights, excluded);

    this.sameStreak = pattern === this.lastPattern ? this.sameStreak + 1 : 1;
    this.lastPattern = pattern;
    this.deps.onPatternSelected(pattern);
    return pattern;
  }

  private runPattern(pattern: BossPattern): void {
    this.busy = true;

    switch (pattern) {
      case "slash":
        this.executeSlash();
        break;
      case "dash":
        this.executeDash();
        break;
      case "projectile":
        this.executeProjectile();
        break;
      case "slam":
        this.executeSlam();
        break;
    }
  }

  /** 패턴 실행이 끝나면 전투 담당이 반드시 이걸 호출한다. 안 하면 보스가 멈춘다. */
  finishPattern(): void {
    this.busy = false;
    this.nextPatternAtMs = this.scene.time.now + BOSS.patternCooldownMs;
  }

  /** 근거리 베기 */
  private executeSlash(): void {
    // 팀원 담당: 예고 → 히트박스 → finishPattern()
    this.finishPattern();
  }

  /** 돌진 */
  private executeDash(): void {
    // 팀원 담당: 예고 → 돌진 이동 → finishPattern()
    this.finishPattern();
  }

  /** 원거리 투사체 */
  private executeProjectile(): void {
    // 팀원 담당: 예고 → 투사체 발사 → finishPattern()
    this.finishPattern();
  }

  /** 점프 내려찍기. 지연 장판을 남기는 효과는 시간이 남을 때만 추가한다. (MVP_PLAN §8) */
  private executeSlam(): void {
    // 팀원 담당: 도약 → 착지 충격 → finishPattern()
    this.finishPattern();
  }

  takeDamage(amount: number): void {
    if (this.defeated) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      this.defeated = true;
      this.destroy();
      this.deps.onDefeated();
    }
  }

  get isDefeated(): boolean {
    return this.defeated;
  }

  destroy(): void {
    // 팀원 담당: 스프라이트와 타이머 정리
    this.sprite = null;
  }
}
