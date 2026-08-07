/**
 * 견제형. 근거리 플레이를 견제한다. (MVP_PLAN §2)
 * 전투 담당(팀원) 영역.
 *
 * 행동 흐름:
 *   거리 유지 → (재장전 완료) 조준 예고 → 발사 → 거리 유지
 *
 * 세 가지가 이 적의 정체성이다.
 *   1. 붙으면 물러난다. 근접 플레이어는 계속 쫓아다녀야 한다.
 *   2. 조준 시점의 좌표를 고정해서 쏜다. 그래서 옆으로 대시하면 빗나간다. (DEC-004)
 *   3. 벽에 몰리면 더 물러날 수 없어 발사를 멈춘다. 이때가 근접 플레이어의 보상 구간이다.
 */

// 각도·거리 계산에 Phaser.Math을 쓰므로 타입이 아니라 값으로 가져온다.
import Phaser from "phaser";

import { SILHOUETTE, TEXTURE } from "../../types/combat";
import { BaseEnemy, type EnemyDeps } from "./BaseEnemy";

/**
 * 본체 크기. 예전 플레이스홀더 값을 그대로 뒀더니 64px 원본 그림이 너무 작게
 * 눌려 보였다 — 플레이어 체감 크기에 맞춰 키운다. 벌형이라 폭·높이는 비슷하게.
 */
const BODY_WIDTH = 58;
const BODY_HEIGHT = 58;

/** 유지하려는 거리. 이보다 가까우면 물러나고, 멀면 다가온다. */
const KEEP_DISTANCE_MIN = 280;
const KEEP_DISTANCE_MAX = 440;
/** 발사 간격(ms). 예고 시간은 여기에 더해진다. */
const FIRE_INTERVAL_MS = 1400;
/** 이 거리보다 멀면 쏘지 않는다. 화면 밖에서 날아오는 탄을 만들지 않기 위한 것이다. */
const FIRE_MAX_RANGE = 620;
/** 투사체 속도. 대시로 피할 수 있어야 하므로 빠르게 하지 않는다. (DEC-004) */
const PROJECTILE_SPEED = 300;
const PROJECTILE_SIZE = 14;
/** 투사체 수명(ms). 화면을 가로지르면 사라진다. */
const PROJECTILE_LIFE_MS = 2400;
/** 이 거리 안쪽 벽에 붙으면 몰린 것으로 본다. */
const CORNER_MARGIN = 90;
/** 몰렸을 때의 투명도. 무방비 상태라는 표시다. */
const CORNERED_ALPHA = 0.6;
/** 조준선 두께. */
const AIM_LINE_HEIGHT = 4;
const AIM_ALPHA_FROM = 0.2;
const AIM_ALPHA_TO = 0.7;

export class RangedEnemy extends BaseEnemy {
  private aiming = false;
  private stateMs = 0;
  /** 마지막 발사 이후 경과 시간(ms). */
  private reloadMs = FIRE_INTERVAL_MS;
  private cornered = false;
  private aimLine: Phaser.GameObjects.Image | null = null;
  /** 조준을 시작한 시점의 플레이어 좌표. 발사는 여기로만 간다. */
  private aimTarget = { x: 0, y: 0 };

  constructor(deps: EnemyDeps) {
    super("RANGED", deps);
  }

  spawn(x: number, y: number): void {
    const body = this.spawnBody(x, y, TEXTURE.ranged, BODY_WIDTH, BODY_HEIGHT);
    body.play("rangedIdle");
  }

  update(_time: number, deltaMs: number): void {
    const body = this.sprite;
    if (!body) return;

    this.stateMs += deltaMs;

    // 조준 중이든 아니든 플레이어 쪽을 보고 있어야 "겨냥한다"가 읽힌다.
    const facingTarget = this.getPlayerPosition().x - body.x;
    if (facingTarget !== 0) body.setFlipX(facingTarget < 0);

    if (this.aiming) {
      body.setVelocityX(0);
      body.anims.play("rangedAttack", true);
      if (this.stateMs >= this.definition.telegraphMs) this.fire();
      return;
    }

    this.reloadMs += deltaMs;

    const player = this.getPlayerPosition();
    const dx = player.x - body.x;
    const distance = Math.abs(dx);
    const speed = this.definition.moveSpeed;

    if (distance < KEEP_DISTANCE_MIN) {
      // 플레이어 반대쪽으로 물러난다.
      const away = dx === 0 ? 1 : -Math.sign(dx);
      this.cornered = this.isAgainstWall(body.x, away);
      body.setVelocityX(this.cornered ? 0 : away * speed);
    } else {
      this.cornered = false;
      body.setVelocityX(distance > KEEP_DISTANCE_MAX ? Math.sign(dx) * speed : 0);
    }

    body.setAlpha(this.cornered ? CORNERED_ALPHA : 1);
    body.anims.play(body.body?.velocity.x !== 0 ? "rangedWalk" : "rangedIdle", true);

    // 몰려 있는 동안에는 쏘지 않는다. 이 빈틈이 "벽에 몰리면 취약"의 실체다.
    if (this.cornered) return;
    if (this.reloadMs >= FIRE_INTERVAL_MS && distance <= FIRE_MAX_RANGE) this.beginAim(player);
  }

  destroy(): void {
    this.clearAimLine();
    super.destroy();
  }

  // ────────────────────────────── 조준과 발사 ──────────────────────────────

  private beginAim(player: { x: number; y: number }): void {
    const body = this.sprite;
    if (!body) return;

    this.aiming = true;
    this.stateMs = 0;
    this.aimTarget = { x: player.x, y: player.y };
    this.setStateTint(SILHOUETTE.telegraph);

    // 조준선을 먼저 보여준다. 선이 그어진 뒤에 탄이 나가야 피할 수 있다.
    const distance = Phaser.Math.Distance.Between(body.x, body.y, player.x, player.y);
    const line = this.scene.add.image(body.x, body.y, TEXTURE.telegraph);
    line.setOrigin(0, 0.5);
    line.setDisplaySize(distance, AIM_LINE_HEIGHT);
    line.setRotation(Phaser.Math.Angle.Between(body.x, body.y, player.x, player.y));
    line.setAlpha(AIM_ALPHA_FROM);
    this.aimLine = line;

    this.scene.tweens.add({
      targets: line,
      alpha: AIM_ALPHA_TO,
      duration: this.definition.telegraphMs,
    });
  }

  private fire(): void {
    const body = this.sprite;
    this.aiming = false;
    this.stateMs = 0;
    this.reloadMs = 0;
    this.clearAimLine();
    this.setStateTint(null);
    if (!body) return;

    const shot = this.arena.enemyAttacks.create(
      body.x,
      body.y,
      TEXTURE.enemyAttack,
    ) as Phaser.Physics.Arcade.Sprite;
    shot.setDisplaySize(PROJECTILE_SIZE, PROJECTILE_SIZE);
    shot.setData("damage", this.definition.contactDamage);
    shot.setData("consumeOnHit", true);

    // 조준 시점의 좌표로만 날아간다. 그 사이에 움직였다면 빗나간다.
    const angle = Phaser.Math.Angle.Between(body.x, body.y, this.aimTarget.x, this.aimTarget.y);
    shot.setVelocity(Math.cos(angle) * PROJECTILE_SPEED, Math.sin(angle) * PROJECTILE_SPEED);
    shot.setRotation(angle);

    // 씬의 타이머는 씬과 함께 정리되므로 방을 넘어가며 남지 않는다.
    this.scene.time.delayedCall(PROJECTILE_LIFE_MS, () => shot.destroy());
  }

  /** 그 방향으로 더 물러날 자리가 없는지. */
  private isAgainstWall(x: number, direction: number): boolean {
    return direction < 0 ? x <= CORNER_MARGIN : x >= this.arena.bounds.width - CORNER_MARGIN;
  }

  private clearAimLine(): void {
    if (!this.aimLine) return;
    this.scene.tweens.killTweensOf(this.aimLine);
    this.aimLine.destroy();
    this.aimLine = null;
  }
}
