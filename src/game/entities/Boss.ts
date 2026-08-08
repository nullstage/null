/**
 * 보스. (MVP_PLAN §8)
 *
 * 패턴은 slash·dash·projectile·slam 네 개뿐이고, 넷 다 예고를 먼저 띄운다.
 * 예고 없이 피해가 나가면 소프트 카운터가 아니라 그냥 즉사가 되기 때문이다. (DEC-004)
 *
 * 성향(`deps.weights`)은 "어떤 패턴을 고를 확률"만 바꾼다.
 * 체력·피해량·패턴 속도·쿨타임은 성향과 무관하게 고정이다. (MVP_PLAN §8)
 * 보스전 시작 전에 확정된 가중치를 그대로 쓰고, 전투 중 재분석하지 않는다.
 *
 * 씬과의 접점은 `CombatArena` 하나뿐이다.
 * 본체는 `arena.enemyBodies`, 공격체는 `arena.enemyAttacks`에만 넣고,
 * 누가 누구를 때렸는지는 씬이 한 곳에서 판정한다. (types/combat.ts)
 */

import type Phaser from "phaser";

import { BOSS, PLAYER } from "../config/gameBalance";
import { deathBurst } from "../systems/CombatVfx";
import { pickBossPattern } from "../systems/DirectorPolicy";
import { BOSS_FRAME, SILHOUETTE, TEXTURE, type CombatArena } from "../types/combat";
import type { BossPattern, BossPatternWeights } from "../types/game";

/**
 * 보스 전용 임시 수치. (OQ-007 미결정)
 *
 * `gameBalance.ts`의 `BOSS`에는 체력·쿨타임·연속 제한만 있다.
 * 나머지를 공용 파일에 지금 넣으면 병렬 작업 중 충돌하므로, 여기 이름을 붙여 두고
 * 통합 시점에 `gameBalance.ts`로 옮긴다. (최종 보고 4번 항목)
 */
const BODY = {
  width: 72,
  height: 108,
  /** 패턴 사이에 플레이어 쪽으로 걸어오는 속도. 압박용이지 추격용이 아니다. */
  moveSpeed: 130,
  /** 이 거리 안에서는 멈춘다. 계속 밀고 들어오면 회피 공간이 사라진다. */
  keepDistanceX: 160,
} as const;

const SLASH = {
  telegraphMs: 500,
  reach: 130,
  height: 96,
  activeMs: 180,
  recoveryMs: 260,
} as const;

const DASH = {
  telegraphMs: 550,
  speed: 720,
  durationMs: 480,
  hitWidth: 88,
  recoveryMs: 400,
  /** 잔상 생성 간격. 짧을수록 속도감이 살지만 오브젝트가 늘어난다. */
  afterimageIntervalMs: 55,
  afterimageFadeMs: 260,
} as const;

const PROJECTILE = {
  telegraphMs: 600,
  count: 3,
  intervalMs: 180,
  speed: 430,
  size: 24,
  /** 화면을 벗어난 투사체를 확실히 회수하기 위한 수명. */
  lifeMs: 3_000,
  recoveryMs: 320,
} as const;

const SLAM = {
  riseMs: 320,
  jumpHeight: 260,
  /** 착지 지점을 보여주는 시간. 이 값이 짧으면 회피가 불가능해진다. */
  telegraphMs: 650,
  fallMs: 200,
  shockwaveWidth: 340,
  shockwaveHeight: 76,
  activeMs: 260,
  recoveryMs: 420,
  shakeMs: 140,
  shakeIntensity: 0.008,
} as const;

/** 피격·사망 연출. 스프라이트가 없어 도형만으로 타격감을 만들어야 한다. (OQ-024) */
const FEEDBACK = {
  flashMs: 70,
  punchScale: 1.14,
  punchMs: 90,
  deathMs: 420,
} as const;

const TELEGRAPH = { alphaMin: 0.22, alphaMax: 0.6, pulseMs: 160 } as const;

/** 보스 체력 바. 방 폭에 대한 비율로 둬서 해상도가 바뀌어도 잘리지 않는다. */
const HP_BAR = { widthRatio: 0.52, height: 14, topMargin: 26 } as const;

const DEPTH = { telegraph: 1, attack: 5, boss: 10, hud: 100 } as const;

/**
 * 보스 그림 배율. 224px 셀 안의 실제 그림이 대략 200px이라, 화면에서 약 190px 높이가 된다 —
 * 플레이어(약 62px)의 세 배쯤이라 "보스"로 읽힌다. 충돌 박스는 BODY 값(72×108)을 그대로 쓴다.
 */
const BOSS_SPRITE_SCALE = 0.85;

/**
 * 모든 보스 패턴의 피해량.
 * 보스 전용 피해량이 아직 미정이라(OQ-007) 플레이어 기본 피격량을 그대로 쓴다.
 * 값을 나누고 싶어지면 `BOSS.patternDamage`로 옮긴다.
 */
const PATTERN_DAMAGE = PLAYER.damagePerHit;

export interface BossDeps {
  scene: Phaser.Scene;
  /** 지형과 공격체 그룹. 본체와 공격체를 여기 넣어야 씬이 피해를 전달한다. */
  arena: CombatArena;
  /** 보스전 시작 전에 확정된 가중치. 전투 중 바뀌지 않는다. */
  weights: BossPatternWeights;
  /** 플레이어의 현재 위치. 조준·착지 지점 계산에 쓴다. 플레이어를 직접 참조하지 않는다. */
  getPlayerPosition: () => { x: number; y: number };
  onPatternSelected: (pattern: BossPattern) => void;
  onDefeated: () => void;
}

export class Boss {
  private readonly deps: BossDeps;
  private readonly scene: Phaser.Scene;
  private readonly arena: CombatArena;

  sprite: Phaser.Physics.Arcade.Sprite | null = null;

  hp: number = BOSS.hp;
  readonly maxHp: number = BOSS.hp;

  /**
   * 씬의 접촉 피해 배선이 `BaseEnemy`와 같은 모양(`definition.contactDamage`)을 읽는다.
   * 보스만 다른 배선을 요구하면 통합할 때 깨지므로 형태를 맞춰 둔다.
   */
  readonly definition = { contactDamage: PATTERN_DAMAGE } as const;

  private lastPattern: BossPattern | null = null;
  private sameStreak = 0;
  private nextPatternAtMs = 0;
  private busy = false;
  private defeated = false;
  private defeatNotified = false;

  private facing: 1 | -1 = -1;
  /** slam 중에는 y를 tween이 관리한다. 바닥 스냅이 궤적을 덮어쓰지 않게 하는 플래그다. */
  private airborne = false;
  /** 돌진 히트박스는 본체를 따라다녀야 "지나간 자리"만 맞는다. */
  private followHitbox: Phaser.Physics.Arcade.Image | null = null;

  private timers: Phaser.Time.TimerEvent[] = [];
  private tweens: Phaser.Tweens.Tween[] = [];
  /** 예고·투사체·잔상처럼 수명이 짧은 오브젝트. 씬이 내려갈 때 한 번에 정리한다. */
  private ephemera: Phaser.GameObjects.GameObject[] = [];

  private hpBarBack: Phaser.GameObjects.Image | null = null;
  private hpBarFill: Phaser.GameObjects.Image | null = null;

  constructor(deps: BossDeps) {
    this.deps = deps;
    this.scene = deps.scene;
    this.arena = deps.arena;
  }

  // ────────────────────────────── 생성과 루프 ──────────────────────────────

  /** 전달받은 x만 쓰고 y는 바닥에 맞춘다. 보스는 중력을 직접 다루기 때문이다. */
  spawn(x: number, _y: number): void {
    // 224px 셀 안에서 실제 그림은 여백을 두고 그려져 있다. setDisplaySize로 셀을 통째로
    // 눌러 맞추면 보스가 작아 보이므로, 그림은 스케일로 키우고 충돌 박스만 따로 잡는다.
    const sprite = this.scene.physics.add
      .sprite(x, this.groundY, TEXTURE.boss, BOSS_FRAME.idle)
      .setScale(BOSS_SPRITE_SCALE)
      .setDepth(DEPTH.boss);
    sprite.body?.setSize(BODY.width / BOSS_SPRITE_SCALE, BODY.height / BOSS_SPRITE_SCALE);

    // 씬이 보스방에 바닥 collider를 걸어주지 않고, slam 궤적도 직접 제어해야 한다.
    // 중력을 끄고 바닥 높이를 매 프레임 스냅하는 편이 예측 가능하다.
    (sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

    this.arena.enemyBodies.add(sprite);
    sprite.setData("enemy", this);
    this.sprite = sprite;

    this.createHpBar();

    // 등장 연출. 첫 패턴 전에 플레이어가 보스를 인지할 시간을 준다.
    sprite.setAlpha(0);
    this.tweens.push(
      this.scene.tweens.add({ targets: sprite, alpha: 1, duration: FEEDBACK.deathMs }),
    );

    this.nextPatternAtMs = this.scene.time.now + BOSS.patternCooldownMs;
  }

  update(time: number, _deltaMs: number): void {
    const sprite = this.sprite;
    if (this.defeated || !sprite) return;

    if (this.followHitbox) this.followHitbox.setPosition(sprite.x, sprite.y);
    this.clampToArena(sprite);

    if (this.busy) return;

    this.facePlayer(sprite);
    this.stepIdleMove(sprite);

    if (time < this.nextPatternAtMs) return;
    this.runPattern(this.selectPattern());
  }

  /**
   * 포즈 교체. 보스는 애니메이션 없이 패턴별 정지 포즈만 골라 쓴다.
   * 예고 포즈를 먼저 보여주고 타격 순간에 바꿔야 "무엇을 하려는지"가 읽힌다. (DEC-004)
   */
  private setPose(frame: number): void {
    this.sprite?.setFrame(frame);
  }

  /** 타격 포즈를 잠깐 보여준 뒤 idle로 돌아온다. */
  private strikePose(frame: number, holdMs: number): void {
    this.setPose(frame);
    this.after(holdMs, () => this.setPose(BOSS_FRAME.idle));
  }

  private get groundY(): number {
    return this.arena.bounds.floorY - BODY.height / 2;
  }

  private clampToArena(sprite: Phaser.Physics.Arcade.Sprite): void {
    const half = BODY.width / 2;
    sprite.x = Math.min(Math.max(sprite.x, half), this.arena.bounds.width - half);
    if (!this.airborne) sprite.y = this.groundY;
  }

  private facePlayer(sprite: Phaser.Physics.Arcade.Sprite): void {
    this.facing = this.deps.getPlayerPosition().x >= sprite.x ? 1 : -1;
    sprite.setFlipX(this.facing < 0);
  }

  private stepIdleMove(sprite: Phaser.Physics.Arcade.Sprite): void {
    const dx = this.deps.getPlayerPosition().x - sprite.x;
    const closing = Math.abs(dx) > BODY.keepDistanceX;
    sprite.setVelocityX(closing ? Math.sign(dx) * BODY.moveSpeed : 0);
  }

  // ────────────────────────────── 패턴 선택 ──────────────────────────────

  /**
   * 가중치 기반 패턴 선택. 동일 패턴 3연속을 막는다.
   * 순수 로직이므로 여기를 고치지 말고, 실행부만 손댄다.
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
    this.sprite?.setVelocity(0, 0);

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

  /** 패턴 실행이 끝나면 반드시 이걸 호출한다. 안 하면 보스가 멈춘다. */
  finishPattern(): void {
    this.busy = false;
    this.airborne = false;
    this.followHitbox = null;
    this.nextPatternAtMs = this.scene.time.now + BOSS.patternCooldownMs;
  }

  // ────────────────────────────── 패턴 실행 ──────────────────────────────

  /** 근거리 베기. 예고 사각형이 뜬 자리에 그대로 히트박스가 생긴다. */
  private executeSlash(): void {
    const sprite = this.sprite;
    if (!sprite) {
      this.finishPattern();
      return;
    }

    const x = sprite.x + this.facing * (BODY.width / 2 + SLASH.reach / 2);
    const y = sprite.y;
    this.showTelegraph(x, y, SLASH.reach, SLASH.height, SLASH.telegraphMs);
    this.setPose(BOSS_FRAME.slashTelegraph);

    this.after(SLASH.telegraphMs, () => {
      this.punch(sprite);
      this.strikePose(BOSS_FRAME.slashStrike, SLASH.activeMs + SLASH.recoveryMs);
      this.spawnHitbox(x, y, SLASH.reach, SLASH.height, SLASH.activeMs);
      this.after(SLASH.activeMs + SLASH.recoveryMs, () => this.finishPattern());
    });
  }

  /** 돌진. 지나갈 경로 전체를 미리 보여줘야 옆으로 빠져 피할 수 있다. */
  private executeDash(): void {
    const sprite = this.sprite;
    if (!sprite) {
      this.finishPattern();
      return;
    }

    const dir = this.facing;
    const reach = (DASH.speed * DASH.durationMs) / 1000;
    this.showTelegraph(
      sprite.x + (dir * reach) / 2,
      sprite.y,
      reach,
      BODY.height,
      DASH.telegraphMs,
    );
    this.setPose(BOSS_FRAME.dashTelegraph);

    this.after(DASH.telegraphMs, () => {
      this.strikePose(BOSS_FRAME.dashStrike, DASH.durationMs + DASH.recoveryMs);
      sprite.setVelocityX(dir * DASH.speed);
      this.followHitbox = this.spawnHitbox(
        sprite.x,
        sprite.y,
        DASH.hitWidth,
        BODY.height,
        DASH.durationMs,
      );

      const trail = this.scene.time.addEvent({
        delay: DASH.afterimageIntervalMs,
        loop: true,
        callback: () => this.spawnAfterimage(sprite),
      });
      this.timers.push(trail);

      this.after(DASH.durationMs, () => {
        trail.remove();
        sprite.setVelocityX(0);
        this.followHitbox = null;
        this.after(DASH.recoveryMs, () => this.finishPattern());
      });
    });
  }

  /** 원거리 투사체. 발사 순간의 플레이어 위치를 향해 쏘므로 움직이면 빗나간다. */
  private executeProjectile(): void {
    const sprite = this.sprite;
    if (!sprite) {
      this.finishPattern();
      return;
    }

    const muzzleX = sprite.x + this.facing * (BODY.width / 2 + PROJECTILE.size);
    this.showTelegraph(
      muzzleX,
      sprite.y,
      PROJECTILE.size * 2,
      PROJECTILE.size * 2,
      PROJECTILE.telegraphMs,
    );
    this.setPose(BOSS_FRAME.projectileTelegraph);

    this.after(PROJECTILE.telegraphMs, () => {
      const volleyMs = (PROJECTILE.count - 1) * PROJECTILE.intervalMs;
      this.strikePose(BOSS_FRAME.projectileStrike, volleyMs + PROJECTILE.recoveryMs);
      for (let i = 0; i < PROJECTILE.count; i += 1) {
        this.after(i * PROJECTILE.intervalMs, () => this.fireProjectile(muzzleX, sprite.y));
      }
      this.after(volleyMs + PROJECTILE.recoveryMs, () => this.finishPattern());
    });
  }

  private fireProjectile(x: number, y: number): void {
    const target = this.deps.getPlayerPosition();
    const dx = target.x - x;
    const dy = target.y - y;
    const length = Math.hypot(dx, dy) || 1;

    const shot = this.spawnHitbox(
      x,
      y,
      PROJECTILE.size,
      PROJECTILE.size,
      PROJECTILE.lifeMs,
      true,
    );
    shot.setVelocity(
      (dx / length) * PROJECTILE.speed,
      (dy / length) * PROJECTILE.speed,
    );
  }

  /** 점프 내려찍기. 착지 지점을 띄운 뒤 떨어진다. 지연 장판은 만들지 않는다. (MVP_PLAN §8) */
  private executeSlam(): void {
    const sprite = this.sprite;
    if (!sprite) {
      this.finishPattern();
      return;
    }

    const half = BODY.width / 2;
    const targetX = Math.min(
      Math.max(this.deps.getPlayerPosition().x, half),
      this.arena.bounds.width - half,
    );
    const impactY = this.arena.bounds.floorY - SLAM.shockwaveHeight / 2;

    this.airborne = true;
    this.tweens.push(
      this.scene.tweens.add({
        targets: sprite,
        x: targetX,
        y: this.groundY - SLAM.jumpHeight,
        duration: SLAM.riseMs,
        ease: "Quad.easeOut",
        onComplete: () => {
          this.showTelegraph(
            targetX,
            impactY,
            SLAM.shockwaveWidth,
            SLAM.shockwaveHeight,
            SLAM.telegraphMs,
          );
          this.setPose(BOSS_FRAME.slamTelegraph);
          this.after(SLAM.telegraphMs, () => this.dropSlam(sprite, targetX, impactY));
        },
      }),
    );
  }

  private dropSlam(
    sprite: Phaser.Physics.Arcade.Sprite,
    targetX: number,
    impactY: number,
  ): void {
    this.tweens.push(
      this.scene.tweens.add({
        targets: sprite,
        y: this.groundY,
        duration: SLAM.fallMs,
        ease: "Quad.easeIn",
        onComplete: () => {
          this.airborne = false;
          this.punch(sprite);
          this.strikePose(BOSS_FRAME.slamStrike, SLAM.activeMs + SLAM.recoveryMs);
          this.scene.cameras.main.shake(SLAM.shakeMs, SLAM.shakeIntensity);
          this.spawnHitbox(
            targetX,
            impactY,
            SLAM.shockwaveWidth,
            SLAM.shockwaveHeight,
            SLAM.activeMs,
          );
          this.after(SLAM.activeMs + SLAM.recoveryMs, () => this.finishPattern());
        },
      }),
    );
  }

  // ────────────────────────────── 피해와 사망 ──────────────────────────────

  takeDamage(amount: number): void {
    if (this.defeated) return;

    this.hp = Math.max(0, this.hp - amount);
    this.refreshHpBar();
    this.flash();
    // 패턴 중이면 그 포즈를 지키게 둔다 — 예고 자세가 피격으로 지워지면 뭘 준비했는지 놓친다.
    if (!this.busy) this.strikePose(BOSS_FRAME.hit, 160);

    if (this.hp <= 0) this.die();
  }

  private die(): void {
    this.defeated = true;
    this.clearScheduled();

    const sprite = this.sprite;
    if (!sprite) {
      this.notifyDefeat();
      return;
    }

    sprite.setVelocity(0, 0);
    sprite.clearTint();
    // 런의 마지막 타격이다. 일반 적보다 크게 터져야 끝났다는 게 전해진다.
    deathBurst(this.scene, sprite.x, sprite.y, SILHOUETTE.boss);
    // 파티클 대신 빠른 축소와 페이드로 처리한다. 에셋을 추가하지 않기 위해서다. (OQ-024)
    this.scene.tweens.add({
      targets: sprite,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: FEEDBACK.deathMs,
      ease: "Quad.easeIn",
      onComplete: () => {
        this.destroy();
        this.notifyDefeat();
      },
    });
  }

  /** 사망 통보는 런을 끝내는 이벤트라 유실되면 안 된다. 중복 호출만 막고 반드시 한 번 보낸다. */
  private notifyDefeat(): void {
    if (this.defeatNotified) return;
    this.defeatNotified = true;
    this.deps.onDefeated();
  }

  get isDefeated(): boolean {
    return this.defeated;
  }

  destroy(): void {
    this.clearScheduled();
    this.hpBarBack?.destroy();
    this.hpBarFill?.destroy();
    this.hpBarBack = null;
    this.hpBarFill = null;
    this.followHitbox = null;
    this.sprite?.destroy();
    this.sprite = null;
    // 사망 연출 도중 씬이 내려가도 결과 화면으로 넘어가야 한다.
    if (this.defeated) this.notifyDefeat();
  }

  // ────────────────────────────── 연출과 유틸 ──────────────────────────────

  /** 예고 표시. 피해가 나가기 전에 반드시 이걸 먼저 띄운다. (DEC-004) */
  private showTelegraph(
    x: number,
    y: number,
    width: number,
    height: number,
    durationMs: number,
  ): void {
    const marker = this.scene.add
      .image(x, y, TEXTURE.telegraph)
      .setDisplaySize(width, height)
      .setAlpha(TELEGRAPH.alphaMin)
      .setDepth(DEPTH.telegraph);
    this.ephemera.push(marker);

    const pulse = this.scene.tweens.add({
      targets: marker,
      alpha: TELEGRAPH.alphaMax,
      duration: TELEGRAPH.pulseMs,
      yoyo: true,
      repeat: -1,
    });
    this.tweens.push(pulse);

    this.after(durationMs, () => {
      pulse.remove();
      marker.destroy();
    });
  }

  /** 적 공격체 생성. `damage`가 없으면 씬이 피해를 전달할 수 없다. (types/combat.ts) */
  private spawnHitbox(
    x: number,
    y: number,
    width: number,
    height: number,
    lifeMs: number,
    consumeOnHit = false,
  ): Phaser.Physics.Arcade.Image {
    const box = this.scene.physics.add
      .image(x, y, TEXTURE.enemyAttack)
      .setDisplaySize(width, height)
      .setDepth(DEPTH.attack);

    this.arena.enemyAttacks.add(box);
    // 패링 반사용 — 이 공격을 누가 냈는지 알아야 씬이 반사 피해를 되돌려줄 수 있다.
    box.setData("source", this);
    box.setData("damage", PATTERN_DAMAGE);
    if (consumeOnHit) box.setData("consumeOnHit", true);
    (box.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

    this.ephemera.push(box);
    this.after(lifeMs, () => box.destroy());
    return box;
  }

  /** 돌진 잔상. 도형만으로 속도를 읽히게 하는 최소 장치다. */
  private spawnAfterimage(sprite: Phaser.Physics.Arcade.Sprite): void {
    const ghost = this.scene.add
      .image(sprite.x, sprite.y, TEXTURE.boss)
      .setDisplaySize(BODY.width, BODY.height)
      .setAlpha(TELEGRAPH.alphaMax)
      .setDepth(DEPTH.boss - 1);
    this.ephemera.push(ghost);

    this.tweens.push(
      this.scene.tweens.add({
        targets: ghost,
        alpha: 0,
        duration: DASH.afterimageFadeMs,
        onComplete: () => ghost.destroy(),
      }),
    );
  }

  /** 피격 순간의 흰색 플래시. 맞았다는 사실이 바로 보여야 한다. */
  private flash(): void {
    const sprite = this.sprite;
    if (!sprite) return;

    sprite.setTintFill(0xffffff);
    this.after(FEEDBACK.flashMs, () => sprite.clearTint());
  }

  /** 타격·착지 순간의 짧은 스케일 펀치. */
  private punch(sprite: Phaser.Physics.Arcade.Sprite): void {
    this.tweens.push(
      this.scene.tweens.add({
        targets: sprite,
        scaleX: sprite.scaleX * FEEDBACK.punchScale,
        scaleY: sprite.scaleY / FEEDBACK.punchScale,
        duration: FEEDBACK.punchMs,
        yoyo: true,
      }),
    );
  }

  private createHpBar(): void {
    const { width } = this.arena.bounds;
    const barWidth = width * HP_BAR.widthRatio;
    const left = (width - barWidth) / 2;
    const y = HP_BAR.topMargin;

    this.hpBarBack = this.scene.add
      .image(left, y, TEXTURE.solid)
      .setOrigin(0, 0.5)
      .setDisplaySize(barWidth, HP_BAR.height)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud);

    this.hpBarFill = this.scene.add
      .image(left, y, TEXTURE.boss)
      .setOrigin(0, 0.5)
      .setDisplaySize(barWidth, HP_BAR.height)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 1);
  }

  private refreshHpBar(): void {
    const fill = this.hpBarFill;
    if (!fill) return;

    const barWidth = this.arena.bounds.width * HP_BAR.widthRatio;
    this.tweens.push(
      this.scene.tweens.add({
        targets: fill,
        displayWidth: barWidth * (this.hp / this.maxHp),
        duration: FEEDBACK.punchMs,
      }),
    );
  }

  private after(delayMs: number, callback: () => void): void {
    this.timers.push(this.scene.time.delayedCall(delayMs, callback));
  }

  /**
   * 예약된 타이머·트윈·수명 오브젝트를 한 번에 정리한다.
   * 사망 후에 예약해 둔 히트박스가 뒤늦게 터지는 것을 막는 용도이기도 하다.
   */
  private clearScheduled(): void {
    for (const timer of this.timers) timer.remove();
    for (const tween of this.tweens) tween.remove();
    for (const object of this.ephemera) object.destroy();
    this.timers = [];
    this.tweens = [];
    this.ephemera = [];
  }
}
