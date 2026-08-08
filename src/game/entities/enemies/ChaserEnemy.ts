/**
 * 추격형. 원거리 플레이를 압박한다. (MVP_PLAN §2)
 * 전투 담당(팀원) 영역.
 *
 * 행동 흐름:
 *   추격 → (사거리 진입) 예고 → 돌진 → 경직 회복 → 추격
 *
 * 두 가지가 이 적의 정체성이다.
 *   1. 돌진 전 `definition.telegraphMs` 동안 진행 방향을 바닥에 깔아 보여준다. 안 보이면 하드 카운터다. (DEC-004)
 *   2. 근거리에서 맞으면 경직된다. 붙어서 때리는 플레이어에게는 흐름이 끊기고,
 *      멀리서 쏘기만 하는 플레이어는 계속 쫓기게 된다. 이게 원거리 압박의 실체다.
 */

import type Phaser from "phaser";

import { enemySlash } from "../../systems/CombatVfx";
import { SILHOUETTE, TEXTURE } from "../../types/combat";
import { BaseEnemy, type EnemyDeps } from "./BaseEnemy";

/**
 * 히트박스 월드 크기와 시트 배치. 원본 셀(64px)에서 고블린 그림은
 * 대략 x22~43, 발끝 y≈44에만 있다 — 셀 여백을 빼고 그림 기준으로 잡는다.
 */
const BODY_WIDTH = 42;
const BODY_HEIGHT = 48;
const SHEET = { scale: 3.2, anchorX: 32.5, anchorY: 44 };

/** 이 거리 안으로 들어오면 돌진을 준비한다. */
const LUNGE_RANGE = 230;
/** 이만큼 앞의 바닥을 미리 살핀다. 발 앞이 아니라 살짝 앞서 봐야 급정거가 자연스럽다. */
const LEDGE_LOOKAHEAD = 24;
/** 돌진 속도. 추격 속도보다 확실히 빨라야 "덤벼든다"로 읽힌다. */
const LUNGE_SPEED = 540;
/** 돌진 지속 시간(ms). */
const LUNGE_MS = 260;
/** 돌진 후 빈틈(ms). 근접 플레이어의 반격 창이다. */
const RECOVER_MS = 520;
/** 경직 시간(ms). */
const STAGGER_MS = 420;
/** 이 거리 안에서 맞으면 경직된다. 근접 공격에 약하다는 정의를 거리로 근사한다. */
const STAGGER_RANGE = 130;
/** 잔상 간격(ms). */
const AFTERIMAGE_INTERVAL_MS = 45;
/** 예고 띠의 두께. 바닥에 깔리는 형태라 얇다. */
const TELEGRAPH_HEIGHT = 10;
const TELEGRAPH_ALPHA_FROM = 0.15;
const TELEGRAPH_ALPHA_TO = 0.55;

type ChaserState = "CHASE" | "WINDUP" | "LUNGE" | "RECOVER" | "STAGGER";

export class ChaserEnemy extends BaseEnemy {
  private state: ChaserState = "CHASE";
  /** 현재 상태에 머문 시간(ms). 타이머 대신 쓴다. 씬이 내려갈 때 정리할 게 없다. */
  private stateMs = 0;
  private facing = 1;
  private afterimageMs = 0;
  private telegraph: Phaser.GameObjects.Image | null = null;

  constructor(deps: EnemyDeps) {
    super("CHASER", deps);
  }

  spawn(x: number, y: number): void {
    const body = this.spawnBody(x, y, TEXTURE.chaser, BODY_WIDTH, BODY_HEIGHT, SHEET);
    body.play("chaserIdle");
  }

  update(_time: number, deltaMs: number): void {
    const body = this.sprite;
    if (!body) return;

    this.stateMs += deltaMs;
    const dx = this.getPlayerPosition().x - body.x;

    switch (this.state) {
      case "CHASE": {
        this.facing = dx === 0 ? this.facing : Math.sign(dx);
        body.setFlipX(this.facing < 0);
        // 낭떠러지 앞이면 멈춘다 — 플레이어처럼 점프해서 건너지 못한다.
        const aheadX = body.x + this.facing * LEDGE_LOOKAHEAD;
        if (this.hasFloorBelow(aheadX)) {
          body.setVelocityX(this.facing * this.definition.moveSpeed);
          body.anims.play("chaserWalk", true);
        } else {
          body.setVelocityX(0);
          body.anims.play("chaserIdle", true);
        }
        if (Math.abs(dx) <= LUNGE_RANGE) this.beginWindup();
        break;
      }

      case "WINDUP":
        // 예고 중에는 멈춘다. 쫓아오면서 예고하면 피할 자리가 없다.
        body.setVelocityX(0);
        if (this.stateMs >= this.definition.telegraphMs) this.beginLunge();
        break;

      case "LUNGE":
        this.afterimageMs += deltaMs;
        if (this.afterimageMs >= AFTERIMAGE_INTERVAL_MS) {
          this.afterimageMs = 0;
          this.spawnAfterimage();
        }
        if (this.stateMs >= LUNGE_MS) {
          body.setVelocityX(0);
          this.enter("RECOVER");
        }
        break;

      case "RECOVER":
      case "STAGGER":
        body.setVelocityX(0);
        body.anims.play("chaserIdle", true);
        if (this.stateMs >= (this.state === "RECOVER" ? RECOVER_MS : STAGGER_MS)) {
          this.setStateTint(null);
          this.enter("CHASE");
        }
        break;
    }
  }

  /**
   * 근거리에서 맞으면 예고든 돌진이든 끊긴다. (data/enemies.ts weakness)
   * 원거리 적중으로는 끊기지 않으므로 "붙어서 때린다"는 선택에만 보상이 간다.
   */
  takeDamage(amount: number): void {
    super.takeDamage(amount);

    const body = this.sprite;
    if (this.isDefeated || !body) return;
    if (Math.abs(this.getPlayerPosition().x - body.x) > STAGGER_RANGE) return;

    body.setVelocityX(0);
    this.clearTelegraph();
    this.setStateTint(null);
    this.enter("STAGGER");
  }

  destroy(): void {
    this.clearTelegraph();
    super.destroy();
  }

  // ────────────────────────────── 상태 전이 ──────────────────────────────

  private enter(state: ChaserState): void {
    this.state = state;
    this.stateMs = 0;
  }

  private beginWindup(): void {
    const body = this.sprite;
    if (!body) return;

    this.enter("WINDUP");
    this.setStateTint(SILHOUETTE.telegraph);

    // 돌진이 지나갈 자리를 미리 깐다. 어디로 오는지 모르면 피할 수 없다. (DEC-004)
    const telegraph = this.scene.add.image(body.x, body.y + BODY_HEIGHT / 2, TEXTURE.telegraph);
    telegraph.setOrigin(this.facing > 0 ? 0 : 1, 0.5);
    telegraph.setDisplaySize(LUNGE_RANGE, TELEGRAPH_HEIGHT);
    telegraph.setAlpha(TELEGRAPH_ALPHA_FROM);
    this.telegraph = telegraph;

    this.scene.tweens.add({
      targets: telegraph,
      alpha: TELEGRAPH_ALPHA_TO,
      duration: this.definition.telegraphMs,
    });
  }

  private beginLunge(): void {
    this.clearTelegraph();
    this.setStateTint(null);
    this.afterimageMs = 0;
    this.enter("LUNGE");
    const body = this.sprite;
    if (!body) return;
    body.setVelocityX(this.facing * LUNGE_SPEED);
    body.anims.play("chaserAttack", true);

    // 단검 베기 이펙트 + 실제 판정. 본체 접촉에만 의존하면 스치듯 지나갈 때
    // 데미지가 안 들어가는 것처럼 느껴진다 — 돌진 구간 동안 앞쪽에 판정을 함께 실어 보낸다.
    enemySlash(this.scene, body.x + this.facing * 20, body.y, this.facing as 1 | -1, 42);
    const hitbox = this.scene.physics.add.image(
      body.x + this.facing * 28,
      body.y,
      TEXTURE.enemyAttack,
    );
    hitbox.setDisplaySize(46, 40);
    hitbox.setAlpha(0);
    this.arena.enemyAttacks.add(hitbox);
    (hitbox.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    (hitbox.body as Phaser.Physics.Arcade.Body).setVelocityX(this.facing * LUNGE_SPEED);
    hitbox.setData("damage", this.definition.contactDamage);
    hitbox.setData("consumeOnHit", true);
    // 패링 반사용 — 이 공격을 누가 냈는지 알아야 씬이 반사 피해를 되돌려줄 수 있다.
    hitbox.setData("source", this);
    this.scene.time.delayedCall(LUNGE_MS, () => hitbox.destroy());
  }

  private clearTelegraph(): void {
    if (!this.telegraph) return;
    // 지운 객체에 트윈이 계속 값을 쓰지 않도록 먼저 끊는다.
    this.scene.tweens.killTweensOf(this.telegraph);
    this.telegraph.destroy();
    this.telegraph = null;
  }
}
