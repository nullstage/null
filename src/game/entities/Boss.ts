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

import Phaser from "phaser";

import { BOSS, PLAYER } from "../config/gameBalance";
import {
  ashRise,
  bossOrbTrail,
  bossShockwave,
  bossTelegraphZone,
  deathBurst,
  enemySlash,
  groundDust,
  hitStop,
} from "../systems/CombatVfx";
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
  /** 그림 배율을 1.15로 키우면서 충돌 박스도 비례해 넓힌다 — 커 보이는데 안 맞으면 억울하다. */
  width: 84,
  height: 124,
  /** 패턴 사이에 플레이어 쪽으로 걸어오는 속도. 압박용이지 추격용이 아니다. */
  moveSpeed: 130,
  /** 이 거리 안에서는 멈춘다. 계속 밀고 들어오면 회피 공간이 사라진다. */
  keepDistanceX: 190,
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

/** 보스 체력 바. 방 폭에 대한 비율로 둬서 해상도가 바뀌어도 잘리지 않는다. */
const HP_BAR = { widthRatio: 0.52, height: 14, topMargin: 26 } as const;

const DEPTH = { telegraph: 1, attack: 5, boss: 10, hud: 100 } as const;

/**
 * 보스 그림 배율. 224px 셀 안의 실제 그림이 대략 200px이라, 1.15배면 화면에서 약 230px —
 * 플레이어(약 62px)의 네 배 가까이 돼 "압도하는 보스"로 읽힌다. (사용자 요청: 크기 확대)
 * 충돌 박스는 BODY 값(84×124)을 그대로 쓴다.
 */
const BOSS_SPRITE_SCALE = 1.15;

/**
 * 페이즈. 체력 66%·33%를 끊어 내려갈수록 빨라지고 기믹이 풀린다.
 * 수치(체력·피해량)는 올리지 않는다 — 빨라지고 다양해질 뿐이다. (MVP_PLAN §8과 충돌 없음)
 */
const PHASE = {
  twoAt: 0.66,
  threeAt: 0.33,
  cooldownScale: [1, 0.85, 0.7] as const,
  moveScale: [1, 1.12, 1.28] as const,
  /** 페이즈 전환 포효 동안 다음 패턴을 늦추는 시간. */
  transitionMs: 900,
} as const;

/** 기믹 패턴(가중치 계약 밖의 특수기). 일반 패턴 몇 번마다 한 번 끼어드는지. */
const GIMMICK_EVERY = 3;

const COMBO = {
  telegraphMs: 320,
  stepPx: 52,
  intervalMs: 540,
  finisherReachScale: 1.35,
  recoveryMs: 420,
} as const;

const BARRAGE = {
  telegraphMs: 550,
  count: 7,
  /** 부채꼴 반각(도). 플레이어 방향 기준 위아래로 이만큼 벌어진다. */
  fanDeg: 38,
  intervalMs: 90,
  speed: 380,
  recoveryMs: 500,
} as const;

const ERUPTION = {
  count: 5,
  stepPx: 132,
  /** 폭발 하나의 예고 시간. 행진 간격보다 길어 "따라오는 파도"로 읽힌다. */
  telegraphMs: 430,
  intervalMs: 170,
  width: 90,
  height: 100,
  activeMs: 200,
  recoveryMs: 460,
} as const;

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
  /** 체력 구간 페이즈(1~3). 내려갈수록 빨라지고 기믹이 풀린다. */
  private phase: 1 | 2 | 3 = 1;
  /** 첫 수를 이미 뒀는가. 오프닝은 무작위가 아니라 정해진 베기로 시작한다. */
  private hasOpened = false;
  /** 마지막 기믹 이후 일반 패턴 횟수. GIMMICK_EVERY에 닿으면 기믹이 끼어든다. */
  private patternsSinceGimmick = 0;
  /** 유휴 부양. 정지 프레임뿐이라도 몸이 숨쉬듯 떠 있어야 굳어 보이지 않는다. */
  private bobOffset = 0;
  /** 냉기 속성 적중 시 낮아진다. 잡몹과 같은 방식(BaseEnemy.applySlow)이다. */
  private speedMultiplier = 1;
  /** 슬로우가 실제로 풀려야 하는 시각(ms). 겹쳐 걸릴 때 먼저 건 타이머가 조기에 풀지 않게 막는다. */
  private slowUntilMs = 0;
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

    this.arena.enemyBodies.add(sprite);
    sprite.setData("enemy", this);
    this.sprite = sprite;

    // 씬이 보스방에 바닥 collider를 걸어주지 않고, slam 궤적도 직접 제어해야 한다.
    // 중력을 끄고 바닥 높이를 매 프레임 스냅하는 편이 예측 가능하다.
    //
    // `enemyBodies`는 중력을 받는 일반 적을 위한 그룹이라 기본값이 중력 켜짐이다.
    // `group.add()`가 그 기본값을 다시 적용하므로, 끄는 순서가 add보다 앞이면
    // 도로 켜진다 — 반드시 add 다음에 꺼야 한다. slam 중 airborne로 접지 스냅이
    // 풀리는 순간 그동안 숨어서 쌓인 낙하 속도가 화면 밖까지 떨어뜨렸던 원인이 이것이다.
    (sprite.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

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
    // 유휴 중에만 떠오르내린다 — 패턴 중엔 포즈·궤적이 우선이다.
    this.bobOffset = this.busy || this.airborne ? 0 : Math.sin(time * 0.004) * 5;
    this.clampToArena(sprite);

    if (this.busy) return;

    this.facePlayer(sprite);
    this.stepIdleMove(sprite);

    if (time < this.nextPatternAtMs) return;

    // 페이즈 2부터는 일반 패턴 몇 번마다 기믹(가중치 계약 밖의 특수기)이 끼어든다.
    if (this.phase >= 2 && this.patternsSinceGimmick >= GIMMICK_EVERY - 1) {
      this.runGimmick();
      return;
    }
    this.patternsSinceGimmick += 1;
    this.runPattern(this.selectPattern());
  }

  /** 인트로 연출 동안 첫 패턴을 미룬다. 씬이 등장 연출 길이에 맞춰 부른다. */
  holdPatterns(ms: number): void {
    this.nextPatternAtMs = Math.max(this.nextPatternAtMs, this.scene.time.now + ms);
  }

  /**
   * 포즈 교체. 보스는 애니메이션 없이 패턴별 정지 포즈만 골라 쓴다.
   * 예고 포즈를 먼저 보여주고 타격 순간에 바꿔야 "무엇을 하려는지"가 읽힌다. (DEC-004)
   */
  private setPose(frame: number): void {
    this.sprite?.setFrame(frame);
  }

  /** 타격 포즈를 잠깐 보여준 뒤 idle로 돌아온다. 젖혔던 몸도 이때 되돌린다. */
  private strikePose(frame: number, holdMs: number): void {
    this.setPose(frame);
    this.sprite?.setRotation(0);
    this.after(holdMs, () => this.setPose(BOSS_FRAME.idle));
  }

  private get groundY(): number {
    return this.arena.bounds.floorY - BODY.height / 2;
  }

  private clampToArena(sprite: Phaser.Physics.Arcade.Sprite): void {
    const half = BODY.width / 2;
    sprite.x = Math.min(Math.max(sprite.x, half), this.arena.bounds.width - half);
    if (!this.airborne) {
      sprite.y = this.groundY + this.bobOffset;
      // 중력이 꺼져 있어야 정상이지만, 혹시라도 다시 켜지면(그룹 재배정 등)
      // 접지 상태에서 티 안 나게 속도만 쌓인다. slam 이륙 순간 그 속도가 그대로
      // 터져 화면 밖으로 떨어지므로, 바닥에 붙어 있는 동안은 항상 0으로 눌러 둔다.
      sprite.setVelocityY(0);
    }
  }

  private facePlayer(sprite: Phaser.Physics.Arcade.Sprite): void {
    this.facing = this.deps.getPlayerPosition().x >= sprite.x ? 1 : -1;
    sprite.setFlipX(this.facing < 0);
  }

  private stepIdleMove(sprite: Phaser.Physics.Arcade.Sprite): void {
    const dx = this.deps.getPlayerPosition().x - sprite.x;
    const closing = Math.abs(dx) > BODY.keepDistanceX;
    const speed = BODY.moveSpeed * PHASE.moveScale[this.phase - 1] * this.speedMultiplier;
    sprite.setVelocityX(closing ? Math.sign(dx) * speed : 0);
  }

  /** 냉기 속성 적중. 이동 속도를 잠시 낮춘다. 잡몹과 같은 계약(BaseEnemy.applySlow) — 겹쳐 걸리면 더 늦게 끝나는 쪽까지 유지된다. */
  applySlow(factor: number, durationMs: number): void {
    if (this.defeated) return;
    this.speedMultiplier = factor;
    // 나중에 걸린 슬로우가 더 길면, 먼저 걸린 타이머가 그것을 조기에 풀어서는 안 된다.
    this.slowUntilMs = Math.max(this.slowUntilMs, this.scene.time.now + durationMs);
    this.scene.time.delayedCall(durationMs, () => {
      if (this.defeated) return;
      if (this.scene.time.now >= this.slowUntilMs) this.speedMultiplier = 1;
    });
  }

  // ────────────────────────────── 패턴 선택 ──────────────────────────────

  /**
   * 가중치 기반 패턴 선택. 동일 패턴 3연속을 막는다.
   * 순수 로직이므로 여기를 고치지 말고, 실행부만 손댄다.
   */
  private selectPattern(): BossPattern {
    // 첫 수는 정해진 오프닝(베기)이다 — 인트로 직후 무작위 전력 패턴이 튀어나오면
    // 등장 서사가 끊긴다. 가장 읽기 쉬운 근접 베기로 시작해 리듬을 서서히 올린다.
    if (!this.hasOpened) {
      this.hasOpened = true;
      this.sameStreak = 1;
      this.lastPattern = "slash";
      this.deps.onPatternSelected("slash");
      return "slash";
    }

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
    this.sprite?.setRotation(0);
    // 페이즈가 내려갈수록 쿨다운이 짧아진다 — 수치가 아니라 리듬이 조여든다.
    this.nextPatternAtMs =
      this.scene.time.now + BOSS.patternCooldownMs * PHASE.cooldownScale[this.phase - 1];
  }

  /** 예고 자세의 뒤로 젖히는 기울임. 정지 포즈뿐이라도 "당겼다 놓는" 리듬이 생긴다. */
  private windup(): void {
    this.sprite?.setRotation(this.facing * -0.055);
  }

  // ────────────────────────────── 기믹 패턴 ──────────────────────────────

  /**
   * 기믹 실행. Director 가중치 계약(slash/dash/projectile/slam) 밖의 특수기라
   * `onPatternSelected`를 부르지 않는다 — 성향 통계를 오염시키지 않기 위해서다.
   */
  private runGimmick(): void {
    this.patternsSinceGimmick = 0;
    this.busy = true;
    this.sprite?.setVelocity(0, 0);

    const pool: (() => void)[] =
      this.phase >= 3
        ? [() => this.executeComboSlash(), () => this.executeBarrage(), () => this.executeEruption()]
        : [() => this.executeComboSlash(), () => this.executeBarrage()];
    Phaser.Utils.Array.GetRandom(pool)();
  }

  /** 전진 3연 검격. 한 걸음씩 파고들며 베고, 3타는 더 크고 넓다. */
  private executeComboSlash(): void {
    const sprite = this.sprite;
    if (!sprite) {
      this.finishPattern();
      return;
    }

    const dir = this.facing;
    const swing = (step: number): void => {
      const isFinisher = step === 2;
      const reach = SLASH.reach * (isFinisher ? COMBO.finisherReachScale : 1);
      const hitX = sprite.x + dir * (BODY.width / 2 + reach / 2);

      bossTelegraphZone(this.scene, hitX, sprite.y, reach, SLASH.height, COMBO.telegraphMs);
      this.setPose(BOSS_FRAME.slashTelegraph);
      this.windup();

      this.after(COMBO.telegraphMs, () => {
        // 검을 따라 몸이 한 걸음 파고든다.
        this.tweens.push(
          this.scene.tweens.add({
            targets: sprite,
            x: sprite.x + dir * COMBO.stepPx,
            duration: 110,
            ease: "power2.out",
          }),
        );
        this.punch(sprite);
        this.strikePose(BOSS_FRAME.slashStrike, 200);
        this.spawnHitbox(hitX, sprite.y, reach, SLASH.height, SLASH.activeMs);
        enemySlash(this.scene, sprite.x + dir * (BODY.width / 2), sprite.y - 8, dir, reach + 28);
        if (isFinisher) {
          this.scene.cameras.main.shake(120, 0.006);
          this.after(SLASH.activeMs + COMBO.recoveryMs, () => this.finishPattern());
          return;
        }
        this.after(COMBO.intervalMs - COMBO.telegraphMs, () => swing(step + 1));
      });
    };

    swing(0);
  }

  /** 전방위 부채꼴 탄막. 한 발씩 각도를 옮겨 가며 부챗살을 편다. */
  private executeBarrage(): void {
    const sprite = this.sprite;
    if (!sprite) {
      this.finishPattern();
      return;
    }

    const muzzleX = sprite.x + this.facing * (BODY.width / 2 + PROJECTILE.size);
    const muzzleY = sprite.y - 12;
    bossTelegraphZone(
      this.scene,
      muzzleX,
      muzzleY,
      PROJECTILE.size * 3,
      PROJECTILE.size * 3,
      BARRAGE.telegraphMs,
    );
    this.setPose(BOSS_FRAME.projectileTelegraph);
    this.windup();

    this.after(BARRAGE.telegraphMs, () => {
      const volleyMs = (BARRAGE.count - 1) * BARRAGE.intervalMs;
      this.strikePose(BOSS_FRAME.projectileStrike, volleyMs + BARRAGE.recoveryMs);

      const target = this.deps.getPlayerPosition();
      const baseAngle = Math.atan2(target.y - muzzleY, target.x - muzzleX);
      for (let i = 0; i < BARRAGE.count; i += 1) {
        // 부챗살 순서를 아래→위로 쓸어 올린다. 동시에 쏘면 벽, 순서대로면 파도가 된다.
        const t = i / (BARRAGE.count - 1);
        const angle = baseAngle + Phaser.Math.DegToRad(Phaser.Math.Linear(-BARRAGE.fanDeg, BARRAGE.fanDeg, t));
        this.after(i * BARRAGE.intervalMs, () => {
          const shot = this.spawnHitbox(
            muzzleX,
            muzzleY,
            PROJECTILE.size,
            PROJECTILE.size,
            PROJECTILE.lifeMs,
            true,
          );
          shot.setVelocity(Math.cos(angle) * BARRAGE.speed, Math.sin(angle) * BARRAGE.speed);
          bossOrbTrail(this.scene, shot);
        });
      }

      this.after(volleyMs + BARRAGE.recoveryMs, () => this.finishPattern());
    });
  }

  /** 연쇄 지면 폭발. 보스 앞에서 시작해 플레이어 쪽으로 행진한다 — 뛰어넘거나 대시로 빠진다. */
  private executeEruption(): void {
    const sprite = this.sprite;
    if (!sprite) {
      this.finishPattern();
      return;
    }

    const dir = this.facing;
    const floorY = this.arena.bounds.floorY;
    const startX = sprite.x + dir * (BODY.width / 2 + 70);
    this.setPose(BOSS_FRAME.slamTelegraph);
    this.windup();

    for (let i = 0; i < ERUPTION.count; i += 1) {
      const at = Phaser.Math.Clamp(
        startX + dir * i * ERUPTION.stepPx,
        40,
        this.arena.bounds.width - 40,
      );
      this.after(i * ERUPTION.intervalMs, () => {
        bossTelegraphZone(
          this.scene,
          at,
          floorY - ERUPTION.height / 2,
          ERUPTION.width,
          ERUPTION.height,
          ERUPTION.telegraphMs,
        );
      });
      this.after(i * ERUPTION.intervalMs + ERUPTION.telegraphMs, () => {
        this.spawnHitbox(
          at,
          floorY - ERUPTION.height / 2,
          ERUPTION.width * 0.8,
          ERUPTION.height,
          ERUPTION.activeMs,
        );
        bossShockwave(this.scene, at, floorY - 6, ERUPTION.width * 1.4);
        groundDust(this.scene, at, floorY, "land");
        this.scene.cameras.main.shake(70, 0.004);
      });
    }

    const total = (ERUPTION.count - 1) * ERUPTION.intervalMs + ERUPTION.telegraphMs;
    this.after(total + ERUPTION.activeMs, () => {
      this.strikePose(BOSS_FRAME.slamStrike, ERUPTION.recoveryMs);
      this.after(ERUPTION.recoveryMs, () => this.finishPattern());
    });
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
    this.windup();

    this.after(SLASH.telegraphMs, () => {
      this.punch(sprite);
      this.strikePose(BOSS_FRAME.slashStrike, SLASH.activeMs + SLASH.recoveryMs);
      this.spawnHitbox(x, y, SLASH.reach, SLASH.height, SLASH.activeMs);
      // 판정은 투명하다 — 베는 그림은 플레이어 슬래시와 같은 문법의 초승달 궤적이 담당한다.
      enemySlash(this.scene, sprite.x + this.facing * (BODY.width / 2), y - 8, this.facing, SLASH.reach + 28);
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
    this.windup();

    this.after(DASH.telegraphMs, () => {
      this.strikePose(BOSS_FRAME.dashStrike, DASH.durationMs + DASH.recoveryMs);
      sprite.setVelocityX(dir * DASH.speed);
      // 출발의 무게 — 발밑 흙이 터지고 화면이 잠깐 흔들린다.
      groundDust(this.scene, sprite.x, this.arena.bounds.floorY, "land");
      this.scene.cameras.main.shake(90, 0.004);
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
    this.windup();

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
    // 판정은 투명하다 — 마젠타 구체와 꼬리가 그림을 맡는다.
    bossOrbTrail(this.scene, shot);
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
          this.windup();
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
          // 판정은 투명하다 — 착지의 그림은 링 충격파 + 돌 파편 + 흙먼지가 맡는다.
          bossShockwave(this.scene, targetX, this.arena.bounds.floorY - 6, SLAM.shockwaveWidth);
          groundDust(this.scene, targetX, this.arena.bounds.floorY, "land");
          hitStop(this.scene, 70);
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
    // 움찔(뒤로 살짝 밀림)도 패턴 밖에서만 — 궤적 트윈과 싸우면 안 된다.
    if (!this.busy) {
      this.strikePose(BOSS_FRAME.hit, 160);
      const sprite = this.sprite;
      if (sprite) {
        this.tweens.push(
          this.scene.tweens.add({
            targets: sprite,
            x: sprite.x - this.facing * 5,
            duration: 55,
            yoyo: true,
          }),
        );
      }
    }

    if (this.hp <= 0) {
      this.die();
      return;
    }

    // 체력 구간을 지나면 페이즈가 오른다. 한 번 오른 페이즈는 되돌아가지 않는다.
    if (this.phase === 1 && this.hp <= this.maxHp * PHASE.twoAt) this.enterPhase(2);
    else if (this.phase === 2 && this.hp <= this.maxHp * PHASE.threeAt) this.enterPhase(3);
  }

  /**
   * 페이즈 전환 포효. 진행 중인 패턴을 끊지는 않는다(타이머·트윈과 얽히지 않게) —
   * 화면이 흔들리고 충격파가 퍼지며, 다음 패턴만 잠깐 늦춰 "달라졌다"를 보여준다.
   */
  private enterPhase(next: 2 | 3): void {
    this.phase = next;
    const sprite = this.sprite;
    if (!sprite) return;

    this.nextPatternAtMs = Math.max(
      this.nextPatternAtMs,
      this.scene.time.now + PHASE.transitionMs,
    );

    hitStop(this.scene, 120);
    this.scene.cameras.main.shake(220, 0.01);
    this.scene.cameras.main.flash(160, 120, 10, 30);
    bossShockwave(this.scene, sprite.x, this.arena.bounds.floorY - 6, 300);
    groundDust(this.scene, sprite.x, this.arena.bounds.floorY, "land");

    // 분노가 몸에 남는다 — 페이즈가 오를수록 붉은 광채가 짙어진다. (WebGL 전용)
    if (this.scene.game.renderer.type === Phaser.WEBGL) {
      sprite.postFX.addGlow(0xff2040, next === 2 ? 2.5 : 5, 0);
    }

    // 포효 자세 — hit 프레임을 잠깐 크게 보여준다.
    this.setPose(BOSS_FRAME.hit);
    this.tweens.push(
      this.scene.tweens.add({
        targets: sprite,
        scaleX: sprite.scaleX * 1.12,
        scaleY: sprite.scaleY * 1.12,
        duration: 180,
        yoyo: true,
        onComplete: () => {
          if (!this.busy) this.setPose(BOSS_FRAME.idle);
        },
      }),
    );
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
    // 런의 마지막 타격이다. 시간이 잠깐 멎고, 화면이 하얗게 번쩍이며, 재가 오래 떠오른다.
    hitStop(this.scene, 300);
    const cam = this.scene.cameras.main;
    cam.shake(320, 0.012);
    cam.flash(260, 255, 235, 220);
    const baseZoom = cam.zoom;
    cam.zoomTo(baseZoom * 1.1, 220, "Sine.easeOut");
    this.scene.time.delayedCall(420, () => cam.zoomTo(baseZoom, 380, "Sine.easeInOut"));

    deathBurst(this.scene, sprite.x, sprite.y, SILHOUETTE.boss);
    ashRise(this.scene, sprite.x, sprite.y - 30, SILHOUETTE.boss);
    ashRise(this.scene, sprite.x, sprite.y + 30, 0xff2a3a);

    this.scene.tweens.add({
      targets: sprite,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: FEEDBACK.deathMs * 2,
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

  /**
   * 예고 표시. 피해가 나가기 전에 반드시 이걸 먼저 띄운다. (DEC-004)
   * 주황 단색 사각형 대신 표적 프레임+불티 구역(bossTelegraphZone)으로 그린다 —
   * VFX가 수명을 스스로 관리하므로 보스가 죽어도 알아서 사라진다.
   */
  private showTelegraph(
    x: number,
    y: number,
    width: number,
    height: number,
    durationMs: number,
  ): void {
    bossTelegraphZone(this.scene, x, y, width, height, durationMs);
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
      .setDepth(DEPTH.attack)
      // 판정체는 보이지 않는다 — 그림은 패턴별 VFX(초승달·구체·충격파)가 맡는다.
      .setAlpha(0);

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

  /**
   * 돌진 잔상. 예전엔 224px 셀을 72×108로 눌러 찍어 그림이 왜곡됐다 —
   * 현재 프레임·방향·배율을 그대로 복제하고 실루엣으로 칠해, 플레이어 대시 잔상과
   * 같은 문법(진행 반대로 밀리며 늘어나는 가산 실루엣)으로 남긴다.
   */
  private spawnAfterimage(sprite: Phaser.Physics.Arcade.Sprite): void {
    const ghost = this.scene.add.image(sprite.x, sprite.y, TEXTURE.boss, sprite.frame.name);
    ghost.setScale(sprite.scaleX, sprite.scaleY);
    ghost.setFlipX(sprite.flipX);
    ghost.setDepth(DEPTH.boss - 1);
    ghost.setTintFill(SILHOUETTE.boss);
    ghost.setAlpha(0.4);
    ghost.setBlendMode(Phaser.BlendModes.ADD);
    this.ephemera.push(ghost);

    this.tweens.push(
      this.scene.tweens.add({
        targets: ghost,
        alpha: 0,
        x: ghost.x - this.facing * 26,
        scaleX: ghost.scaleX * 1.08,
        duration: DASH.afterimageFadeMs,
        ease: "power2.out",
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
      .setTint(0x1a0d12)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud);

    // fill이 TEXTURE.boss로 잡혀 있던 버그 — 보스 그림 한 장이 바 폭으로 늘어나 있었다.
    this.hpBarFill = this.scene.add
      .image(left, y, TEXTURE.solid)
      .setOrigin(0, 0.5)
      .setDisplaySize(barWidth, HP_BAR.height)
      .setTint(0xe04848)
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
