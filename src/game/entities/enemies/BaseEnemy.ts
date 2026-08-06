/**
 * 적 공통 뼈대.
 *
 * 이 파일과 하위 3종은 전투 담당(팀원)의 영역이다. (DEC-007)
 * 시스템 담당이 요구하는 계약은 두 가지뿐이다.
 *   1. 사망 시 반드시 `defeat()`를 거친다. RoomController의 클리어 판정이 여기에 걸려 있다.
 *   2. 체력·공격력은 `data/enemies.ts` 정의만 사용한다. 분석 결과로 이 값을 올리지 않는다. (DEC-004)
 */

import type Phaser from "phaser";

import { ENEMIES, type EnemyDefinition } from "../../data/enemies";
import type { CombatArena } from "../../types/combat";
import type { EnemyType } from "../../types/game";

export interface EnemyDeps {
  scene: Phaser.Scene;
  /**
   * 지형과 공격체 그룹.
   * 본체는 `arena.enemyBodies`에, 투사체·장판은 `arena.enemyAttacks`에 넣는다.
   * 본체에는 반드시 `setData("enemy", this)`를 걸어야 씬이 피해를 전달할 수 있다.
   */
  arena: CombatArena;
  /** 플레이어의 현재 위치. 추격·조준에 쓴다. 플레이어 객체를 직접 참조하지 않는다. */
  getPlayerPosition: () => { x: number; y: number };
  /** 사망 시 RoomController에 알린다. 이 호출이 빠지면 방이 끝나지 않는다. */
  onDefeated: () => void;
}

export abstract class BaseEnemy {
  readonly definition: EnemyDefinition;
  protected readonly scene: Phaser.Scene;
  private readonly onDefeated: () => void;

  /** 팀원 담당: 실제 스프라이트/바디로 교체한다. */
  sprite: Phaser.GameObjects.GameObject | null = null;

  hp: number;
  private defeated = false;

  protected constructor(type: EnemyType, deps: EnemyDeps) {
    this.definition = ENEMIES[type];
    this.scene = deps.scene;
    this.onDefeated = deps.onDefeated;
    this.hp = this.definition.hp;
  }

  abstract spawn(x: number, y: number): void;

  abstract update(time: number, deltaMs: number): void;

  takeDamage(amount: number): void {
    if (this.defeated) return;
    this.hp -= amount;
    if (this.hp <= 0) this.defeat();
  }

  /** 사망 처리. 두 번 호출돼도 클리어 판정이 두 번 진행되지 않는다. */
  protected defeat(): void {
    if (this.defeated) return;
    this.defeated = true;
    this.destroy();
    this.onDefeated();
  }

  get isDefeated(): boolean {
    return this.defeated;
  }

  destroy(): void {
    // 팀원 담당: 스프라이트와 타이머 정리
    this.sprite = null;
  }
}
