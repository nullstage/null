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

import { neoDunggeunmo } from "@/styles/fonts";

import { BOSS, PLAYER } from "../config/gameBalance";
import {
  ashRise,
  bossChainLaunchTrail,
  bossChainOrbitFx,
  bossChainPullImpactFx,
  bossDashSlashFx,
  bossGroundSpikeFx,
  bossJudgmentLineFx,
  bossJudgmentRingFx,
  bossPhaseAuraFx,
  bossShadowEmergeFx,
  bossShockwave,
  bossSlamEruptionFx,
  bossSlashCrescentFx,
  bossTelegraphBoxFx,
  deathBurst,
  groundDust,
  hitStop,
  pulseGlitchFx,
} from "../systems/CombatVfx";
import { playSfx } from "../systems/audio";
import { pickBossPattern } from "../systems/DirectorPolicy";
import { AUDIO, BOSS_FRAME, SILHOUETTE, TEXTURE, type CombatArena } from "../types/combat";
import type { BossPattern, BossPatternWeights } from "../types/game";

/**
 * 보스 전용 임시 수치. (OQ-007 미결정)
 *
 * `gameBalance.ts`의 `BOSS`에는 체력·쿨타임·연속 제한만 있다.
 * 나머지를 공용 파일에 지금 넣으면 병렬 작업 중 충돌하므로, 여기 이름을 붙여 두고
 * 통합 시점에 `gameBalance.ts`로 옮긴다. (최종 보고 4번 항목)
 */
const BODY = {
  /**
   * 그림 배율을 키우면서 충돌 박스도 비례해 넓힌다 — 커 보이는데 안 맞으면 억울하다.
   * 2배 확대 때 그림 크기만큼 정직하게 2배(84→168, 124→248)로 키웠지만, 그림 자체가
   * 사각 프레임보다 훨씬 커 보여서 여전히 작다는 지적을 받아 한 번 더 키웠다.
   * (사용자 요청: 히트박스가 보스 크기보다 너무 작다)
   */
  width: 260,
  height: 340,
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
  /** 화면을 벗어난 투사체를 확실히 회수하기 위한 수명. `executeBarrage`(부채꼴 탄막) 전용. */
  lifeMs: 3_000,
  recoveryMs: 320,
} as const;

/**
 * 사슬 휘두르기 — 기본 패턴(projectile) 실행부. 손에서 떨어져 나가 화면을 가로지르는
 * 투사체가 아니라, 그 자리에서 뻗어 나왔다 되감기는 채찍이다. (사용자 지적: 왜 발사하냐,
 * 손에서 나가야 한다) 판정체를 이동시키지 않는 것만으로 `bossChainLaunchTrail`을 그대로
 * 재사용한다 — 폴링 대상이 안 움직이면 이펙트도 제자리에서만 재생된다.
 */
const WHIP = {
  reach: 220,
  height: 90,
  activeMs: 160,
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

/** 피격·체력바·사망 연출. */
const FEEDBACK = {
  flashMs: 70,
  hpBarTweenMs: 90,
  deathMs: 420,
} as const;

/**
 * 보스 체력 바. 제공된 장식 프레임(`ui/boss-hp-frame.png`, 1545×364)을 그대로 잘라 썼다 —
 * 가운데 띠가 게이지 창, 위/아래 검은 문장이 이름·부제 자리다. 이미지를 분석해서 얻은
 * 각 영역의 비율(원본 대비 %)을 그대로 쓴다 — 해상도가 바뀌어도 프레임 안에서 어긋나지 않는다.
 * `widthRatio`는 플레이어 체력바(화면 왼쪽 위)와 겹치지 않을 만큼 가운데로 좁혀 잡았다.
 */
const HP_BAR = {
  widthRatio: 0.52,
  topMargin: 16,
  /** 프레임 원본 비율(가로/세로). 배율을 키워도 이 비율을 유지해야 그림이 안 찌그러진다. */
  frameAspect: 1545 / 364,
  /**
   * 게이지 창(가운데 흰 띠) — 프레임 기준 좌/우/중심Y/높이 비율.
   * 높이는 실제 구멍(0.132)보다 키웠다 — 프레임이 위에 덮이므로 구멍 밖으로 삐져나온
   * 부분은 프레임 테두리가 그대로 가려준다. "체력바가 잘 안 보인다"는 지적으로 두껍게 키움.
   */
  window: { left: 0.0375, right: 0.9596, centerY: 0.5742, height: 0.185 },
  /**
   * 게이지 구멍(프레임에서 실제로 뚫린 투명 영역) 실측값 — 원본에서 x 95..1438,
   * y 183..230이다. 위 `window`는 채움 막대를 프레임 밑으로 밀어 넣으려고 일부러
   * 구멍보다 넓게 잡은 값이라, 그 중심에 숫자를 놓으면 구멍 중심에서 밀린다
   * (오른쪽 1.6px·아래 1.1px). 체력 숫자는 이 구멍을 기준으로 놓는다.
   */
  hole: { centerX: (95 + 1438) / 2 / 1545, centerY: (183 + 230) / 2 / 364 },
  /**
   * 위 문장(이름)·아래 문장(부제) 중심 Y 비율.
   * 원본에서 명패 안쪽(검은 면)의 세로 범위를 픽셀로 재서 그 한가운데로 잡았다 —
   * 위 명패 y 87..166, 아래 명패 y 241..298 (전체 364).
   */
  nameY: (87 + 166) / 2 / 364,
  titleY: (241 + 298) / 2 / 364,
} as const;

/** 체력바 위 문장(이름)·아래 문장(부제). 보스 인트로 배너(BossScene)와 같은 문구를 쓴다. */
const BOSS_NAME = "「 집 행 자 」";
const BOSS_TITLE = "이름들을 거두는 자";

// boss는 플레이어(Player.ts의 TUNING.depth.player = 10)보다 낮아야 한다 — 같은 값이면
// 나중에 추가되는 쪽(보스)이 동률에서 이겨 앞을 가로막을 때 플레이어가 가려진다.
// (사용자 요청: 보스가 앞에 서면 캐릭터가 안 보인다)
const DEPTH = { telegraph: 1, attack: 5, boss: 9, hud: 100 } as const;

/**
 * 보스 그림 배율. 화면에서 약 233px로 보이던 이전 크기가 작다는 지적을 받아
 * 3배(약 700px)로 시도했더니 머리가 화면 위로 잘려나갈 만큼 과했다 — 2배(약 470px)로
 * 낮췄다. 플레이어(약 62px)를 압도하면서도 화면 안에 들어온다. (사용자 요청: 2배 확대)
 * 충돌 박스(BODY)도 같은 비율로 키워야 커 보이는데 안 맞는 일이 없다.
 */
const BOSS_SPRITE_SCALE = 0.68 * 2;

/**
 * 프레임별 그림 높이 정규화(BOSS_FRAME_ART_HEIGHTS)는 제거했다 — 웅크린 프레임
 * (슬램 126px 등)을 idle 높이로 늘려 "공격 때 갑자기 커졌다 작아지는" 원인이었다.
 * 시트 원화를 사용자가 프레임 간 일관되게 재정렬(2026-08-10)해 보정 자체가 불필요하다.
 */

/** 공격 이펙트 배율. 보스를 2배로 키운 뒤 이펙트만 그대로라 왜소해 보인다는 지적을 받아 같이 키웠다. */
const VFX_SCALE = 2;

/**
 * 그림의 실제 바닥선(발밑)이 셀 중심보다 아래로 떨어진 거리(셀 로컬 px, 스케일 전).
 * `combat.ts`의 `BOSS_SPRITE_SHEET` packing 규칙 — 셀 높이 409, 모든 프레임이 바닥에서
 * 10px 위로 정렬 — 에서 고정으로 나온 값이라, 시퀀스 12개가 전부 이 값을 공유한다.
 * 물리 바디는 셀 중심에 두되(BODY 크기가 작아 오차가 작다), 그림의 시각적 바닥은
 * 이 값으로 따로 보정해야 발이 바닥에서 뜨거나 파묻히지 않는다.
 */
const VISUAL_GROUND_BELOW_CENTER_LOCAL = 409 - 10 - 409 / 2;

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

/** 사슬 포획 — 신규 기믹. 사슬이 닿으면 플레이어를 보스 쪽으로 강제로 끌어당긴다. */
const CHAIN_PULL = {
  telegraphMs: 550,
  /** 사슬이 닿는 최대 거리. 이 안에 있어야 판정이 생긴다. */
  reach: 320,
  height: 90,
  activeMs: 220,
  /** 끌려오는 거리·시간. 짧고 굵게 — 그 자리에서 반격당할 여지를 준다. */
  pullDistance: 190,
  pullDurationMs: 240,
  recoveryMs: 420,
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
  /** 그림자 상태 — 상호작용 전까지는 서 있기만 한다(플레이어를 보지도, 패턴을 쓰지도 않는다). */
  private dormant = true;

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
  /** 현재 포즈 원화의 크기 차이를 보정한 실제 Phaser 배율. */

  private timers: Phaser.Time.TimerEvent[] = [];
  private tweens: Phaser.Tweens.Tween[] = [];
  /** 예고·투사체·잔상처럼 수명이 짧은 오브젝트. 씬이 내려갈 때 한 번에 정리한다. */
  private ephemera: Phaser.GameObjects.GameObject[] = [];

  private hpBarBack: Phaser.GameObjects.Image | null = null;
  private hpBarFill: Phaser.GameObjects.Image | null = null;
  private hpFrame: Phaser.GameObjects.Image | null = null;
  private hpNameText: Phaser.GameObjects.Text | null = null;
  private hpTitleText: Phaser.GameObjects.Text | null = null;
  private hpValueText: Phaser.GameObjects.Text | null = null;

  constructor(deps: BossDeps) {
    this.deps = deps;
    this.scene = deps.scene;
    this.arena = deps.arena;
  }

  // ────────────────────────────── 생성과 루프 ──────────────────────────────

  /**
   * 전달받은 x만 쓰고 y는 바닥에 맞춘다. 보스는 중력을 직접 다루기 때문이다.
   * 처음엔 싸우는 상태가 아니라 방 가운데 가만히 선 그림자다 — 플레이어가
   * 다가가 상호작용해야(`awaken`) 진짜 등장 연출과 함께 전투가 시작된다.
   * (사용자 요청: 보스룸 NPC형 그림자 → 상호작용 시 보스전 시작)
   */
  spawn(x: number, _y: number): void {
    // 셀 안에서 실제 그림은 여백을 두고 그려져 있다. setDisplaySize로 셀을 통째로
    // 눌러 맞추면 보스가 작아 보이므로, 그림은 스케일로 키우고 충돌 박스만 따로 잡는다.
    const sprite = this.scene.physics.add
      .sprite(x, this.groundY, TEXTURE.bossIdle, 0)
      .setScale(BOSS_SPRITE_SCALE)
      .setDepth(DEPTH.boss);
    // setSize만 쓰면 Phaser가 셀 "가운데"에 바디를 놓는다 — 그림이 바닥 쪽으로 치우쳐
    // 있어(발이 셀 하단 가까이) 가운데 정렬로는 다리가 바디 밖으로 빠져 안 맞는다.
    // (사용자 지적: 히트박스가 다리를 못 맞힌다) 바디 바닥을 그림의 실제 바닥선 근처에
    // 직접 붙인다 — 머리 위쪽은 조금 비워 주더라도 다리는 반드시 잡는다.
    const bodyWidthLocal = BODY.width / BOSS_SPRITE_SCALE;
    const bodyHeightLocal = BODY.height / BOSS_SPRITE_SCALE;
    sprite.body?.setSize(bodyWidthLocal, bodyHeightLocal);
    sprite.body?.setOffset((463 - bodyWidthLocal) / 2, 395 - bodyHeightLocal);

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

    // 그림자 상태 — 어둡게 가라앉은 실루엣으로 완전히 멈춰 선다. 숨쉬는 흔들림도,
    // idle 애니메이션도 없다(사용자 요청: 깨우기 전엔 움직이는 모션이 아예 없어야 한다).
    // 체력바도, 패턴 타이머도 아직 없다(awaken 전까지 update()가 그 아래 로직을 건너뛴다).
    sprite.setTintFill(0x140a12);
    sprite.setAlpha(0.82);
    // 방 가운데 서서 왼쪽(입장하는 플레이어 쪽)을 본다. 원본 그림은 오른쪽을 향한다.
    sprite.setFlipX(true);
  }

  /**
   * 그림자가 실체화한다 — 씬(BossScene)이 상호작용 판정 후 부른다.
   * 등장 연출·체력바·패턴 타이머가 전부 이 시점에 시작된다.
   */
  awaken(): void {
    const sprite = this.sprite;
    if (!sprite || !this.dormant) return;
    this.dormant = false;

    this.clearScheduled();
    sprite.clearTint();
    this.tweens.push(this.scene.tweens.add({ targets: sprite, alpha: 1, duration: 260 }));

    this.createHpBar();

    // 등장 연출 — 그림자 덩어리에서 실체화하는 6프레임을 재생한 뒤 idle로 넘어간다.
    // 첫 패턴은 씬(BossScene.runBossIntro)이 인트로 배너 길이만큼 별도로 미룬다.
    // 이펙트는 바닥 원점(bottom-anchor)이라 y에 바닥선을 줘야 한다. groundY(스프라이트
    // 중심)를 주면 그만큼 공중에 떠 보인다 — 페이즈 오오라·지면 가시와 같은 기준.
    bossShadowEmergeFx(this.scene, sprite.x, this.arena.bounds.floorY - 6, VFX_SCALE);
    // 실체화 전용 긴 트랙 — 인트로 연출(카메라·배너) 길이를 소리로 채운다.
    playSfx(this.scene, AUDIO.bossAwaken);
    this.setPose(BOSS_FRAME.spawn);
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (!this.busy) this.setPose(BOSS_FRAME.idle);
    });

    this.nextPatternAtMs = this.scene.time.now + BOSS.patternCooldownMs;
  }

  update(time: number, _deltaMs: number): void {
    const sprite = this.sprite;
    if (this.defeated || !sprite) return;

    if (this.followHitbox) this.followHitbox.setPosition(sprite.x, this.attackY);
    // 유휴 중에만 떠오르내린다 — 패턴 중엔 포즈·궤적이 우선이고, 그림자 상태는 아예 멈춰야 한다.
    this.bobOffset = this.busy || this.airborne || this.dormant ? 0 : Math.sin(time * 0.004) * 5;
    if (!this.airborne) sprite.y = this.groundY + this.bobOffset;
    this.clampToArena(sprite);

    // 그림자 상태 — 깨어나기 전까지는 그 자리에 가만히 서 있는다.
    // 플레이어를 쳐다보지도, 다가가지도, 패턴을 골라 쓰지도 않는다.
    if (this.dormant) return;

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
   * 포즈 교체. 패턴별 예고·타격 애니메이션을 재생한다.
   * 예고 포즈를 먼저 보여주고 타격 순간에 바꿔야 "무엇을 하려는지"가 읽힌다. (DEC-004)
   */
  private setPose(animKey: string): void {
    const sprite = this.sprite;
    if (!sprite) return;

    sprite.play(animKey, true);
  }

  /** 타격 애니메이션을 잠깐 재생한 뒤 idle로 돌아온다. 젖혔던 몸도 이때 되돌린다. */
  private strikePose(animKey: string, holdMs: number): void {
    this.setPose(animKey);
    this.sprite?.setRotation(0);
    this.after(holdMs, () => this.setPose(BOSS_FRAME.idle));
  }

  private get groundY(): number {
    return this.arena.bounds.floorY - VISUAL_GROUND_BELOW_CENTER_LOCAL * BOSS_SPRITE_SCALE;
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

  /**
   * 근접형 공격 판정(베기·돌진·사슬 등)의 y 기준점. `sprite.y`(보스 원점)를 그대로 쓰면
   * 안 된다 — 그림이 2배로 커지면서 원점이 가슴 위쪽까지 올라가, 그 높이에 판정을 놓으면
   * 바닥에 선 플레이어에게 전혀 안 닿는다. (사용자 지적: 스킬이 전체적으로 너무 높아서
   * 안 맞는다) 바닥에서 고정 거리만큼 낮춘 지점을 쓴다.
   */
  private get attackY(): number {
    return this.arena.bounds.floorY - 60;
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
    // 걷는 동안에는 walk, 멈추면 idle로 — 패턴 중(busy)에는 이 함수 자체가 안 불린다.
    this.setPose(closing ? BOSS_FRAME.walk : BOSS_FRAME.idle);
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
        ? [
            () => this.executeComboSlash(),
            () => this.executeBarrage(),
            () => this.executeChainPull(),
            () => this.executeEruption(),
          ]
        : [() => this.executeComboSlash(), () => this.executeBarrage(), () => this.executeChainPull()];
    Phaser.Utils.Array.GetRandom(pool)();
  }

  /** 전진 3연 검격. 한 걸음씩 파고들며 베고, 3타는 더 크고 넓다. */
  private executeComboSlash(): void {
    const sprite = this.sprite;
    if (!sprite) {
      this.finishPattern();
      return;
    }
    // 전용 트랙 없음 — 플레이어 3타 소리를 낮고 느리게 눌러 거대한 검격으로 쓴다.
    playSfx(this.scene, AUDIO.swordHit3, { detune: -500, rate: 0.85 });

    const dir = this.facing;
    const swing = (step: number): void => {
      const isFinisher = step === 2;
      const reach = SLASH.reach * (isFinisher ? COMBO.finisherReachScale : 1);
      const hitX = sprite.x + dir * (BODY.width / 2 + reach / 2);

      bossTelegraphBoxFx(this.scene, hitX, this.attackY, reach, SLASH.height, COMBO.telegraphMs);
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
        this.strikePose(BOSS_FRAME.slashStrike, 200);
        this.spawnHitbox(hitX, this.attackY, reach, SLASH.height, SLASH.activeMs);
        bossSlashCrescentFx(this.scene, sprite.x + dir * (BODY.width / 2), this.attackY, dir, VFX_SCALE);
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
    const muzzleY = this.attackY;
    bossTelegraphBoxFx(
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
          bossChainLaunchTrail(this.scene, shot, this.facing, VFX_SCALE);
          // 전용 트랙 없음 — 총성을 낮게 눌러 발사체마다 한 발씩. 부챗살 순서대로 음이 조금씩 오른다.
          playSfx(this.scene, AUDIO.gunShot, { detune: -450 + i * 40, rate: 0.9 });
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
    this.setPose(BOSS_FRAME.judgmentTelegraph);
    this.windup();
    // 판결을 여는 순간 — 발밑에 고리가 한 번 떠오른다.
    // 사용자 지적: 너무 높이 뜨고 너무 작다 — 바닥에 더 붙이고 배율을 따로 키운다.
    bossJudgmentRingFx(this.scene, sprite.x, floorY, VFX_SCALE * 1.5);

    for (let i = 0; i < ERUPTION.count; i += 1) {
      const at = Phaser.Math.Clamp(
        startX + dir * i * ERUPTION.stepPx,
        40,
        this.arena.bounds.width - 40,
      );
      this.after(i * ERUPTION.intervalMs, () => {
        bossJudgmentLineFx(this.scene, at, floorY, VFX_SCALE);
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
        // 전용 트랙 없음 — 검극 가시 소리를 낮게 눌러 폭발 행진의 걸음마다 한 번씩.
        playSfx(this.scene, AUDIO.spike, { detune: -400, rate: 0.85 });
        this.scene.cameras.main.shake(70, 0.004);
      });
    }

    const total = (ERUPTION.count - 1) * ERUPTION.intervalMs + ERUPTION.telegraphMs;
    this.after(total + ERUPTION.activeMs, () => {
      this.strikePose(BOSS_FRAME.judgmentStrike, ERUPTION.recoveryMs);
      this.after(ERUPTION.recoveryMs, () => this.finishPattern());
    });
  }

  /**
   * 사슬 포획. 예고 구간에 플레이어가 있으면 사슬이 닿아 보스 쪽으로 강제로 끌어당긴다 —
   * 피해는 다른 기믹과 같지만, 판정체에 `pull` 데이터를 실어 씬(BossScene)이 위치까지 옮긴다.
   */
  private executeChainPull(): void {
    const sprite = this.sprite;
    if (!sprite) {
      this.finishPattern();
      return;
    }
    playSfx(this.scene, AUDIO.bossChain);

    const dir = this.facing;
    const x = sprite.x + dir * (BODY.width / 2 + CHAIN_PULL.reach / 2);
    const y = this.attackY;
    this.showTelegraph(x, y, CHAIN_PULL.reach, CHAIN_PULL.height, CHAIN_PULL.telegraphMs);
    bossChainOrbitFx(this.scene, sprite.x + dir * (BODY.width / 2), y, CHAIN_PULL.telegraphMs, VFX_SCALE);
    this.setPose(BOSS_FRAME.chainPullTelegraph);
    this.windup();

    this.after(CHAIN_PULL.telegraphMs, () => {
      this.strikePose(BOSS_FRAME.chainPullStrike, CHAIN_PULL.activeMs + CHAIN_PULL.recoveryMs);
      bossChainPullImpactFx(this.scene, x, y, VFX_SCALE);
      const box = this.spawnHitbox(x, y, CHAIN_PULL.reach, CHAIN_PULL.height, CHAIN_PULL.activeMs, true);
      // 씬(BossScene)이 이 값으로 플레이어를 당긴다 — 방향은 "이 지점을 향해",
      // 거리는 고정값(clamp는 씬이 arena 경계로 건다).
      box.setData("pull", {
        towardX: sprite.x,
        distance: CHAIN_PULL.pullDistance,
        durationMs: CHAIN_PULL.pullDurationMs,
      });
      this.after(CHAIN_PULL.activeMs + CHAIN_PULL.recoveryMs, () => this.finishPattern());
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
    // 전용 트랙 없음 — 플레이어 3타 소리를 낮고 느리게 눌러 거대한 검격으로 쓴다.
    playSfx(this.scene, AUDIO.swordHit3, { detune: -500, rate: 0.85 });

    const x = sprite.x + this.facing * (BODY.width / 2 + SLASH.reach / 2);
    const y = this.attackY;
    this.showTelegraph(x, y, SLASH.reach, SLASH.height, SLASH.telegraphMs);
    this.setPose(BOSS_FRAME.slashTelegraph);
    this.windup();

    this.after(SLASH.telegraphMs, () => {
      this.strikePose(BOSS_FRAME.slashStrike, SLASH.activeMs + SLASH.recoveryMs);
      this.spawnHitbox(x, y, SLASH.reach, SLASH.height, SLASH.activeMs);
      // 판정은 투명하다 — 그림은 초승달 궤적 스프라이트가 담당한다.
      bossSlashCrescentFx(this.scene, sprite.x + this.facing * (BODY.width / 2), y, this.facing, VFX_SCALE);
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
    // 전용 트랙 없음 — 플레이어 대시 소리를 낮고 느리게 눌러 돌진의 무게를 낸다.
    playSfx(this.scene, AUDIO.dash, { detune: -600, rate: 0.8 });

    const dir = this.facing;
    const reach = (DASH.speed * DASH.durationMs) / 1000;
    this.showTelegraph(
      sprite.x + (dir * reach) / 2,
      this.attackY,
      reach,
      SLASH.height,
      DASH.telegraphMs,
    );
    this.setPose(BOSS_FRAME.dashTelegraph);
    this.windup();

    this.after(DASH.telegraphMs, () => {
      this.strikePose(BOSS_FRAME.dashStrike, DASH.durationMs + DASH.recoveryMs);
      sprite.setVelocityX(dir * DASH.speed);
      bossDashSlashFx(this.scene, sprite.x + dir * (BODY.width / 2), this.attackY, dir, VFX_SCALE);
      // 출발의 무게 — 발밑 흙이 터지고 화면이 잠깐 흔들린다.
      groundDust(this.scene, sprite.x, this.arena.bounds.floorY, "land");
      this.scene.cameras.main.shake(90, 0.004);
      this.followHitbox = this.spawnHitbox(
        sprite.x,
        this.attackY,
        DASH.hitWidth,
        SLASH.height,
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

  /** 사슬 휘두르기. 손에서 뻗어 나온 채찍이 그 자리에서 여러 번 스냅한다 — 날아가지 않는다. */
  private executeProjectile(): void {
    const sprite = this.sprite;
    if (!sprite) {
      this.finishPattern();
      return;
    }
    // 사슬 포획과 같은 트랙 — 휘두르기는 조금 빠르고 높게 틀어 구분한다.
    playSfx(this.scene, AUDIO.bossChain, { detune: 150, rate: 1.15 });

    const dir = this.facing;
    const x = sprite.x + dir * (BODY.width / 2 + WHIP.reach / 2);
    const y = this.attackY;
    this.showTelegraph(x, y, WHIP.reach, WHIP.height, PROJECTILE.telegraphMs);
    this.setPose(BOSS_FRAME.projectileTelegraph);
    this.windup();

    this.after(PROJECTILE.telegraphMs, () => {
      const volleyMs = (PROJECTILE.count - 1) * PROJECTILE.intervalMs;
      this.strikePose(BOSS_FRAME.projectileStrike, volleyMs + PROJECTILE.recoveryMs);
      for (let i = 0; i < PROJECTILE.count; i += 1) {
        this.after(i * PROJECTILE.intervalMs, () => this.snapChainWhip(x, y));
      }
      this.after(volleyMs + PROJECTILE.recoveryMs, () => this.finishPattern());
    });
  }

  /** 채찍이 제자리에서 한 번 스냅한다 — 판정체를 이동시키지 않아 이펙트도 날아가지 않는다. */
  private snapChainWhip(x: number, y: number): void {
    const shot = this.spawnHitbox(x, y, WHIP.reach, WHIP.height, WHIP.activeMs, true);
    // 판정은 투명하다 — 사슬 갈고리 스프라이트가 그림을 맡는다. 속도를 주지 않으므로
    // bossChainLaunchTrail의 폴링 대상이 안 움직여 이펙트도 제자리에서만 재생된다.
    bossChainLaunchTrail(this.scene, shot, this.facing, VFX_SCALE);
  }

  /** 점프 내려찍기. 착지 지점을 띄운 뒤 떨어진다. 지연 장판은 만들지 않는다. (MVP_PLAN §8) */
  private executeSlam(): void {
    const sprite = this.sprite;
    if (!sprite) {
      this.finishPattern();
      return;
    }
    playSfx(this.scene, AUDIO.bossSlam);

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
          this.strikePose(BOSS_FRAME.slamStrike, SLAM.activeMs + SLAM.recoveryMs);
          this.scene.cameras.main.shake(SLAM.shakeMs, SLAM.shakeIntensity);
          this.spawnHitbox(
            targetX,
            impactY,
            SLAM.shockwaveWidth,
            SLAM.shockwaveHeight,
            SLAM.activeMs,
          );
          // 판정은 투명하다 — 착지의 그림은 기둥 폭발 스프라이트 + 흙먼지가 맡는다.
          // 사용자 지적: 너무 높이 뜬다 — 바닥에 더 붙인다.
          bossSlamEruptionFx(this.scene, targetX, this.arena.bounds.floorY + 12, VFX_SCALE);
          groundDust(this.scene, targetX, this.arena.bounds.floorY, "land");
          hitStop(this.scene, 70);
          this.after(SLAM.activeMs + SLAM.recoveryMs, () => this.finishPattern());
        },
      }),
    );
  }

  // ────────────────────────────── 피해와 사망 ──────────────────────────────

  takeDamage(amount: number): void {
    // 그림자는 아직 싸움에 들어오지 않았다 — 스쳐도 반응하지 않는다.
    if (this.defeated || this.dormant) return;

    this.hp = Math.max(0, this.hp - amount);
    this.refreshHpBar();
    this.flash();
    // 패턴 중이면 그 포즈를 지키게 둔다 — 예고 자세가 피격으로 지워지면 뭘 준비했는지 놓친다.
    // 움찔(뒤로 살짝 밀림)도 패턴 밖에서만 — 궤적 트윈과 싸우면 안 된다.
    if (!this.busy) {
      this.strikePose(BOSS_FRAME.hurt, 400);
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
    // 전용 포효 트랙 없음 — 사슬 트랙을 낮고 느리게 눌러 으르렁거림으로 쓴다.
    playSfx(this.scene, AUDIO.bossChain, { detune: -500, rate: 0.7 });

    this.nextPatternAtMs = Math.max(
      this.nextPatternAtMs,
      this.scene.time.now + PHASE.transitionMs,
    );

    hitStop(this.scene, 120);
    this.scene.cameras.main.shake(220, 0.01);
    this.scene.cameras.main.flash(160, 120, 10, 30);
    pulseGlitchFx(this.scene, next === 2 ? 0.65 : 0.9, 550);
    bossShockwave(this.scene, sprite.x, this.arena.bounds.floorY - 6, 300);
    bossPhaseAuraFx(this.scene, sprite.x, this.arena.bounds.floorY - 6, VFX_SCALE);
    groundDust(this.scene, sprite.x, this.arena.bounds.floorY, "land");

    // 분노가 몸에 남는다 — 페이즈가 오를수록 붉은 광채가 짙어진다. (WebGL 전용)
    if (this.scene.game.renderer.type === Phaser.WEBGL) {
      sprite.postFX.addGlow(0xff2040, next === 2 ? 2.5 : 5, 0);
    }

    // 포효 자세 — 에너지가 차오르는 8프레임 전용 연출을 재생한다.
    this.setPose(BOSS_FRAME.phaseChange);
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (!this.busy) this.setPose(BOSS_FRAME.idle);
    });
  }

  private die(): void {
    this.defeated = true;
    this.clearScheduled();

    const sprite = this.sprite;
    if (!sprite) {
      this.notifyDefeat();
      return;
    }
    // 전용 트랙 없음 — 내려찍기 트랙을 낮고 느리게 늘어뜨려 붕괴음으로 쓴다.
    playSfx(this.scene, AUDIO.bossSlam, { detune: -300, rate: 0.7 });

    sprite.setVelocity(0, 0);
    sprite.clearTint();
    // 런의 마지막 타격이다. 시간이 잠깐 멎고, 화면이 하얗게 번쩍이며, 재가 오래 떠오른다.
    hitStop(this.scene, 300);
    pulseGlitchFx(this.scene, 1, 900);
    const cam = this.scene.cameras.main;
    cam.shake(320, 0.012);
    cam.flash(260, 255, 235, 220);
    const baseZoom = cam.zoom;
    cam.zoomTo(baseZoom * 1.1, 220, "Sine.easeOut");
    this.scene.time.delayedCall(420, () => cam.zoomTo(baseZoom, 380, "Sine.easeInOut"));

    // 붕괴 시퀀스를 먼저 재생한다 — 무릎 꿇고, 그림자로 무너지고, 가면만 남았다 꺼진다.
    // 끝난 뒤에야 재 상승 이펙트와 최종 축소 트윈이 이어받는다.
    this.setPose(BOSS_FRAME.death);
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      deathBurst(this.scene, sprite.x, sprite.y, SILHOUETTE.boss);
      ashRise(this.scene, sprite.x, sprite.y - 30, SILHOUETTE.boss);
      ashRise(this.scene, sprite.x, sprite.y + 30, 0xff2a3a);
      bossGroundSpikeFx(this.scene, sprite.x, this.arena.bounds.floorY - 6, VFX_SCALE);

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
    this.hpFrame?.destroy();
    this.hpNameText?.destroy();
    this.hpTitleText?.destroy();
    this.hpValueText?.destroy();
    this.hpBarBack = null;
    this.hpBarFill = null;
    this.hpFrame = null;
    this.hpNameText = null;
    this.hpTitleText = null;
    this.hpValueText = null;
    this.followHitbox = null;
    this.sprite?.destroy();
    this.sprite = null;
    // 사망 연출 도중 씬이 내려가도 결과 화면으로 넘어가야 한다.
    if (this.defeated) this.notifyDefeat();
  }

  // ────────────────────────────── 연출과 유틸 ──────────────────────────────

  /**
   * 예고 표시. 피해가 나가기 전에 반드시 이걸 먼저 띄운다. (DEC-004)
   * 사각 위험구역 스프라이트(bossTelegraphBoxFx)로 그린다 — VFX가 수명을
   * 스스로 관리하므로 보스가 죽어도 알아서 사라진다.
   */
  private showTelegraph(
    x: number,
    y: number,
    width: number,
    height: number,
    durationMs: number,
  ): void {
    bossTelegraphBoxFx(this.scene, x, y, width, height, durationMs);
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
    // 텍스처가 패턴마다 갈리므로(스킬 이펙트와 같은 방식) 고정 키가 아니라
    // 스프라이트가 지금 물고 있는 텍스처를 그대로 복제해야 잔상이 맞는 그림을 쓴다.
    const ghost = this.scene.add.image(sprite.x, sprite.y, sprite.texture.key, sprite.frame.name);
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

  /**
   * 장식 프레임(`ui/boss-hp-frame.png`) 위에 이름·부제·게이지를 얹는다.
   * 프레임을 원점(0.5, 0)으로 중앙 상단에 두고, 나머지는 전부 프레임 크기에 대한
   * 비율(`HP_BAR`)로 계산한다 — 화면 크기가 바뀌어도 프레임 안 자리가 안 어긋난다.
   * `widthRatio`를 플레이어 체력바(화면 왼쪽 위, ~24% 지점)보다 확실히 좁혀 겹치지 않는다.
   */
  private createHpBar(): void {
    const { width } = this.arena.bounds;
    const frameWidth = width * HP_BAR.widthRatio;
    const frameHeight = frameWidth / HP_BAR.frameAspect;
    const frameLeft = (width - frameWidth) / 2;
    const frameTop = HP_BAR.topMargin;
    const centerX = width / 2;

    const barLeft = frameLeft + HP_BAR.window.left * frameWidth;
    const barWidth = (HP_BAR.window.right - HP_BAR.window.left) * frameWidth;
    const barY = frameTop + HP_BAR.window.centerY * frameHeight;
    const barHeight = HP_BAR.window.height * frameHeight;

    // 어둡게 비운 자리와 밝은 채움이 확실히 갈라져야 한눈에 읽힌다 — 색 대비를 키웠다.
    this.hpBarBack = this.scene.add
      .image(barLeft, barY, TEXTURE.solid)
      .setOrigin(0, 0.5)
      .setDisplaySize(barWidth, barHeight)
      .setTint(0x140508)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud);

    // fill이 보스 텍스처로 잡혀 있던 버그 — 보스 그림 한 장이 바 폭으로 늘어나 있었다.
    this.hpBarFill = this.scene.add
      .image(barLeft, barY, TEXTURE.solid)
      .setOrigin(0, 0.5)
      .setDisplaySize(barWidth, barHeight)
      .setTint(0xff2438)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 1);

    // 프레임을 게이지 위에 얹는다 — 테두리·가시 장식이 채움 막대 위로 겹쳐 그려져야 깔끔하다.
    this.hpFrame = this.scene.add
      .image(centerX, frameTop, TEXTURE.bossHpFrame)
      .setOrigin(0.5, 0)
      .setDisplaySize(frameWidth, frameHeight)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 2);

    // 수치까지 찍어야 "얼마나 남았는지"가 색만으로 안 헷갈린다.
    // 채움 막대(barLeft/barY)가 아니라 구멍 중심에 놓는다 — 위 `hole` 주석 참고.
    this.hpValueText = this.scene.add
      .text(
        frameLeft + HP_BAR.hole.centerX * frameWidth,
        frameTop + HP_BAR.hole.centerY * frameHeight,
        "",
        {
          fontFamily: `${neoDunggeunmo.style.fontFamily}, sans-serif`,
          fontSize: "12px",
          fontStyle: "bold",
          color: "#fff5f0",
          stroke: "#2a0508",
          strokeThickness: 3,
          resolution: 2,
        },
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 3);

    this.hpNameText = this.scene.add
      .text(centerX, frameTop + HP_BAR.nameY * frameHeight, BOSS_NAME, {
        fontFamily: `${neoDunggeunmo.style.fontFamily}, sans-serif`,
        fontSize: "18px",
        fontStyle: "bold",
        color: "#f3dfe3",
        resolution: 2,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 3);

    this.hpTitleText = this.scene.add
      .text(centerX, frameTop + HP_BAR.titleY * frameHeight, BOSS_TITLE, {
        fontFamily: `${neoDunggeunmo.style.fontFamily}, sans-serif`,
        fontSize: "9px",
        color: "rgba(243, 223, 227, 0.75)",
        resolution: 2,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH.hud + 3);

    this.refreshHpBar();
  }

  private refreshHpBar(): void {
    const fill = this.hpBarFill;
    if (!fill) return;

    const frameWidth = this.arena.bounds.width * HP_BAR.widthRatio;
    const barWidth = (HP_BAR.window.right - HP_BAR.window.left) * frameWidth;
    this.tweens.push(
      this.scene.tweens.add({
        targets: fill,
        displayWidth: barWidth * Math.max(0, this.hp / this.maxHp),
        duration: FEEDBACK.hpBarTweenMs,
      }),
    );
    this.hpValueText?.setText(`${Math.max(0, this.hp)} / ${this.maxHp}`);
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
    if (this.sprite?.active) this.sprite.setScale(BOSS_SPRITE_SCALE);
    this.timers = [];
    this.tweens = [];
    this.ephemera = [];
  }
}
