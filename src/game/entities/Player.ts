/**
 * 플레이어.
 *
 * ─────────────────────────────────────────────
 * 이 파일은 전투 담당(팀원)의 영역이다. (DEC-007)
 * 시스템 담당이 심어둔 두 가지는 어떤 경우에도 지우지 않는다.
 *   1. `this.telemetry.record*()` 호출 — Director 분석의 유일한 입력이다.
 *   2. `emitHud()` 호출 — React HUD가 이걸로만 갱신된다.
 * ─────────────────────────────────────────────
 *
 * 수치는 `config/gameBalance.ts`, 키 매핑은 `config/inputConfig.ts`를 참조한다.
 * 아래 `TUNING`은 아직 gameBalance에 자리가 없는 값을 임시로 모아둔 것이다.
 * gameBalance.ts는 여러 담당이 같이 쓰는 파일이라, 확정 후 한 번에 옮긴다. (OQ-007)
 *
 * 스프라이트가 없어서 도형으로 만든다. (OQ-024)
 * 대신 tint 플래시·스케일 펀치·잔상만으로 "때렸다/맞았다"가 눈에 보이게 한다.
 */

import Phaser from "phaser";

import { eventBus } from "../EventBus";
import { PLAYER } from "../config/gameBalance";
import { KEY_BINDINGS, type GameAction } from "../config/inputConfig";
import type { CombatTelemetryRecorder } from "../systems/CombatTelemetry";
import {
  PLAYER_SPRITE,
  SILHOUETTE,
  TEXTURE,
  playerAnimKey,
  type CombatArena,
  type PlayerAnimState,
} from "../types/combat";
import type { AttackMode, UpgradeId } from "../types/game";

/** 도트 확대 배율. 48px 셀을 화면에서 이 배수로 키운다. */
const SPRITE_SCALE = 1.6;

/** 원거리 모드 표시색. 곱연산이라 흰색에 가까울수록 원본이 살아 있다. */
const RANGED_MODE_TINT = 0xffc9d4;

/** gameBalance로 옮겨야 할 임시 수치. 확정 전까지 여기서만 관리한다. */
const TUNING = {
  /** 도형 플레이스홀더의 몸 크기. 스프라이트가 들어오면 프레임 크기로 대체된다. */
  body: { width: 26, height: 44 },

  melee: {
    /** 적 hp 24~30 기준 3~4방. MVP_PLAN §12 밸런스 목표에 맞춘 시작값이다. */
    damage: 10,
    /** 3타째는 마무리 타격이라 조금 더 세다. */
    finisherDamageMultiplier: 1.4,
    hitboxLifeMs: 90,
    /** 이 시간 안에 다시 치면 콤보가 이어진다. */
    comboWindowMs: 520,
    reach: 34,
    finisherReach: 54,
    hitboxHeight: 34,
    /** MELEE_FINISHER_RANGE_UP이 마무리 타격에만 더해주는 사거리 */
    finisherRangeBonus: 20,
  },

  ranged: {
    damage: 8,
    speed: 620,
    width: 18,
    height: 8,
    lifeMs: 1600,
    /** RANGED_PIERCE가 없을 때 관통 0명 = 최대 1명 적중 */
    baseMaxHits: 1,
    pierceBonusHits: 1,
  },

  dash: {
    durationMs: 150,
    /** 충전 하나가 다시 차는 데 걸리는 시간 */
    rechargeMs: 900,
  },

  upgrade: {
    meleeDamageMultiplier: 1.2,
    rangedCooldownMultiplier: 0.8,
    dashFollowupMultiplier: 1.5,
    /** 대시 후 이 시간 안의 첫 공격만 보너스를 받는다. */
    dashFollowupWindowMs: 600,
    dashChargeBonus: 1,
  },

  /** 피격 시 뒤로 밀린다. 연타로 갇히지 않게 하는 안전장치이기도 하다. */
  knockback: { x: 220, y: -180 },

  feedback: {
    flashMs: 90,
    punchMs: 70,
    punchScale: 1.16,
    blinkMs: 90,
    /** 잔상 간격. 촘촘할수록 빠르게 지나간 것처럼 보인다. */
    afterimageIntervalMs: 12,
    afterimageFadeMs: 170,
    afterimageAlpha: 0.6,
    /** 잔상이 진행 반대로 밀리는 거리. 몸이 앞서 나간 느낌을 만든다. */
    afterimageDriftPx: 16,
    afterimageStretch: 1.35,
    deathMs: 320,
    hitShakeMs: 90,
    hitShakeIntensity: 0.004,
    damageShakeMs: 160,
    damageShakeIntensity: 0.01,
  },

  /** 플레이어가 항상 위에 보여야 한다. 도형이라 겹치면 구분이 안 된다. */
  depth: { player: 10, attack: 9, afterimage: 8 },
} as const;

const MOVE_ACTIONS = [
  "MOVE_LEFT",
  "MOVE_RIGHT",
  "JUMP",
  "DASH",
  "ATTACK",
  "SWITCH_MODE",
] as const satisfies readonly GameAction[];

type PlayerAction = (typeof MOVE_ACTIONS)[number];

export interface PlayerDeps {
  scene: Phaser.Scene;
  /** 지형과 공격체 그룹. 만든 히트박스·투사체는 `arena.playerAttacks`에 넣는다. */
  arena: CombatArena;
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

  sprite: Phaser.Physics.Arcade.Sprite | null = null;

  mode: AttackMode = "MELEE";
  hp: number = PLAYER.maxHp;
  isGrounded = true;
  isDashing = false;
  isDead = false;

  private keys: Partial<Record<PlayerAction, Phaser.Input.Keyboard.Key>> = {};
  private facing: 1 | -1 = 1;
  private baseScale = { x: 1, y: 1 };

  private nextAttackAtMs = 0;
  private comboStep = 0;
  private comboExpiresAtMs = 0;

  private dashCharges: number = PLAYER.dashCharges;
  private dashEndsAtMs = 0;
  private dashRechargeAtMs = 0;
  private dashFollowupUntilMs = 0;
  private lastAfterimageAtMs = 0;

  /** 공격 애니메이션이 끝나는 시각. 그 전에는 다른 상태가 끼어들지 못한다. */
  private attackAnimUntilMs = 0;
  private invulnerableUntilMs = 0;
  private blinkTween: Phaser.Tweens.Tween | null = null;

  /** 화면 밖 정리와 관통 판정을 위해 내가 쏜 투사체만 따로 들고 있는다. */
  private projectiles: Phaser.Physics.Arcade.Image[] = [];

  /** 씬이 넘겨준 마지막 HUD 값. 내부 갱신에서 0으로 덮어쓰지 않기 위한 것이다. */
  private lastEnemiesRemaining = 0;
  private lastRoomIndex = 0;

  constructor(deps: PlayerDeps) {
    this.deps = deps;
    this.scene = deps.scene;
    this.telemetry = deps.telemetry;
    this.dashCharges = this.maxDashCharges;
  }

  // ────────────────────────────── 수명 주기 ──────────────────────────────

  /** 방 시작 시 호출된다. */
  spawn(x: number, y: number): void {
    const { body, depth } = TUNING;

    const sprite = this.scene.physics.add.sprite(x, y, PLAYER_SPRITE.key);
    // 도트는 정수 배율로만 키운다. 소수 배율은 픽셀 격자를 무너뜨린다.
    sprite.setScale(SPRITE_SCALE);
    sprite.setDepth(depth.player);
    sprite.setCollideWorldBounds(true);
    // 그림에는 망토와 검이 넓게 퍼져 있다. 충돌 판정은 몸통만 잡아야 억울한 피격이 없다.
    sprite.body.setSize(body.width, body.height);
    sprite.body.setOffset(
      (PLAYER_SPRITE.frameWidth - body.width) / 2,
      PLAYER_SPRITE.frameHeight - body.height,
    );
    this.baseScale = { x: sprite.scaleX, y: sprite.scaleY };
    this.sprite = sprite;
    this.playAnim("idle");

    // 씬은 적 충돌만 걸어준다. 플레이어가 바닥을 밟는 건 플레이어 책임이다.
    this.scene.physics.add.collider(sprite, this.deps.arena.solids);

    this.bindKeys();
    this.applyModeTint();
    this.emitHud();
  }

  /** 씬의 update에서 매 프레임 호출된다. */
  update(time: number, _deltaMs: number): void {
    const sprite = this.sprite;
    if (!sprite?.body) return;
    const body = sprite.body as Phaser.Physics.Arcade.Body;

    this.isGrounded = body.blocked.down || body.touching.down;
    this.cullProjectiles(time);
    if (this.isDead) return;

    if (this.isDashing) {
      this.trailAfterimage(time);
      if (time >= this.dashEndsAtMs) this.endDash();
      return;
    }

    if (this.dashCharges < this.maxDashCharges && time >= this.dashRechargeAtMs) {
      this.dashCharges += 1;
      this.dashRechargeAtMs = time + TUNING.dash.rechargeMs;
    }

    const direction =
      (this.keys.MOVE_RIGHT?.isDown ? 1 : 0) - (this.keys.MOVE_LEFT?.isDown ? 1 : 0);
    body.setVelocityX(direction * PLAYER.moveSpeed);
    if (direction !== 0) {
      this.facing = direction > 0 ? 1 : -1;
      sprite.setFlipX(this.facing < 0);
    }

    if (this.justPressed("JUMP") && this.isGrounded) this.jump();
    if (this.justPressed("DASH")) this.dash();
    if (this.justPressed("ATTACK")) this.attack();
    if (this.justPressed("SWITCH_MODE")) this.switchMode();

    this.syncAnim();
  }

  destroy(): void {
    this.blinkTween?.remove();
    this.blinkTween = null;
    for (const projectile of this.projectiles) projectile.destroy();
    this.projectiles = [];
    this.sprite?.destroy();
    this.sprite = null;
    this.keys = {};
  }

  // ────────────────────────────── 이동 ──────────────────────────────

  private jump(): void {
    const body = this.sprite?.body as Phaser.Physics.Arcade.Body | undefined;
    if (!body) return;
    body.setVelocityY(-PLAYER.jumpVelocity);
    // 뛰는 순간 세로로 늘어나면 도형이라도 도약이 읽힌다.
    this.punch(0.86, 1.18);
  }

  dash(): void {
    const sprite = this.sprite;
    const body = sprite?.body as Phaser.Physics.Arcade.Body | undefined;
    if (!sprite || !body || this.isDashing || this.dashCharges <= 0) return;

    const now = this.scene.time.now;
    this.dashCharges -= 1;
    // 충전이 가득 찼다가 처음 빠진 순간부터 재충전 타이머를 돌린다.
    if (this.dashRechargeAtMs <= now) this.dashRechargeAtMs = now + TUNING.dash.rechargeMs;

    this.telemetry.recordDash();

    this.isDashing = true;
    this.dashEndsAtMs = now + TUNING.dash.durationMs;
    this.dashFollowupUntilMs = now + TUNING.upgrade.dashFollowupWindowMs;
    this.invulnerableUntilMs = Math.max(
      this.invulnerableUntilMs,
      now + PLAYER.dashInvulnerabilityMs,
    );

    // 거리와 시간으로 속도를 역산한다. dashDistance가 바뀌어도 체감 거리가 유지된다.
    const speed = PLAYER.dashDistance / (TUNING.dash.durationMs / 1000);
    body.setVelocity(this.facing * speed, 0);
    // 대시 중에는 중력을 끊는다. 공중 대시가 아래로 처지면 회피기로 못 쓴다.
    body.setAllowGravity(false);
    this.lastAfterimageAtMs = 0;
    this.trailAfterimage(now);
  }

  private endDash(): void {
    this.isDashing = false;
    const body = this.sprite?.body as Phaser.Physics.Arcade.Body | undefined;
    body?.setAllowGravity(true);
  }

  // ────────────────────────────── 공격 ──────────────────────────────

  /** 모드에 맞는 공격으로 넘긴다. 쿨타임 판정은 각 공격 안에 있다. */
  private attack(): void {
    // 공격 그림이 끝까지 나오도록 이동·점프 상태가 끼어들지 못하게 잠근다.
    const spec = PLAYER_SPRITE.states.attack;
    this.attackAnimUntilMs = this.scene.time.now + (spec.frames / spec.fps) * 1000;
    this.playAnim("attack", true);

    if (this.mode === "MELEE") this.attackMelee();
    else this.attackRanged();
  }

  /** 근거리 공격 입력. 3연속 베기. */
  attackMelee(): void {
    const sprite = this.sprite;
    const now = this.scene.time.now;
    if (!sprite || this.isDead || now < this.nextAttackAtMs) return;

    // 콤보 창이 끊기면 1타부터 다시 시작한다.
    this.comboStep = now > this.comboExpiresAtMs ? 1 : (this.comboStep % 3) + 1;
    this.comboExpiresAtMs = now + TUNING.melee.comboWindowMs;
    this.nextAttackAtMs = now + PLAYER.meleeCooldownMs;

    this.telemetry.recordMeleeAttack();
    if (!this.isGrounded) this.telemetry.recordAirAttack();

    const isFinisher = this.comboStep === 3;
    const { melee } = TUNING;
    const reach =
      (isFinisher ? melee.finisherReach : melee.reach) +
      (isFinisher && this.hasUpgrade("MELEE_FINISHER_RANGE_UP") ? melee.finisherRangeBonus : 0);

    let damage: number = melee.damage;
    if (this.hasUpgrade("MELEE_DAMAGE_UP")) damage *= TUNING.upgrade.meleeDamageMultiplier;
    if (isFinisher) damage *= melee.finisherDamageMultiplier;
    damage = this.applyDashFollowup(damage);

    const hitbox = this.scene.physics.add.image(
      sprite.x + this.facing * (TUNING.body.width / 2 + reach / 2),
      sprite.y,
      TEXTURE.playerAttack,
    );
    hitbox.setDisplaySize(reach, melee.hitboxHeight);
    hitbox.setDepth(TUNING.depth.attack);
    hitbox.setAlpha(isFinisher ? 0.9 : 0.6);
    this.deps.arena.playerAttacks.add(hitbox);
    (hitbox.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

    hitbox.setData("damage", Math.round(damage));
    hitbox.setData("mode", "MELEE" satisfies AttackMode);
    // consumeOnHit을 걸지 않는다. 한 번 휘두르면 범위 안의 적을 모두 벤다.

    // 베는 궤적처럼 보이도록 짧게 늘어나며 사라진다.
    this.scene.tweens.add({
      targets: hitbox,
      scaleX: hitbox.scaleX * 1.25,
      alpha: 0,
      duration: melee.hitboxLifeMs,
      onComplete: () => hitbox.destroy(),
    });

    this.punch(TUNING.feedback.punchScale, 1 / TUNING.feedback.punchScale);
  }

  /** 원거리 공격 입력. 짧은 쿨타임의 투사체. */
  attackRanged(): void {
    const sprite = this.sprite;
    const now = this.scene.time.now;
    if (!sprite || this.isDead || now < this.nextAttackAtMs) return;

    const cooldown =
      PLAYER.rangedCooldownMs *
      (this.hasUpgrade("RANGED_COOLDOWN_DOWN") ? TUNING.upgrade.rangedCooldownMultiplier : 1);
    this.nextAttackAtMs = now + cooldown;
    this.comboStep = 0;

    this.telemetry.recordRangedAttack();
    if (!this.isGrounded) this.telemetry.recordAirAttack();

    const { ranged } = TUNING;
    const maxHits =
      ranged.baseMaxHits + (this.hasUpgrade("RANGED_PIERCE") ? ranged.pierceBonusHits : 0);

    const projectile = this.scene.physics.add.image(
      sprite.x + this.facing * TUNING.body.width,
      sprite.y,
      TEXTURE.playerAttack,
    );
    projectile.setDisplaySize(ranged.width, ranged.height);
    projectile.setDepth(TUNING.depth.attack);
    this.deps.arena.playerAttacks.add(projectile);

    const body = projectile.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocityX(this.facing * ranged.speed);

    projectile.setData("damage", Math.round(this.applyDashFollowup(ranged.damage)));
    projectile.setData("mode", "RANGED" satisfies AttackMode);
    // 관통이 없으면 씬이 첫 적중에서 없애준다. 관통이 있으면 여기서 횟수를 센다.
    projectile.setData("consumeOnHit", maxHits <= 1);
    projectile.setData("maxHits", maxHits);
    projectile.setData("expiresAtMs", now + ranged.lifeMs);
    this.projectiles.push(projectile);

    this.punch(1 / TUNING.feedback.punchScale, TUNING.feedback.punchScale);
  }

  /**
   * 공격이 적에게 실제로 맞았을 때 호출한다.
   * 분류는 시도가 아니라 적중 기준이므로(MVP_PLAN §4) 이 호출을 빠뜨리면 분석이 무너진다.
   */
  notifyHit(mode: AttackMode): void {
    if (mode === "MELEE") this.telemetry.recordMeleeHit();
    else this.telemetry.recordRangedHit();

    // 도형만으로는 맞았는지 알기 어렵다. 아주 짧은 흔들림으로 타격을 알린다.
    this.scene.cameras.main.shake(
      TUNING.feedback.hitShakeMs,
      TUNING.feedback.hitShakeIntensity,
    );
  }

  /** 근거리 ↔ 원거리 모드 전환. 즉시 전환한다. (PLAYER.modeSwitchMs) */
  switchMode(): void {
    this.mode = this.mode === "MELEE" ? "RANGED" : "MELEE";
    this.comboStep = 0;
    this.applyModeTint();
    this.punch(1.2, 1.2);
    this.emitHud();
  }

  // ────────────────────────────── 피격과 사망 ──────────────────────────────

  takeDamage(amount: number = PLAYER.damagePerHit): void {
    if (this.isDashing) return;

    const now = this.scene.time.now;
    // 적 본체와 겹쳐 있는 동안 매 프레임 호출된다. 무적 시간이 없으면 즉사한다.
    if (this.isDead || now < this.invulnerableUntilMs) return;
    this.invulnerableUntilMs = now + PLAYER.invulnerabilityMs;

    this.telemetry.recordDamageTaken();
    this.hp = Math.max(0, this.hp - amount);
    this.deps.onDamaged(amount);
    this.emitHud();

    this.flash();
    this.scene.cameras.main.shake(
      TUNING.feedback.damageShakeMs,
      TUNING.feedback.damageShakeIntensity,
    );

    const body = this.sprite?.body as Phaser.Physics.Arcade.Body | undefined;
    // 넉백 방향은 바라보는 쪽의 반대다. 피해원 좌표는 여기까지 오지 않는다.
    body?.setVelocity(-this.facing * TUNING.knockback.x, TUNING.knockback.y);

    if (this.hp <= 0) {
      this.die();
      return;
    }
    this.blink();
  }

  private die(): void {
    if (this.isDead) return;
    this.isDead = true;

    const sprite = this.sprite;
    if (sprite) {
      this.blinkTween?.remove();
      this.blinkTween = null;
      (sprite.body as Phaser.Physics.Arcade.Body | null)?.setEnable(false);
      sprite.setTintFill(SILHOUETTE.enemyAttack);
      // 파티클 대신 빠른 축소와 페이드로 소멸을 표현한다. (에셋 없음)
      this.scene.tweens.add({
        targets: sprite,
        scaleX: 0,
        scaleY: 0,
        alpha: 0,
        angle: 180,
        duration: TUNING.feedback.deathMs,
        ease: "Cubic.easeIn",
      });
    }

    this.deps.onDeath();
  }

  // ────────────────────────────── 연출 ──────────────────────────────

  /** 맞은 순간 흰색으로 덮는다. tint가 아니라 tintFill이어야 도형에서도 보인다. */
  private flash(): void {
    const sprite = this.sprite;
    if (!sprite) return;
    sprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(TUNING.feedback.flashMs, () => {
      if (sprite.active) this.applyModeTint();
    });
  }

  private blink(): void {
    const sprite = this.sprite;
    if (!sprite) return;

    this.blinkTween?.remove();
    const halfCycles = Math.max(1, Math.round(PLAYER.invulnerabilityMs / TUNING.feedback.blinkMs));
    this.blinkTween = this.scene.tweens.add({
      targets: sprite,
      alpha: 0.25,
      duration: TUNING.feedback.blinkMs,
      yoyo: true,
      repeat: Math.floor(halfCycles / 2) - 1,
      onComplete: () => {
        sprite.setAlpha(1);
        this.blinkTween = null;
      },
    });
  }

  /** 공격·점프·전환에 각각 다른 방향의 스케일 펀치를 준다. */
  private punch(scaleX: number, scaleY: number): void {
    const sprite = this.sprite;
    if (!sprite) return;
    this.scene.tweens.add({
      targets: sprite,
      scaleX: this.baseScale.x * scaleX,
      scaleY: this.baseScale.y * scaleY,
      duration: TUNING.feedback.punchMs,
      yoyo: true,
      // 겹쳐 들어와도 원래 크기로 확실히 돌아오게 한다.
      onComplete: () => sprite.setScale(this.baseScale.x, this.baseScale.y),
    });
  }

  /** 대시 잔상. 지나간 자리를 남겨야 순간이동이 아니라 이동으로 읽힌다. */
  private trailAfterimage(nowMs: number): void {
    const sprite = this.sprite;
    if (!sprite || nowMs - this.lastAfterimageAtMs < TUNING.feedback.afterimageIntervalMs) return;
    this.lastAfterimageAtMs = nowMs;

    const ghost = this.scene.add.image(sprite.x, sprite.y, PLAYER_SPRITE.key, sprite.frame.name);
    ghost.setScale(sprite.scaleX, sprite.scaleY);
    ghost.setFlipX(sprite.flipX);
    ghost.setDepth(TUNING.depth.afterimage);
    // 형태가 아니라 지나간 궤적으로 읽혀야 한다. 실루엣만 붉게 남긴다.
    ghost.setTintFill(SILHOUETTE.chaser);
    ghost.setAlpha(TUNING.feedback.afterimageAlpha);
    // 잔상끼리 겹치는 자리가 밝아져 궤적이 선처럼 이어진다.
    ghost.setBlendMode(Phaser.BlendModes.ADD);

    const { feedback } = TUNING;
    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      // 진행 반대로 밀리며 늘어난다. 제자리에서 사라지면 속도가 안 붙는다.
      x: ghost.x - this.facing * feedback.afterimageDriftPx,
      scaleX: ghost.scaleX * feedback.afterimageStretch,
      duration: feedback.afterimageFadeMs,
      ease: "power2.out",
      onComplete: () => ghost.destroy(),
    });
  }

  /**
   * 애니메이션 전환.
   *
   * 같은 상태를 다시 요청하면 무시한다. 매 프레임 play를 부르면 1프레임에서 멈춘 것처럼 보인다.
   * 공격은 한 번 시작하면 끝날 때까지 다른 상태가 끊지 못한다. 휘두르다 만 그림이 나오면 안 된다.
   */
  private playAnim(state: PlayerAnimState, force = false): void {
    const sprite = this.sprite;
    if (!sprite) return;

    const key = playerAnimKey(state);
    if (!force && sprite.anims.currentAnim?.key === key) return;
    if (!force && this.attackAnimUntilMs > this.scene.time.now) return;

    sprite.play(key, true);
  }

  /** 지금 몸 상태에 맞는 애니메이션을 고른다. 공격 중이면 건드리지 않는다. */
  private syncAnim(): void {
    if (this.isDead || this.attackAnimUntilMs > this.scene.time.now) return;

    const body = this.sprite?.body as Phaser.Physics.Arcade.Body | undefined;
    if (!body) return;

    if (!this.isGrounded) this.playAnim("jump");
    else if (Math.abs(body.velocity.x) > 1) this.playAnim("run");
    else this.playAnim("idle");
  }

  /** 모드가 색으로 구분돼야 HUD를 보지 않고도 지금 무엇을 쏘는지 안다. */
  private applyModeTint(): void {
    if (this.isDead) return;
    const sprite = this.sprite;
    if (!sprite) return;
    // 스프라이트를 통째로 칠하면 도트가 죽는다. 원거리일 때만 아주 옅게 물들인다.
    if (this.mode === "MELEE") sprite.clearTint();
    else sprite.setTint(RANGED_MODE_TINT);
  }

  // ────────────────────────────── 내부 유틸 ──────────────────────────────

  private bindKeys(): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) return;
    this.keys = {};
    for (const action of MOVE_ACTIONS) {
      // 키 코드를 하드코딩하지 않는다. 사용자가 바꾼 바인딩이 그대로 반영돼야 한다.
      this.keys[action] = keyboard.addKey(KEY_BINDINGS[action], true, false);
    }
  }

  private justPressed(action: PlayerAction): boolean {
    const key = this.keys[action];
    return key ? Phaser.Input.Keyboard.JustDown(key) : false;
  }

  private hasUpgrade(id: UpgradeId): boolean {
    return this.deps.upgrades.includes(id);
  }

  private get maxDashCharges(): number {
    return (
      PLAYER.dashCharges +
      (this.hasUpgrade("DASH_CHARGE_UP") ? TUNING.upgrade.dashChargeBonus : 0)
    );
  }

  /** 대시 직후 첫 공격에만 붙는 보너스. 한 번 쓰면 창을 닫는다. */
  private applyDashFollowup(damage: number): number {
    if (!this.hasUpgrade("DASH_FOLLOWUP_DAMAGE_UP")) return damage;
    if (this.scene.time.now > this.dashFollowupUntilMs) return damage;
    this.dashFollowupUntilMs = 0;
    return damage * TUNING.upgrade.dashFollowupMultiplier;
  }

  /** 화면을 벗어났거나 관통 한도를 넘긴 투사체를 없앤다. 방치하면 계속 쌓인다. */
  private cullProjectiles(nowMs: number): void {
    if (this.projectiles.length === 0) return;
    const { width } = this.deps.arena.bounds;

    this.projectiles = this.projectiles.filter((projectile) => {
      if (!projectile.active) return false;

      // 씬이 적중한 적을 이 Set에 모아둔다. 관통 수를 세는 유일한 근거다.
      const hitCount = (projectile.getData("hitEnemies") as Set<unknown> | undefined)?.size ?? 0;
      const expired =
        hitCount >= (projectile.getData("maxHits") as number) ||
        nowMs > (projectile.getData("expiresAtMs") as number) ||
        projectile.x < 0 ||
        projectile.x > width;

      if (expired) {
        projectile.destroy();
        return false;
      }
      return true;
    });
  }

  /** HUD 갱신. 전투 담당은 상태가 바뀌는 지점에서 이걸 호출하기만 하면 된다. */
  emitHud(enemiesRemaining?: number, roomIndex?: number): void {
    // 씬이 준 값은 기억해 둔다. 체력만 바뀌었다고 방 번호가 0으로 돌아가면 안 된다.
    if (enemiesRemaining !== undefined) this.lastEnemiesRemaining = enemiesRemaining;
    if (roomIndex !== undefined) this.lastRoomIndex = roomIndex;

    eventBus.emit("hud:update", {
      hud: {
        hp: this.hp,
        maxHp: PLAYER.maxHp,
        mode: this.mode,
        roomIndex: this.lastRoomIndex,
        enemiesRemaining: this.lastEnemiesRemaining,
      },
    });
  }
}
