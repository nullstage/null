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
import { ENGRAVING_EFFECT } from "../data/engravings";
import { hasEngraving } from "../systems/Engravings";
import { KEY_BINDINGS, type GameAction } from "../config/inputConfig";
import {
  ashRise,
  BEAM_WINDUP_MS,
  beamLine,
  bladeVortexBurst,
  clearParryGuard,
  createBulletTrail,
  deathBurst,
  groundDust,
  groundEruptionBurst,
  hitBurst,
  hitStop,
  MOON_SHADOW_SKEW,
  muzzleFlash,
  parryGuard,
  perfectParryBurst,
  pulseHitFx,
  rangedSpark,
  slashArc,
  slashFlash,
  spikeBurst,
  swordWaveTrail,
} from "../systems/CombatVfx";
import { playSfx, startFootsteps, stopFootsteps } from "../systems/audio";
import type { CombatTelemetryRecorder } from "../systems/CombatTelemetry";
import {
  AUDIO,
  MELEE_ANIM_BY_STEP,
  PLAYER_INTRO_ANIM,
  PLAYER_SPRITE,
  RANGED_ANIM_BY_STEP,
  SILHOUETTE,
  TEXTURE,
  comboAnim,
  playerAnimKey,
  type CombatArena,
  type PlayerAnimState,
} from "../types/combat";
import type { AttackMode, UpgradeElement, UpgradeId } from "../types/game";

/**
 * 도트 확대 배율. 64px 셀을 화면에서 이 배수로 키운다.
 *
 * 셀 안 캐릭터 키가 52px이라, 1.2배면 화면에서 62px가 된다.
 * 이전 시트(48px 셀·캐릭터 40px·1.6배)와 같은 크기라 방 배치를 다시 잡지 않아도 된다.
 */
const SPRITE_SCALE = 1.2;

/** 기상 인트로 길이(ms). 4프레임 × 5fps = 800ms에 여유를 더한 값. */
const INTRO_MS = 900;

/**
 * 연사 단계별 총 이펙트 세기. 검의 1·2·3타처럼 총도 단계마다 달라야 한다.
 * 1·2발은 가볍게 흘리고, 마무리(3발째)만 확실히 크게 — 매번 똑같이 나가면
 * "3연사"가 아니라 "같은 총알 세 번"으로 읽힌다는 지적을 반영했다.
 */
const RANGED_POWER_BY_STEP = [0.75, 1.15, 2.1] as const;

/** 연사 단계별 피치(센트). 서서히 낮아져 마무리로 갈수록 무거워지는 느낌을 준다. */
const RANGED_DETUNE_BY_STEP = [550, 260, 0] as const;

/** 반동 직후 이동 입력이 속도를 덮어쓰지 않는 시간(ms). 근접 돌진 판정과 같은 방식. */
const RANGED_RECOIL_WINDOW_MS = 110;

/**
 * 패링. S를 누른 순간부터 `PARRY_PERFECT_MS` 안에 맞으면 완전 무효화 + 반사,
 * 그 뒤 `PARRY_ACTIVE_MS`까지는 일반 막기(피해만 크게 깎는다)로 넘어간다.
 * 완전 무효화 구간을 짧게 잡아야 "아무 때나 누르면 다 막힌다"가 되지 않는다.
 */
const PARRY_PERFECT_MS = 160;
const PARRY_ACTIVE_MS = 340;
const PARRY_COOLDOWN_MS = 900;
/** 퍼펙트를 놓치고 일반 막기로만 받아냈을 때 남는 피해 비율. */
const PARRY_BLOCK_DAMAGE_RATIO = 0.25;

/** 원거리 모드 표시색. 곱연산이라 흰색에 가까울수록 원본이 살아 있다. */
const RANGED_MODE_TINT = 0xffc9d4;

/** gameBalance로 옮겨야 할 임시 수치. 확정 전까지 여기서만 관리한다. */
export const TUNING = {
  /**
   * 충돌 바디 크기. 그림 전체가 아니라 몸통만 잡는다.
   *
   * 높이는 그림 속 캐릭터 키에 맞춘다. 프레임 높이(48)에 맞추면 바디 바닥이
   * 발끝보다 아래로 내려가, 캐릭터가 지면에서 떠 있는 것처럼 보인다.
   */
  body: { width: 26, height: 40 },

  melee: {
    /** 적 hp 24~30 기준 3~4방. MVP_PLAN §12 밸런스 목표에 맞춘 시작값이다. */
    damage: 10,
    /** 3타째는 마무리 타격이라 조금 더 세다. */
    finisherDamageMultiplier: 1.4,
    hitboxLifeMs: 90,
    /** 이 시간 안에 다시 치면 콤보가 이어진다. */
    comboWindowMs: 520,
    /**
     * 사거리. 검을 크게 휘두르는 그림에 맞춰 넓게 잡는다.
     *
     * 그림만 키우고 이 값을 두면 닿아 보이는데 안 맞는 일이 생긴다.
     * 사거리가 늘어도 피해량과 적 체력은 그대로라 소프트 카운터는 유지된다. (DEC-004)
     */
    reach: 54,
    finisherReach: 78,
    hitboxHeight: 46,
    /** MELEE_FINISHER_RANGE_UP이 마무리 타격에만 더해주는 사거리 */
    finisherRangeBonus: 24,

    /**
     * 벨 때 몸이 앞으로 밀려나가는 속도.
     *
     * 제자리에서 팔만 흔들면 아무리 그림이 좋아도 정적으로 보인다.
     * 몸이 검을 따라가야 무게가 실린다. 마무리 타격은 더 크게 파고든다.
     */
    lungeSpeed: 260,
    finisherLungeMultiplier: 1.6,
    /** 파고든 뒤 멈추는 데 걸리는 시간. 길면 미끄러지고 짧으면 안 보인다. */
    lungeMs: 130,
    /** 파고드는 동안 프레임마다 남는 속도 비율 */
    lungeDrag: 0.86,
    /** 공중에서 벨 때 낙하 속도에 곱하는 값. 낮을수록 오래 머문다. */
    airHangFactor: 0.3,
  },

  ranged: {
    damage: 8,
    /**
     * 총알은 눈으로 좇는 것이 아니라 지나간 자국으로 읽는다.
     * 느리면 피할 수 있는 투사체처럼 보여서, 쏜 순간 도달한 것처럼 빠르게 보낸다.
     * 1500이면 화면 하나(1280px)를 가로지르는 데 0.85초가 걸려 총이라기엔 굼떴다.
     */
    speed: 3200,
    width: 10,
    height: 6,
    /** 빨라진 만큼 화면을 금방 벗어난다. 수명은 화면 밖 정리로 충분하다. */
    lifeMs: 1200,
    /** RANGED_PIERCE가 없을 때 관통 0명 = 최대 1명 적중 */
    baseMaxHits: 1,
    pierceBonusHits: 1,
    /** 반동으로 뒤로 밀리는 속도 */
    recoil: 70,
    /** 이 시간 안에 다시 쏘면 연사가 이어진다. 끊기면 1발째 자세로 돌아간다. */
    burstWindowMs: 900,
    /** 탄창. 이만큼 쏘면 자동 재장전 — 무한 연사 대신 쏘는 리듬에 틈을 만든다. */
    magazineSize: 6,
    reloadMs: 1100,
    /** 최대 사거리(px). 조준선도 여기까지만 그어진다 — 화면 끝까지 무한히 닿지 않는다. */
    maxRangePx: 560,
  },

  dash: {
    durationMs: 150,
    /** 공중 대시가 받는 중력 비율. 0이면 일자로 날아 딱딱하다. */
    airGravityScale: 0.6,
    /**
     * 공중 대시 시작에 실어 주는 상승 속도.
     * 중력만으로는 150ms 동안 5px밖에 안 휘어 직선으로 보인다.
     * 살짝 띄웠다 떨어뜨려야 호가 눈에 들어온다.
     */
    airLiftVelocity: 230,
    /** 충전 하나가 다시 차는 데 걸리는 시간 */
    rechargeMs: 900,
  },

  upgrade: {
    /** 무기 자체를 바꾸는 강화. 다른 강화보다 폭이 크고, 궤적 모양까지 함께 바뀐다. */
    bladeDamageMultiplier: 1.35,
    bladeReachBonus: 14,
    barrelDamageMultiplier: 1.4,
    barrelSpeedMultiplier: 1.25,

    meleeDamageMultiplier: 1.2,
    rangedCooldownMultiplier: 0.8,
    dashFollowupMultiplier: 1.5,
    /** 대시 후 이 시간 안의 첫 공격만 보너스를 받는다. */
    dashFollowupWindowMs: 600,
    dashChargeBonus: 1,
    dashCooldownMultiplier: 0.75,
    dashInvulnBonusMs: 120,

    bladeSizeReachBonus: 18,
    bulletSizeMultiplier: 1.6,

    healthMaxBonus: 20,
    healthRegenAmount: 12,
    /** 내구 강화 — 받는 피해에 곱한다. */
    armorDamageMultiplier: 0.85,
    /** 이름 없는 낯 — 피격 직후 무적 시간(PLAYER.invulnerabilityMs)에 더한다. */
    maskInvulnBonusMs: 250,
    /** 분노한 칼날 — 이 체력 비율 이하에서 근접 공격력에 곱한다. */
    berserkHpRatio: 0.3,
    berserkDamageMultiplier: 1.25,
    /** 사냥꾼의 리볼버 — 재장전 직후 첫 발의 피해에 곱한다. */
    reloadBurstMultiplier: 1.5,
    /** 멈추지 않는 심장 — 근접 적중마다 이 확률로 체력을 회복한다. */
    vampireChance: 0.15,
    vampireHeal: 1,

    /** 화염 — 적중 후 이 간격으로 이 횟수만큼 화상 틱이 들어간다. */
    fireTickDamage: 3,
    fireTickCount: 3,
    fireTickIntervalMs: 400,
    /** 냉기 — 적중한 대상의 이동 속도를 이 배율로, 이 시간만큼 낮춘다. */
    frostSlowFactor: 0.4,
    frostSlowMs: 900,
    /** 맹독 — 화상보다 약한 틱이 더 오래 들어간다. 총합은 화염과 비슷하게 맞춘다. */
    poisonTickDamage: 2,
    poisonTickCount: 6,
    poisonTickIntervalMs: 450,
    /** 확장 탄창 — 탄창 최대치에 더한다. */
    magazineBonus: 3,

    /** 검기 — Q 스킬로 발동하는 참격 투사체. */
    swordWaveDamageMultiplier: 0.6,
    /** 검기 스킬 재사용 대기시간과 스킬 보정(수동 발동이라 3타 자동보다 세다). */
    swordWaveSkillCooldownMs: 4000,
    swordWaveSkillDamageBonus: 1.5,

    /** 검극(劍棘) — 전방 바닥에서 연쇄로 솟구치는 검의 가시. */
    eruptionCooldownMs: 6000,
    eruptionDamageMultiplier: 1.2,
    eruptionCount: 4,
    eruptionStepPx: 92,
    eruptionIntervalMs: 90,

    /** 검무(劍舞) — 주위 전방위를 베는 검의 폭풍. */
    cycloneCooldownMs: 8000,
    cycloneDamageMultiplier: 1.6,
    cycloneActiveMs: 220,
    cycloneRadiusPx: 115,
    swordWaveSpeed: 640,
    swordWaveWidth: 40,
    swordWaveHeight: 46,
    swordWaveLifeMs: 500,
  },

  /** 공중에서 입력이 없을 때 수평 속도가 줄어드는 비율(프레임당). 1이면 영원히 날아간다. */
  airDragPerFrame: 0.94,

  /**
   * 이 세로 속도를 넘어야 "떠 있다"로 본다.
   *
   * 바닥을 걷는 동안에도 중력 때문에 아주 작은 세로 속도가 남는다.
   * 0으로 두면 걷다가 점프 그림이 끼어들어 걷기가 끊긴다.
   */
  airborneVelocityY: 60,

  /** 달릴 때 발밑 먼지가 튀는 간격. */
  runDustIntervalMs: 220,

  /**
   * 공격 그림의 이 지점을 넘기면 이동 입력으로 끊을 수 있다.
   *
   * 끝까지 묶어두면 이미 걷고 있는데도 공격 자세가 남아 조작이 굼떠 보인다.
   * 반대로 너무 이르면 휘두르다 마는 그림이 된다. 타격이 끝난 뒤쯤이 적당하다.
   */
  animCancelRatio: 0.55,

  /** 피격 시 뒤로 밀린다. 연타로 갇히지 않게 하는 안전장치이기도 하다. */
  knockback: { x: 220, y: -180 },

  feedback: {
    flashMs: 90,
    punchMs: 70,
    punchScale: 1.16,
    blinkMs: 90,
    /** 잔상 간격. 촘촘할수록 빠르게 지나간 것처럼 보인다. */
    afterimageIntervalMs: 16,
    afterimageFadeMs: 150,
    afterimageAlpha: 0.3,
    /** 잔상이 진행 반대로 밀리는 거리. 몸이 앞서 나간 느낌을 만든다. */
    afterimageDriftPx: 16,
    afterimageStretch: 1.2,
    deathMs: 320,
    /** 때린 순간의 흔들림. 너무 약하면 맞았는지 화면만 봐선 모른다. */
    hitShakeMs: 110,
    hitShakeIntensity: 0.008,
    damageShakeMs: 160,
    damageShakeIntensity: 0.01,
    /** 착지 무게감. 전투 흔들림보다 약해야 한다 — 평범한 이동이지 피격이 아니다. */
    landShakeMs: 70,
    landShakeIntensity: 0.004,
  },

  /** 플레이어가 항상 위에 보여야 한다. 도형이라 겹치면 구분이 안 된다. */
  depth: { player: 10, attack: 9, afterimage: 8, shadow: 2 },

  /**
   * 발밑 그림자. 바닥에 고정된 채 x만 따라가고, 뜬 높이에 따라 작아지고 옅어진다.
   * 공중에 있다는 걸 그림자만 보고도 알 수 있어야 한다.
   */
  shadow: {
    width: 24,
    height: 8,
    color: 0x000000,
    maxAlpha: 0.4,
    /** 이 높이(px)에서 가장 작고 옅어진다. 점프 최고점(~96px)보다 살짝 넉넉하게 잡는다. */
    maxHeight: 140,
    minScale: 0.45,
  },
} as const;

const MOVE_ACTIONS = [
  "MOVE_LEFT",
  "MOVE_RIGHT",
  "JUMP",
  "DASH",
  "ATTACK",
  "SWITCH_MODE",
  "PARRY",
  "SKILL",
  "SKILL_2",
  "SKILL_3",
] as const satisfies readonly GameAction[];

type PlayerAction = (typeof MOVE_ACTIONS)[number];

/** 스킬 아티팩트 ↔ 키 슬롯. 새 스킬은 여기에 한 줄 추가하면 HUD 표시까지 따라온다. */
const SKILL_SLOTS: readonly { id: UpgradeId; action: GameAction }[] = [
  { id: "MELEE_SWORD_WAVE", action: "SKILL" },
  { id: "MELEE_SPIKE_ERUPTION", action: "SKILL_2" },
  { id: "MELEE_BLADE_CYCLONE", action: "SKILL_3" },
];

export interface PlayerDeps {
  scene: Phaser.Scene;
  /** 지형과 공격체 그룹. 만든 히트박스·투사체는 `arena.playerAttacks`에 넣는다. */
  arena: CombatArena;
  telemetry: CombatTelemetryRecorder;
  /** 획득한 강화 목록. 효과 적용은 전투 담당이 한다. */
  upgrades: readonly UpgradeId[];
  /** 그림자 조각 잔액. HUD 표시용 — Player가 RunState를 직접 참조하지 않게 함수로 받는다. */
  getShards: () => number;
  onDamaged: (amount: number) => void;
  onDeath: () => void;
}

export class Player {
  readonly scene: Phaser.Scene;
  private readonly telemetry: CombatTelemetryRecorder;
  private readonly deps: PlayerDeps;

  sprite: Phaser.Physics.Arcade.Sprite | null = null;
  private shadow: Phaser.GameObjects.Ellipse | null = null;

  mode: AttackMode = "MELEE";
  hp: number = PLAYER.maxHp;
  /** HEALTH_MAX_UP으로 늘어날 수 있다. 씬이 RunState.maxHp와 함께 동기화한다. */
  maxHp: number = PLAYER.maxHp;
  isGrounded = true;
  isDashing = false;
  isDead = false;
  /**
   * 점프 자세를 유지 중인지. 세로 속도만 보고 매 프레임 판단하면 정점(속도가 0에
   * 가까워지는 순간)에서 잠깐 "공중 아님"으로 오판해 자세가 풀렸다 다시 걸린다.
   * 그래서 한 번 들어가면 착지할 때까지는 속도와 무관하게 붙잡아 둔다(syncAnim 참고).
   */
  private isJumpAnimating = false;
  /** 달리는 동안만 재생되는 루프 발소리. 멈추거나 죽으면 정지한다. */
  private footsteps: Phaser.Sound.BaseSound | null = null;
  private nextRunDustAtMs = 0;
  /** 기상 인트로가 끝나는 시각. 그때까지는 입력을 받지 않는다. */
  private introUntilMs = 0;
  /** 진행 중인 스케일 펀치. 대시 시작 때 걷어내려고 들고 있는다. */
  private punchTween: Phaser.Tweens.Tween | null = null;
  /** 지금 대시가 지상 대시인지. 지상 대시만 세로 속도를 눌러 수평을 유지한다. */
  private dashGrounded = false;

  private keys: Partial<Record<PlayerAction, Phaser.Input.Keyboard.Key>> = {};
  private facing: 1 | -1 = 1;
  private baseScale = { x: 1, y: 1 };

  private nextAttackAtMs = 0;
  private comboStep = 0;
  private comboExpiresAtMs = 0;

  /**
   * 사격 단계(1~3). 근접 콤보와 따로 센다.
   *
   * 총은 맞히는 순서가 아니라 연사 리듬이라, 창이 끊기면 다시 1발째 자세로 돌아간다.
   */
  private rangedStep = 0;
  private rangedComboExpiresAtMs = 0;

  /** 남은 탄. 다 쓰면 자동 재장전이 돌고, 그동안은 쏘지 못한다. */
  // `as const` 탓에 초기값 그대로 두면 리터럴 타입(6)으로 좁혀진다.
  private ammo: number = TUNING.ranged.magazineSize;
  private reloadingUntilMs = 0;
  /** 사냥꾼의 리볼버 — 재장전이 막 끝났는지. 다음 한 발에만 보너스를 주고 곧바로 꺼진다. */
  private freshReload = false;

  private dashCharges: number = PLAYER.dashCharges;
  private dashEndsAtMs = 0;
  private dashRechargeAtMs = 0;
  private dashFollowupUntilMs = 0;
  private lastAfterimageAtMs = 0;

  /** 공격으로 파고드는 중이면 이 시각까지 이동 입력이 속도를 덮지 않는다. */
  private lungeUntilMs = 0;

  /** 액티브 스킬들의 재사용 대기 시각. 해당 아티팩트를 갖고 있어야만 발동된다. */
  private skillCooldownUntil: Partial<Record<UpgradeId, number>> = {};

  /** 공격 애니메이션이 끝나는 시각. 그 전에는 다른 상태가 끼어들지 못한다. */
  private attackAnimUntilMs = 0;
  /** 이 시각을 넘기면 이동 입력으로 공격 그림을 끊을 수 있다. */
  private animCancelAtMs = 0;
  private invulnerableUntilMs = 0;

  /** 지금 방어 자세인지. 방어 창(perfect+normal) 동안 true. */
  private parrying = false;
  private parryStartedAtMs = 0;
  private parryEndsAtMs = 0;
  private parryCooldownUntilMs = 0;
  private parryGuardFx: Phaser.GameObjects.Container | null = null;
  private blinkTween: Phaser.Tweens.Tween | null = null;

  /**
   * 내가 쏜 투사체와 그 꼬리. 화면 밖 정리와 관통 판정에 쓴다.
   *
   * 꼬리를 투사체의 `setData`에 얹으면 안 된다.
   * 씬이 적중한 탄을 `destroy()`할 때 Phaser가 그 오브젝트의 data까지 함께 지워,
   * 다음 프레임에 꼬리를 찾지 못하고 화면에 영원히 남는다.
   */
  private projectiles: {
    body: Phaser.Physics.Arcade.Image;
    trail: Phaser.GameObjects.Graphics;
  }[] = [];

  /** 씬이 넘겨준 마지막 HUD 값. 내부 갱신에서 0으로 덮어쓰지 않기 위한 것이다. */
  private lastEnemiesRemaining = 0;
  private lastRoomIndex = 0;

  constructor(deps: PlayerDeps) {
    this.deps = deps;
    this.scene = deps.scene;
    this.telemetry = deps.telemetry;
    this.dashCharges = this.maxDashCharges;
    // 확장 탄창을 가졌으면 시작부터 가득 채워 준다.
    this.ammo = this.maxMagazineSize;
  }

  // ────────────────────────────── 수명 주기 ──────────────────────────────

  /** 방 시작 시 호출된다. */
  spawn(x: number, y: number): void {
    const { body, depth, shadow } = TUNING;

    this.shadow = this.scene.add.ellipse(
      x,
      this.deps.arena.bounds.floorY,
      shadow.width,
      shadow.height,
      shadow.color,
      shadow.maxAlpha,
    );
    this.shadow.setDepth(depth.shadow);

    const sprite = this.scene.physics.add.sprite(x, y, PLAYER_SPRITE.key);
    // 도트는 정수 배율로만 키운다. 소수 배율은 픽셀 격자를 무너뜨린다.
    sprite.setScale(SPRITE_SCALE);
    sprite.setDepth(depth.player);
    sprite.setCollideWorldBounds(true);
    // 그림에는 망토와 검이 넓게 퍼져 있다. 충돌 판정은 몸통만 잡아야 억울한 피격이 없다.
    sprite.body.setSize(body.width, body.height);
    // 바디 바닥을 그림의 발끝(footY)에 맞춘다. 프레임 아래 여백만큼 뜨는 것을 막는다.
    sprite.body.setOffset(
      (PLAYER_SPRITE.frameWidth - body.width) / 2,
      PLAYER_SPRITE.footY - body.height,
    );
    this.baseScale = { x: sprite.scaleX, y: sprite.scaleY };
    this.sprite = sprite;
    this.playAnim("idle");

    // 도트 윤곽이 어두운 배경 위에서 너무 또렷해 혼자 붙여넣은 것처럼 보인다는 지적 —
    // 적과 같은 계열의 옅은 글로우를 둘러 조명(붉은 앰비언트) 속에 섞는다. (WebGL 전용)
    if (this.scene.game.renderer.type === Phaser.WEBGL) {
      sprite.postFX.addGlow(0xff7a66, 1.5, 0);
    }

    // 씬은 적 충돌만 걸어준다. 플레이어가 바닥을 밟는 건 플레이어 책임이다.
    this.scene.physics.add.collider(sprite, this.deps.arena.solids);

    this.bindKeys();
    this.applyModeTint();
    this.emitHud();
  }

  /**
   * 기상 인트로. 앉아 있다가 일어나는 4프레임을 한 번 재생하고 idle로 넘긴다.
   * 재생 중에는 조작을 막는다 — 연출 도중에 걸어 나가면 일어나다 만 모양이 된다.
   */
  playIntro(): void {
    const sprite = this.sprite;
    if (!sprite) return;

    this.introUntilMs = this.scene.time.now + INTRO_MS;
    sprite.play(PLAYER_INTRO_ANIM);
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      this.introUntilMs = 0;
      this.playAnim("idle", true);
    });
  }

  /** 씬의 update에서 매 프레임 호출된다. */
  update(time: number, _deltaMs: number): void {
    const sprite = this.sprite;
    if (!sprite?.body) return;
    const body = sprite.body as Phaser.Physics.Arcade.Body;

    const wasGrounded = this.isGrounded;
    this.isGrounded = body.blocked.down || body.touching.down;
    this.updateShadow(sprite, body);
    this.cullProjectiles(time);
    if (this.isDead) return;

    // 기상 연출 중에는 조작도 애니메이션 갱신도 하지 않는다.
    if (time < this.introUntilMs) {
      body.setVelocityX(0);
      return;
    }

    // 공중이었다가 막 닿은 프레임만 착지다. 서 있는 동안 매 프레임 걸리면 안 된다.
    if (!wasGrounded && this.isGrounded) this.onLand(sprite, body);

    if (this.isDashing) {
      // 지상 대시의 수평 유지. 중력은 켜 둔 채(바닥 분리가 계속 돌게) 세로 속도만
      // 지운다 — 다음 프레임에 중력이 한 틱만큼만 붙어 바닥을 계속 눌러준다.
      if (this.dashGrounded) body.setVelocityY(0);
      this.trailAfterimage(time);
      if (time >= this.dashEndsAtMs) this.endDash();
      return;
    }

    if (this.dashCharges < this.maxDashCharges && time >= this.dashRechargeAtMs) {
      this.dashCharges += 1;
      this.dashRechargeAtMs =
        time +
        TUNING.dash.rechargeMs *
          (this.hasUpgrade("DASH_COOLDOWN_DOWN") ? TUNING.upgrade.dashCooldownMultiplier : 1);
    }

    // 대시가 끝나도 관성으로 계속 날아간다. 그 구간에도 잔상을 이어야 궤적이 안 끊긴다.
    if (Math.abs(body.velocity.x) > PLAYER.moveSpeed * 1.15) this.trailAfterimage(time);

    const direction =
      (this.keys.MOVE_RIGHT?.isDown ? 1 : 0) - (this.keys.MOVE_LEFT?.isDown ? 1 : 0);
    if (this.isGrounded && time < this.lungeUntilMs) {
      // 벤 기세로 파고드는 중이다. 여기서 이동 입력이 속도를 덮으면 몸이 그 자리에 멈춰
      // 팔만 흔드는 그림이 된다. 잠깐은 관성을 살려 둔다.
      body.setVelocityX(body.velocity.x * TUNING.melee.lungeDrag);
    } else if (this.isGrounded) {
      body.setVelocityX(direction * PLAYER.moveSpeed);
    } else if (direction !== 0 && Math.sign(body.velocity.x) === direction &&
               Math.abs(body.velocity.x) > PLAYER.moveSpeed) {
      // 대시 관성이 이동 속도보다 빠른데 같은 방향을 누르고 있다.
      // 여기서 moveSpeed로 덮어쓰면 속도가 뚝 떨어져 대시가 끊긴 것처럼 보인다.
      body.setVelocityX(body.velocity.x * TUNING.airDragPerFrame);
    } else if (direction !== 0) {
      // 반대로 꺾거나 이미 느려졌으면 조작을 그대로 받는다. 공중 제어권은 남겨야 한다.
      body.setVelocityX(direction * PLAYER.moveSpeed);
    } else {
      // 손을 떼면 서서히 죽는다. 즉시 0으로 만들면 포물선이 끊긴다.
      body.setVelocityX(body.velocity.x * TUNING.airDragPerFrame);
    }
    if (direction !== 0) {
      this.facing = direction > 0 ? 1 : -1;
      sprite.setFlipX(this.facing < 0);
    }

    if (this.justPressed("JUMP") && this.isGrounded) this.jump();
    if (this.justPressed("DASH")) this.dash();
    if (this.justPressed("ATTACK")) this.attack();
    if (this.justPressed("SWITCH_MODE")) this.switchMode();
    if (this.justPressed("PARRY")) this.parry();
    if (this.justPressed("SKILL")) this.castSwordWave();
    if (this.justPressed("SKILL_2")) this.castSpikeEruption();
    if (this.justPressed("SKILL_3")) this.castBladeCyclone();

    if (this.parrying) {
      if (time >= this.parryEndsAtMs) this.endParry();
      else this.parryGuardFx?.setPosition(sprite.x, sprite.y).setScale(this.facing, 1);
    }

    this.syncAnim();
  }

  destroy(): void {
    if (this.footsteps) stopFootsteps(this.footsteps);
    this.footsteps = null;
    this.parryGuardFx?.destroy();
    this.parryGuardFx = null;
    this.blinkTween?.remove();
    this.blinkTween = null;
    for (const { body, trail } of this.projectiles) {
      trail.destroy();
      body.destroy();
    }
    this.projectiles = [];
    this.sprite?.destroy();
    this.sprite = null;
    this.shadow?.destroy();
    this.shadow = null;
    this.keys = {};
  }

  /**
   * 그림자를 바닥에 고정한 채 x만 따라가게 하고, 뜬 높이만큼 작고 옅게 만든다.
   * 발판 위·바닥 위 구분 없이 항상 `floorY`에 그린다 — 발판 그림자까지 다루기엔
   * 지금 이 방 템플릿엔 중간 발판이 없다.
   */
  private updateShadow(sprite: Phaser.Physics.Arcade.Sprite, body: Phaser.Physics.Arcade.Body): void {
    if (!this.shadow) return;
    const { shadow } = TUNING;

    const height = Math.max(0, this.deps.arena.bounds.floorY - body.bottom);
    const t = Phaser.Math.Clamp(height / shadow.maxHeight, 0, 1);
    const scale = Phaser.Math.Linear(1, shadow.minScale, t);

    // 달빛 사광 — 높이 뜬 만큼 그림자가 입사각 방향으로 비껴 눕는다(플랫폼 그림자와 동일 각).
    this.shadow.setPosition(sprite.x + height * MOON_SHADOW_SKEW, this.deps.arena.bounds.floorY);
    this.shadow.setScale(scale);
    this.shadow.setAlpha(shadow.maxAlpha * (1 - t * 0.7));
  }

  // ────────────────────────────── 이동 ──────────────────────────────

  private jump(): void {
    const sprite = this.sprite;
    const body = sprite?.body as Phaser.Physics.Arcade.Body | undefined;
    if (!sprite || !body) return;
    groundDust(this.scene, sprite.x, body.bottom, "jump");
    body.setVelocityY(-PLAYER.jumpVelocity);
    // 스프라이트가 없던 시절 도형을 늘려 도약을 표현하던 펀치. 지금은 웅크린 자세
    // 프레임(jump: frames 1)을 그대로 쓰는데, 이 스쿼시가 늘었다 돌아오며(yoyo)
    // "다리를 굽혔다 편다"는 별개의 움직임처럼 겹쳐 보인다는 지적으로 없앤다.
  }

  /** 공중에서 막 바닥에 닿은 프레임에만 부른다. */
  private onLand(sprite: Phaser.Physics.Arcade.Sprite, body: Phaser.Physics.Arcade.Body): void {
    groundDust(this.scene, sprite.x, body.bottom, "land");
    /**
     * 착지 스쿼시를 `punch()`(스프라이트 scaleY 트윈)로 만들면 안 된다.
     * Phaser Arcade Body는 매 프레임 `sourceHeight * scaleY`로 충돌 박스 높이를,
     * `offset.y * scaleY`로 위치를 다시 계산한다(`Body.updateFromGameObject`).
     * 접지 상태에서 scaleY를 순간적으로 줄이면 박스 바닥이 바닥면 위로 살짝 뜨고,
     * 다음 프레임 중력이 그 틈만큼 다시 끌어내려 "착지 직후 훅 꺼지는" 것처럼 보였다.
     * 물리에 관여하지 않는 카메라 흔들림으로만 무게감을 준다.
     */
    this.scene.cameras.main.shake(
      TUNING.feedback.landShakeMs,
      TUNING.feedback.landShakeIntensity,
    );
  }

  dash(): void {
    const sprite = this.sprite;
    const body = sprite?.body as Phaser.Physics.Arcade.Body | undefined;
    if (!sprite || !body || this.isDashing || this.dashCharges <= 0) return;

    const now = this.scene.time.now;
    const rechargeMs =
      TUNING.dash.rechargeMs *
      (this.hasUpgrade("DASH_COOLDOWN_DOWN") ? TUNING.upgrade.dashCooldownMultiplier : 1);
    this.dashCharges -= 1;
    // 충전이 가득 찼다가 처음 빠진 순간부터 재충전 타이머를 돌린다.
    if (this.dashRechargeAtMs <= now) this.dashRechargeAtMs = now + rechargeMs;

    this.telemetry.recordDash();
    playSfx(this.scene, AUDIO.dash);

    this.isDashing = true;
    this.dashEndsAtMs = now + TUNING.dash.durationMs;
    this.dashFollowupUntilMs = now + TUNING.upgrade.dashFollowupWindowMs;
    const invulnMs =
      PLAYER.dashInvulnerabilityMs +
      (this.hasUpgrade("DASH_INVULN_UP") ? TUNING.upgrade.dashInvulnBonusMs : 0);
    this.invulnerableUntilMs = Math.max(this.invulnerableUntilMs, now + invulnMs);

    // 스케일 펀치가 남아 있으면 대시 중에 충돌 박스가 계속 흔들린다(punch 주석 참고).
    this.clearPunch();

    // 거리와 시간으로 속도를 역산한다. dashDistance가 바뀌어도 체감 거리가 유지된다.
    const speed = PLAYER.dashDistance / (TUNING.dash.durationMs / 1000);
    this.dashGrounded = this.isGrounded;
    body.setVelocity(this.facing * speed, this.isGrounded ? 0 : -TUNING.dash.airLiftVelocity);
    if (this.isGrounded) {
      /**
       * 지상 대시는 직선이어야 판단하기 쉽다. 하지만 예전처럼 중력을 꺼서 직선을
       * 만들면 안 된다 — 중력이 꺼지면 몸이 바닥을 누르지 않아 매 프레임 일어나던
       * 바닥 분리(separation)가 멎고, 그 사이 충돌 박스가 조금이라도 어긋나면
       * 되잡히지 못해 지면 아래로 빠진다("대시할 때 땅으로 꺼지는" 버그).
       * 중력은 그대로 두고 세로 속도만 매 프레임 지워 수평을 유지한다(update 참고).
       */
    } else {
      // 공중 대시는 중력을 조금 남겨 호를 그린다. 완전히 끄면 일자로 날아 딱딱하다.
      body.setGravityY(-this.scene.physics.world.gravity.y * (1 - TUNING.dash.airGravityScale));
    }
    this.lockAnim("dash");
    this.lastAfterimageAtMs = 0;
    this.trailAfterimage(now);
  }

  private endDash(): void {
    this.isDashing = false;
    this.dashGrounded = false;
    const body = this.sprite?.body as Phaser.Physics.Arcade.Body | undefined;
    if (!body) return;
    // 지상 대시는 이제 중력을 끄지 않지만, 예전 상태나 공중 대시에서 넘어올 수 있어
    // 양쪽 모두 기본값으로 되돌린다.
    body.setAllowGravity(true);
    body.setGravityY(0);
  }

  // ────────────────────────────── 패링 ──────────────────────────────

  private parry(): void {
    const sprite = this.sprite;
    const now = this.scene.time.now;
    if (!sprite || this.isDead || this.isDashing) return;
    if (now < this.parryCooldownUntilMs) return;

    this.parrying = true;
    this.parryStartedAtMs = now;
    this.parryEndsAtMs = now + PARRY_ACTIVE_MS;
    this.parryCooldownUntilMs = now + PARRY_COOLDOWN_MS;

    // 소리는 성공했을 때만 낸다(takeDamage의 퍼펙트 분기) — 자세를 잡는 순간에 매번
    // 울리면 실제로 막았는지와 상관없이 성공한 것처럼 들린다.
    this.parryGuardFx?.destroy();
    this.parryGuardFx = parryGuard(this.scene, sprite.x, sprite.y, this.facing);
  }

  private endParry(): void {
    this.parrying = false;
    if (this.parryGuardFx) {
      clearParryGuard(this.scene, this.parryGuardFx);
      this.parryGuardFx = null;
    }
  }

  // ────────────────────────────── 공격 ──────────────────────────────

  /**
   * 모드에 맞는 공격으로 넘긴다. 쿨타임 판정은 각 공격 안에 있다.
   *
   * 그림은 공격이 실제로 나간 뒤에만 바꾼다.
   * 먼저 재생하면 쿨타임에 막힌 입력까지 애니메이션을 처음으로 되돌려,
   * 연타할 때 첫 자세만 반복되고 끝나면 마지막 프레임에 굳는다.
   */
  private attack(): void {
    const fired = this.mode === "MELEE" ? this.attackMelee() : this.attackRanged();
    if (!fired) return;

    // 검과 총은 그림이 갈려야 하고, 같은 무기 안에서도 타마다 달라야 콤보로 읽힌다.
    // 단계는 각 공격 안에서 이미 갱신됐으므로 여기서는 읽기만 한다.
    this.lockAnim(
      this.mode === "MELEE"
        ? comboAnim(MELEE_ANIM_BY_STEP, this.comboStep)
        : comboAnim(RANGED_ANIM_BY_STEP, this.rangedStep),
    );
  }

  /**
   * 한 번 재생되는 그림을 끝까지 보여 준다.
   *
   * 잠그는 것은 그림뿐이고 입력은 계속 받는다. 조작이 막히면 전환이 무기처럼 느껴지지 않는다.
   */
  private lockAnim(state: PlayerAnimState): void {
    const spec = PLAYER_SPRITE.states[state];

    // 프레임별 추가 시간이 있으면 그것까지 더해야 실제 길이가 나온다.
    // 짧게 잡으면 휘두르다 만 그림에서 이동 애니메이션이 끼어든다.
    const base = (spec.frames / spec.fps) * 1000;
    // `as const` 탓에 원소 타입이 리터럴로 좁혀져 있다. 누산기 타입을 명시해야 더할 수 있다.
    const extra =
      "frameDurations" in spec
        ? spec.frameDurations.reduce<number>((sum, ms) => sum + ms, 0)
        : 0;

    const now = this.scene.time.now;
    const total = base + extra;
    this.attackAnimUntilMs = now + total;
    // 앞부분(휘두르는 구간)은 끝까지 보여 주고, 뒷부분(마무리)만 이동으로 끊게 한다.
    this.animCancelAtMs = now + total * TUNING.animCancelRatio;
    this.playAnim(state, true);
  }

  /** 근거리 공격 입력. 3연속 베기. */
  attackMelee(): boolean {
    const sprite = this.sprite;
    const now = this.scene.time.now;
    // 실제로 나갔는지를 돌려준다. 부르는 쪽이 이걸 보고 그림을 바꾼다.
    if (!sprite || this.isDead || now < this.nextAttackAtMs) return false;

    // 콤보 창이 끊기면 1타부터 다시 시작한다.
    this.comboStep = now > this.comboExpiresAtMs ? 1 : (this.comboStep % 3) + 1;
    this.comboExpiresAtMs = now + TUNING.melee.comboWindowMs;
    this.nextAttackAtMs = now + PLAYER.meleeCooldownMs;

    this.telemetry.recordMeleeAttack();
    if (!this.isGrounded) this.telemetry.recordAirAttack();

    const isFinisher = this.comboStep === 3;
    const { melee } = TUNING;
    // 벼린 검은 더 길다. 그림과 판정이 함께 늘어야 닿아 보이는데 안 맞는 일이 없다.
    const reforgedBlade = this.hasUpgrade("BLADE_REFORGED");
    const reach =
      (isFinisher ? melee.finisherReach : melee.reach) +
      (isFinisher && this.hasUpgrade("MELEE_FINISHER_RANGE_UP") ? melee.finisherRangeBonus : 0) +
      (reforgedBlade ? TUNING.upgrade.bladeReachBonus : 0) +
      (this.hasUpgrade("MELEE_BLADE_SIZE_UP") ? TUNING.upgrade.bladeSizeReachBonus : 0);

    let damage: number = melee.damage;
    if (this.hasUpgrade("MELEE_DAMAGE_UP")) damage *= TUNING.upgrade.meleeDamageMultiplier;
    if (reforgedBlade) damage *= TUNING.upgrade.bladeDamageMultiplier;
    if (isFinisher) damage *= melee.finisherDamageMultiplier;
    if (this.hasUpgrade("MELEE_BERSERK") && this.hp <= this.maxHp * TUNING.upgrade.berserkHpRatio) {
      damage *= TUNING.upgrade.berserkDamageMultiplier;
    }
    damage = this.applyDashFollowup(damage);

    const hitbox = this.scene.physics.add.image(
      sprite.x + this.facing * (TUNING.body.width / 2 + reach / 2),
      sprite.y,
      TEXTURE.playerAttack,
    );
    hitbox.setDisplaySize(reach, melee.hitboxHeight);
    hitbox.setDepth(TUNING.depth.attack);
    // 판정 범위는 눈에 보일 필요가 없다. 궤적은 아래 slashArc가 그린다.
    hitbox.setAlpha(0);
    this.deps.arena.playerAttacks.add(hitbox);
    (hitbox.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);

    hitbox.setData("damage", Math.round(damage));
    hitbox.setData("mode", "MELEE" satisfies AttackMode);
    // consumeOnHit을 걸지 않는다. 한 번 휘두르면 범위 안의 적을 모두 벤다.
    if (this.hasUpgrade("MELEE_FIRE_EDGE")) hitbox.setData("element", "FIRE" satisfies UpgradeElement);

    this.scene.time.delayedCall(melee.hitboxLifeMs, () => hitbox.destroy());

    const swordHitByStep = [AUDIO.swordHit1, AUDIO.swordHit2, AUDIO.swordHit3] as const;
    playSfx(this.scene, swordHitByStep[this.comboStep - 1]);

    // 호는 몸 중심에서 그린다. 앞으로 밀어 그리면 판정 범위 밖까지 뻗어 헛스윙처럼 보인다.
    // 1타만 발도(拔刀) 섬광 — 든 자세를 오래 보여준 뒤 순간적으로 긋는 애니메이션과 맞춘다.
    if (this.comboStep === 1) {
      slashFlash(
        this.scene,
        sprite.x,
        sprite.y - 6,
        this.facing,
        reach + TUNING.body.width / 2,
        reforgedBlade,
      );
    } else {
      slashArc(
        this.scene,
        sprite.x,
        sprite.y - 6,
        this.facing,
        reach + TUNING.body.width / 2,
        this.comboStep,
        reforgedBlade,
      );
    }

    const playerBody = sprite.body as Phaser.Physics.Arcade.Body;
    if (this.isGrounded) {
      // 몸이 검을 따라 파고든다. 팔만 흔들면 아무리 그림이 좋아도 정적으로 보인다.
      const lunge = melee.lungeSpeed * (isFinisher ? melee.finisherLungeMultiplier : 1);
      playerBody.setVelocityX(this.facing * lunge);
      this.lungeUntilMs = now + melee.lungeMs;
    } else if (playerBody.velocity.y > 0) {
      // 공중에서는 떨어지던 속도를 죽여 잠깐 머문다.
      // 그대로 낙하하면 휘두르다 만 것처럼 보인다.
      playerBody.setVelocityY(playerBody.velocity.y * melee.airHangFactor);
    }

    // 파고드는 궤적에 잔상을 남긴다. 대시와 같은 방식이라 톤이 어긋나지 않는다.
    this.lastAfterimageAtMs = 0;
    this.trailAfterimage(now);

    this.punch(TUNING.feedback.punchScale, 1 / TUNING.feedback.punchScale);

    // 검기는 이제 3타 자동 발동이 아니라 Q 액티브 스킬이다(useSkill). (사용자 결정)

    return true;
  }

  /**
   * 스킬 공통 발동 관문 — 보유·쿨다운을 검사하고 통과하면 쿨다운을 건다.
   * HUD 갱신(발동 순간 흐려지고, 다 차면 다시 밝아지는)도 여기서 한 번에 처리한다.
   */
  private tryCastSkill(id: UpgradeId, cooldownMs: number): boolean {
    const now = this.scene.time.now;
    if (!this.sprite || this.isDead || this.isDashing) return false;
    if (!this.hasUpgrade(id)) return false;
    if (now < (this.skillCooldownUntil[id] ?? 0)) return false;

    // 각인 "검로" — 모든 스킬의 재사용 대기가 일괄로 짧아진다.
    const effectiveCooldown = Math.round(
      cooldownMs * (hasEngraving("SWORD_PATH") ? ENGRAVING_EFFECT.skillCooldownScale : 1),
    );
    this.skillCooldownUntil[id] = now + effectiveCooldown;
    this.emitHud();
    this.scene.time.delayedCall(effectiveCooldown, () => {
      if (!this.isDead) this.emitHud();
    });
    return true;
  }

  /**
   * 검기(Q). 3타에 자동으로 얹히던 것을 "원할 때 쏘는 한 방"으로 옮겼다 —
   * 증강이 아니라 스킬이다. (사용자 결정)
   */
  private castSwordWave(): void {
    if (!this.tryCastSkill("MELEE_SWORD_WAVE", TUNING.upgrade.swordWaveSkillCooldownMs)) return;
    const sprite = this.sprite!;

    // 그림부터 마무리 타격이어야 한다 — 3타 모션으로 크게 벤다.
    this.comboStep = 0;
    this.lockAnim(comboAnim(MELEE_ANIM_BY_STEP, 3));
    playSfx(this.scene, AUDIO.swordHit3);

    const damage = Math.round(
      TUNING.melee.damage *
        TUNING.melee.finisherDamageMultiplier *
        TUNING.upgrade.swordWaveDamageMultiplier *
        TUNING.upgrade.swordWaveSkillDamageBonus,
    );
    this.fireSwordWave(sprite, damage);

    // 발동의 "쾅" — 가시 폭발은 이런 스킬급 순간의 언어다. 3스킬 공용 붉은 팔레트.
    spikeBurst(this.scene, sprite.x + this.facing * 24, sprite.y, {
      scale: 1.3,
      spikes: 10,
      dark: 0x330606,
      mid: 0xe0263f,
      bright: 0xffb199,
      lineColor: 0xff3b3b,
    });
    this.scene.cameras.main.shake(110, 0.006);
    this.punch(TUNING.feedback.punchScale * 1.2, 1 / TUNING.feedback.punchScale);
  }

  /**
   * 검극(R). 전방 바닥에서 검의 가시가 연쇄로 솟구치며 행진한다 —
   * 참고 스크린샷(스컬)의 보라 가시 폭발이 그대로 스킬이 된 것이다.
   */
  private castSpikeEruption(): void {
    if (!this.tryCastSkill("MELEE_SPIKE_ERUPTION", TUNING.upgrade.eruptionCooldownMs)) return;
    const sprite = this.sprite!;
    const { upgrade } = TUNING;

    this.comboStep = 0;
    this.lockAnim(comboAnim(MELEE_ANIM_BY_STEP, 3));
    playSfx(this.scene, AUDIO.swordHit3);
    this.punch(TUNING.feedback.punchScale * 1.2, 1 / TUNING.feedback.punchScale);
    this.scene.cameras.main.shake(90, 0.005);

    const dir = this.facing;
    const floorY = this.deps.arena.bounds.floorY;
    const damage = Math.round(TUNING.melee.damage * upgrade.eruptionDamageMultiplier);

    for (let i = 0; i < upgrade.eruptionCount; i += 1) {
      const at = sprite.x + dir * (70 + i * upgrade.eruptionStepPx);
      this.scene.time.delayedCall(i * upgrade.eruptionIntervalMs, () => {
        if (this.isDead) return;

        const box = this.scene.physics.add.image(at, floorY - 45, TEXTURE.playerAttack);
        box.setDisplaySize(56, 90);
        box.setDepth(TUNING.depth.attack);
        box.setAlpha(0);
        this.deps.arena.playerAttacks.add(box);
        (box.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
        box.setData("damage", damage);
        box.setData("mode", "MELEE" satisfies AttackMode);
        if (this.hasUpgrade("MELEE_FIRE_EDGE")) box.setData("element", "FIRE" satisfies UpgradeElement);
        this.scene.time.delayedCall(140, () => box.destroy());

        // 위쪽 반원으로만 치솟는 붉은 가시 + 바닥 충격 링 + 튀는 잔해 — 가시 혼자서는 약하다.
        groundEruptionBurst(this.scene, at, floorY - 8, {
          scale: 1.35,
          dark: 0x330606,
          mid: 0xe0263f,
          bright: 0xffb199,
          ringColor: 0xff3b3b,
        });
        groundDust(this.scene, at, floorY, "land");
      });
    }
  }

  /**
   * 검무(F). 제자리에서 주위 전방위를 베는 검의 폭풍 — 둘러싸였을 때의 탈출기다.
   */
  private castBladeCyclone(): void {
    if (!this.tryCastSkill("MELEE_BLADE_CYCLONE", TUNING.upgrade.cycloneCooldownMs)) return;
    const sprite = this.sprite!;
    const { upgrade } = TUNING;

    this.comboStep = 0;
    this.lockAnim(comboAnim(MELEE_ANIM_BY_STEP, 2));
    playSfx(this.scene, AUDIO.swordHit2);
    playSfx(this.scene, AUDIO.swordHit3, { delay: 120 });

    const damage = Math.round(TUNING.melee.damage * upgrade.cycloneDamageMultiplier);
    const box = this.scene.physics.add.image(sprite.x, sprite.y, TEXTURE.playerAttack);
    box.setDisplaySize(upgrade.cycloneRadiusPx * 2, 130);
    box.setDepth(TUNING.depth.attack);
    box.setAlpha(0);
    this.deps.arena.playerAttacks.add(box);
    (box.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    box.setData("damage", damage);
    box.setData("mode", "MELEE" satisfies AttackMode);
    if (this.hasUpgrade("MELEE_FIRE_EDGE")) box.setData("element", "FIRE" satisfies UpgradeElement);
    this.scene.time.delayedCall(upgrade.cycloneActiveMs, () => box.destroy());

    // 전방위 가시 + 원형 소용돌이 링 + 사방으로 튕기는 칼날 + 양방향 슬래시 — 한 바퀴 돌아 벤 것처럼 읽힌다.
    bladeVortexBurst(this.scene, sprite.x, sprite.y, upgrade.cycloneRadiusPx * 1.4, {
      dark: 0x330606,
      mid: 0xe0263f,
      bright: 0xffb199,
      ringColor: 0xff3b3b,
    });
    slashArc(this.scene, sprite.x, sprite.y - 6, this.facing, 95, 3, false);
    this.scene.time.delayedCall(110, () => {
      if (this.sprite) {
        slashArc(this.scene, this.sprite.x, this.sprite.y - 6, (this.facing * -1) as 1 | -1, 95, 2, false);
      }
    });
    this.scene.cameras.main.shake(120, 0.006);
    this.punch(TUNING.feedback.punchScale * 1.25, 1 / TUNING.feedback.punchScale);
  }

  /** 검기 투사체. 근접 판정과 별개로 `playerAttacks`에 들어가는 얇고 빠른 참격이다. */
  private fireSwordWave(sprite: Phaser.Physics.Arcade.Sprite, damage: number): void {
    const { upgrade } = TUNING;
    const facing = this.facing;
    const wave = this.scene.physics.add.image(
      sprite.x + facing * TUNING.body.width,
      sprite.y,
      TEXTURE.playerAttack,
    );
    wave.setDisplaySize(upgrade.swordWaveWidth, upgrade.swordWaveHeight);
    wave.setDepth(TUNING.depth.attack);
    wave.setAlpha(0);
    this.deps.arena.playerAttacks.add(wave);
    const body = wave.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocityX(facing * upgrade.swordWaveSpeed);

    wave.setData("damage", damage);
    wave.setData("mode", "MELEE" satisfies AttackMode);
    this.scene.time.delayedCall(upgrade.swordWaveLifeMs, () => wave.destroy());

    swordWaveTrail(this.scene, wave, facing);
  }

  /** 원거리 공격 입력. 짧은 쿨타임의 투사체. */
  attackRanged(): boolean {
    const sprite = this.sprite;
    const now = this.scene.time.now;
    if (!sprite || this.isDead || now < this.nextAttackAtMs) return false;

    // 재장전 중에는 쏘지 못한다. 탄이 없으면(모드 전환 등으로 빈 채 온 경우) 재장전부터 건다.
    if (now < this.reloadingUntilMs) return false;
    if (this.ammo <= 0) {
      this.startReload();
      return false;
    }

    const cooldown =
      PLAYER.rangedCooldownMs *
      (this.hasUpgrade("RANGED_COOLDOWN_DOWN") ? TUNING.upgrade.rangedCooldownMultiplier : 1);
    this.nextAttackAtMs = now + cooldown;
    // 검을 놓았으니 근접 콤보는 끊긴다.
    this.comboStep = 0;

    // 연사 리듬. 창이 끊기면 다시 1발째 자세로 돌아간다.
    this.rangedStep = now > this.rangedComboExpiresAtMs ? 1 : (this.rangedStep % 3) + 1;
    this.rangedComboExpiresAtMs = now + TUNING.ranged.burstWindowMs;

    this.ammo -= 1;

    this.telemetry.recordRangedAttack();
    if (!this.isGrounded) this.telemetry.recordAirAttack();

    const { ranged } = TUNING;
    const reforgedBarrel = this.hasUpgrade("BARREL_REFORGED");
    const maxHits =
      ranged.baseMaxHits + (this.hasUpgrade("RANGED_PIERCE") ? ranged.pierceBonusHits : 0);
    // 사냥꾼의 리볼버 — 재장전 직후 이 한 발에만 실리고 곧바로 꺼진다.
    const reloadBurst = this.freshReload;
    this.freshReload = false;
    const rangedDamage = Math.round(
      this.applyDashFollowup(
        ranged.damage *
          (reforgedBarrel ? TUNING.upgrade.barrelDamageMultiplier : 1) *
          (reloadBurst ? TUNING.upgrade.reloadBurstMultiplier : 1),
      ),
    );

    // 조준한 자리를 미리 붙잡아 둔다. 예고 구간(BEAM_WINDUP_MS) 동안 플레이어가 움직여도
    // 총알은 조준선이 그어진 그 자리에서 나가야 한다 — 아니면 조준선과 발사 위치가 어긋난다.
    const originX = sprite.x + this.facing * TUNING.body.width;
    const originY = sprite.y;
    const facing = this.facing;

    // 3연사 리듬을 이펙트로도 갈라준다 — 매번 같은 굵기로 나가면 검과 달리 총만
    // 단발처럼 밋밋해 보인다는 지적. 1·2발은 가볍게, 마무리(3발째)는 확실히 크게.
    const power = RANGED_POWER_BY_STEP[this.rangedStep - 1] ?? 1;
    const isFinisher = this.rangedStep === 3;

    // 총구 섬광 없이 조준선만 먼저 보여준다. 이게 "찌잉" — 옅게 그어졌다가 밝아지며 곧 쏜다고 예고한다.
    const reachToWall = facing > 0 ? this.deps.arena.bounds.width - originX : originX;
    // 조준선은 실제 사거리(maxRangePx)까지만 긋는다 — 선이 닿는 곳까지만 탄도 닿는다.
    const reach = Math.min(
      reachToWall,
      this.beamReachToEnemy(originX, originY, facing),
      ranged.maxRangePx,
    );
    beamLine(this.scene, originX, originY, facing, reach, power);

    this.scene.time.delayedCall(BEAM_WINDUP_MS, () => {
      if (this.isDead) return;

      const bulletScale = this.hasUpgrade("RANGED_BULLET_SIZE_UP")
        ? TUNING.upgrade.bulletSizeMultiplier
        : 1;
      const projectile = this.scene.physics.add.image(originX, originY, TEXTURE.playerAttack);
      projectile.setDisplaySize(ranged.width * bulletScale, ranged.height * bulletScale);
      projectile.setDepth(TUNING.depth.attack);
      // 탄 자체는 안 보이게 두고 꼬리로만 보여준다. 사각형 두 개가 겹치면 지저분하다.
      projectile.setAlpha(0);
      this.deps.arena.playerAttacks.add(projectile);

      // 꼬리는 총알에 자식으로 붙이지 않는다. 붙이면 물리 바디까지 함께 커진다.
      const trail = createBulletTrail(this.scene, facing, reforgedBarrel);
      trail.setPosition(projectile.x, projectile.y);

      const body = projectile.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false);
      body.setVelocityX(
        facing * ranged.speed * (reforgedBarrel ? TUNING.upgrade.barrelSpeedMultiplier : 1),
      );

      projectile.setData("damage", rangedDamage);
      projectile.setData("mode", "RANGED" satisfies AttackMode);
      // 속성탄은 한 발에 하나만 실린다 — 여러 개 가졌으면 불 > 독 > 냉기 순으로 우선한다.
      const element: UpgradeElement | null = this.hasUpgrade("RANGED_FIRE_ROUND")
        ? "FIRE"
        : this.hasUpgrade("RANGED_POISON_ROUND")
          ? "POISON"
          : this.hasUpgrade("RANGED_FROST_ROUND")
            ? "FROST"
            : null;
      if (element) projectile.setData("element", element);
      // 관통이 없으면 씬이 첫 적중에서 없애준다. 관통이 있으면 여기서 횟수를 센다.
      projectile.setData("consumeOnHit", maxHits <= 1);
      projectile.setData("maxHits", maxHits);
      projectile.setData("expiresAtMs", this.scene.time.now + ranged.lifeMs);
      // 사거리 판정의 기준점. 이 지점에서 maxRangePx를 넘어가면 cullProjectiles가 지운다.
      projectile.setData("startX", originX);
      this.projectiles.push({ body: projectile, trail });

      // 예고가 끝나고 실제로 나가는 "팡" — 총구 섬광은 발사 순간에만 터진다.
      muzzleFlash(this.scene, projectile.x, projectile.y, facing, power);
      // 3발이 각각 다른 총처럼 들리게 단계마다 피치를 확실히 갈라둔다. 1발째가 가장
      // 날카롭고(급하게 튀어나가는 느낌), 3발째(마무리)는 원래 피치로 묵직하게.
      playSfx(this.scene, AUDIO.gunShot, { detune: RANGED_DETUNE_BY_STEP[this.rangedStep - 1] });
      // 탄피 소리는 총성과 겹치지 않게 그 텀에 낸다.
      playSfx(this.scene, AUDIO.shellDrop, { delay: 180 });

      /**
       * 반동. 예전엔 velocity에 한 번 더해주기만 했는데, 접지 중 매 프레임 이동 로직이
       * `body.setVelocityX(방향키 * moveSpeed)`로 그 즉시 덮어써서(움직이지 않고
       * 서서 쏘면 다음 프레임 곧바로 0) 체감이 안 됐다. 근접 돌진 판정과 같은 방식
       * (`lungeUntilMs` 동안은 덮어쓰지 않고 감쇠만 시킨다)을 재사용해 짧게 버티게 한다.
       */
      const playerBody = this.sprite?.body as Phaser.Physics.Arcade.Body | undefined;
      if (playerBody) {
        playerBody.setVelocityX(playerBody.velocity.x - facing * ranged.recoil * power);
        if (this.isGrounded) this.lungeUntilMs = this.scene.time.now + RANGED_RECOIL_WINDOW_MS;
      }

      const punchScale = isFinisher
        ? TUNING.feedback.punchScale * 1.4
        : TUNING.feedback.punchScale;
      this.punch(1 / punchScale, punchScale);
      // 화면 흔들림은 매 발 준다 — 세기가 단계별로 다르니 반동이 쌓이는 게 느껴진다.
      this.scene.cameras.main.shake(40 + 40 * power, 0.0012 * power);
    });

    // 탄창을 비웠으면 곧바로 재장전에 들어간다. HUD는 매 발 갱신한다.
    if (this.ammo <= 0) this.startReload();
    else this.emitHud();

    return true;
  }

  /** 자동 재장전. 끝나기 전에는 attackRanged가 막힌다. */
  private startReload(): void {
    const now = this.scene.time.now;
    if (now < this.reloadingUntilMs) return;
    this.reloadingUntilMs = now + TUNING.ranged.reloadMs;
    // 전용 사운드가 없어 탄피 소리로 대신한다 — 시작과 끝에 한 번씩.
    playSfx(this.scene, AUDIO.shellDrop);
    this.emitHud();
    this.scene.time.delayedCall(TUNING.ranged.reloadMs, () => {
      if (this.isDead) return;
      this.ammo = this.maxMagazineSize;
      if (this.hasUpgrade("RANGED_RELOAD_BURST")) this.freshReload = true;
      playSfx(this.scene, AUDIO.shellDrop);
      this.emitHud();
    });
  }

  /**
   * 조준선이 벽까지 가지 않고 그 경로에 있는 가장 가까운 적 앞에서 멈추게 한다.
   * 벽까지 쭉 그으면 "저기까지 쏜다"가 아니라 "저 뒤까지 뚫는다"처럼 보여 실제 사거리와 어긋난다.
   *
   * @returns 총구에서 가장 가까운 적의 앞면까지 거리. 경로에 적이 없으면 `Infinity`(호출부에서 벽까지 거리와 min).
   */
  private beamReachToEnemy(originX: number, originY: number, facing: 1 | -1): number {
    let nearest = Infinity;

    for (const child of this.deps.arena.enemyBodies.getChildren()) {
      const enemy = child as Phaser.Physics.Arcade.Sprite;
      if (!enemy.active) continue;

      // 조준선과 같은 높이에 걸쳐 있는 적만 본다 — 그래야 실제로 맞는 적까지만 선이 멈춘다.
      const halfHeight = enemy.displayHeight / 2;
      if (Math.abs(enemy.y - originY) > halfHeight) continue;

      const towardEnemy = facing > 0 ? enemy.x - originX : originX - enemy.x;
      if (towardEnemy <= 0) continue;

      const distanceToFace = towardEnemy - enemy.displayWidth / 2;
      nearest = Math.min(nearest, Math.max(0, distanceToFace));
    }

    return nearest;
  }

  /**
   * 공격이 적에게 실제로 맞았을 때 호출한다.
   * 분류는 시도가 아니라 적중 기준이므로(MVP_PLAN §4) 이 호출을 빠뜨리면 분석이 무너진다.
   */
  notifyHit(mode: AttackMode, at?: { x: number; y: number }): void {
    if (mode === "MELEE") this.telemetry.recordMeleeHit();
    else this.telemetry.recordRangedHit();

    // 멈추지 않는 심장 — 근접 적중마다 낮은 확률로 조금씩 되찾는다.
    if (
      mode === "MELEE" &&
      !this.isDead &&
      this.hasUpgrade("HEALTH_VAMPIRE") &&
      Math.random() < TUNING.upgrade.vampireChance
    ) {
      this.hp = Math.min(this.maxHp, this.hp + TUNING.upgrade.vampireHeal);
      this.emitHud();
    }

    this.scene.cameras.main.shake(
      TUNING.feedback.hitShakeMs,
      TUNING.feedback.hitShakeIntensity,
    );

    // 맞은 자리를 모르면 플레이어 위치에라도 터뜨린다. 아무것도 안 나오는 것보다 낫다.
    const point = at ?? { x: this.sprite?.x ?? 0, y: this.sprite?.y ?? 0 };

    // 검은 무겁고 총은 가볍다. 파편 연출부터 갈라야 두 방식이 구분된다.
    // 붉은 화면 셰이더(pulseHitFx)는 내가 맞았을 때만 쓴다 — 내 공격에도 화면이
    // 붉게 반짝이면 "맞았다"는 신호가 흐려진다는 피드백 반영. (takeDamage 참조)
    if (mode === "MELEE") {
      hitBurst(this.scene, point.x, point.y);
      hitStop(this.scene);
    } else {
      rangedSpark(this.scene, point.x, point.y, this.facing);
    }
  }

  /** 근거리 ↔ 원거리 모드 전환. 즉시 전환한다. (PLAYER.modeSwitchMs) */
  switchMode(): void {
    this.mode = this.mode === "MELEE" ? "RANGED" : "MELEE";
    // 무기를 바꾸면 양쪽 흐름 다 끊긴다. 다음 공격은 1타부터 시작한다.
    this.comboStep = 0;
    this.rangedStep = 0;
    this.applyModeTint();
    // 손을 바꾸는 그림만 짧게 보여 준다. 전환 자체는 즉시라 입력을 막지 않는다.
    this.lockAnim("switch");
    this.punch(1.2, 1.2);
    this.emitHud();
  }

  // ────────────────────────────── 피격과 사망 ──────────────────────────────

  /**
   * @returns `perfect`가 true면 호출한 쪽(CombatScene/BossScene)이 피해원에게
   * 반사 피해를 넣어야 한다 — Player는 적을 직접 참조하지 않으므로(DEC-011)
   * 반사 자체는 씬이 처리한다.
   */
  takeDamage(amount: number = PLAYER.damagePerHit): { parried: boolean; perfect: boolean } {
    if (this.isDashing) return { parried: false, perfect: false };

    const now = this.scene.time.now;
    // 적 본체와 겹쳐 있는 동안 매 프레임 호출된다. 무적 시간이 없으면 즉사한다.
    if (this.isDead || now < this.invulnerableUntilMs) return { parried: false, perfect: false };

    if (this.parrying) {
      const elapsed = now - this.parryStartedAtMs;
      if (elapsed <= PARRY_PERFECT_MS) {
        // 퍼펙트 — 완전 무효화. 반사는 씬이 처리한다.
        this.invulnerableUntilMs = now + PLAYER.invulnerabilityMs;
        this.endParry();
        playSfx(this.scene, AUDIO.parry);
        if (this.sprite) perfectParryBurst(this.scene, this.sprite.x, this.sprite.y);
        // 성공의 쾌감은 시간과 화면이 같이 흔들려야 산다 — 히트스톱 + 줌 펀치 + 금빛 섬광.
        hitStop(this.scene);
        const cam = this.scene.cameras.main;
        cam.shake(110, 0.008);
        cam.flash(90, 255, 240, 190);
        const baseZoom = cam.zoom;
        cam.zoomTo(baseZoom * 1.07, 60, "Sine.easeOut");
        this.scene.time.delayedCall(110, () => cam.zoomTo(baseZoom, 160, "Sine.easeInOut"));
        return { parried: true, perfect: true };
      }
      // 늦은 막기 — 피해를 크게 깎는다. 창은 계속 열어 둔다(연속 공격도 받아낼 수 있게).
      amount = Math.round(amount * PARRY_BLOCK_DAMAGE_RATIO);
    }
    // 내구 강화 — 막기와 별개로, 맞을 때마다 항상 곱해진다(중첩 가능).
    if (this.hasUpgrade("HEALTH_ARMOR")) {
      amount = Math.round(amount * TUNING.upgrade.armorDamageMultiplier);
    }

    const invulnMs =
      PLAYER.invulnerabilityMs +
      (this.hasUpgrade("HEALTH_MASK") ? TUNING.upgrade.maskInvulnBonusMs : 0);
    this.invulnerableUntilMs = now + invulnMs;

    this.telemetry.recordDamageTaken();
    this.hp = Math.max(0, this.hp - amount);
    this.deps.onDamaged(amount);
    this.emitHud();

    this.flash();
    this.scene.cameras.main.shake(
      TUNING.feedback.damageShakeMs,
      TUNING.feedback.damageShakeIntensity,
    );
    // 내가 맞은 것은 가장 세게 알려야 한다. 적을 때린 것보다 강도가 높다.
    pulseHitFx(this.scene, 0.85);
    hitBurst(this.scene, this.sprite?.x ?? 0, this.sprite?.y ?? 0);

    const body = this.sprite?.body as Phaser.Physics.Arcade.Body | undefined;
    // 넉백 방향은 바라보는 쪽의 반대다. 피해원 좌표는 여기까지 오지 않는다.
    body?.setVelocity(-this.facing * TUNING.knockback.x, TUNING.knockback.y);

    if (this.hp <= 0) {
      this.die();
      return { parried: this.parrying, perfect: false };
    }
    this.blink(invulnMs);
    return { parried: this.parrying, perfect: false };
  }

  private die(): void {
    if (this.isDead) return;
    this.isDead = true;
    if (this.footsteps) stopFootsteps(this.footsteps);
    this.footsteps = null;

    const sprite = this.sprite;
    if (sprite) {
      this.blinkTween?.remove();
      this.blinkTween = null;
      (sprite.body as Phaser.Physics.Arcade.Body | null)?.setEnable(false);
      sprite.setTintFill(0xff2a3a);
      // 산화 — 몸을 빙글 돌리는 스핀 대신, 파편 터짐 + 위로 흩어지는 재로 표현한다.
      // 회전은 "죽었다"로 읽히고, 재가 뜨는 쪽이 "산화했다"에 더 맞는다는 지적을 반영했다.
      deathBurst(this.scene, sprite.x, sprite.y, 0xff2a3a);
      ashRise(this.scene, sprite.x, sprite.y, 0xff2a3a);
      this.scene.tweens.add({
        targets: sprite,
        scaleX: 0,
        scaleY: 0,
        alpha: 0,
        duration: TUNING.feedback.deathMs,
        ease: "Cubic.easeIn",
        // 이펙트가 다 보이기 전에 씬이 전환되면(부활 흐름) 산화 연출이 잘려 보인다 —
        // 여기서 끝난 뒤에 onDeath를 불러 다음 단계(재배치)로 넘어가게 한다.
        onComplete: () => this.deps.onDeath(),
      });
    } else {
      this.deps.onDeath();
    }
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

  /** 깜빡이는 횟수는 실제 무적 시간(각인·아티팩트 보너스 포함)에 맞춘다 — 안 그러면
   *  무적이 남았는데 깜빡임만 먼저 멎어 "맞을 수도 있겠다"는 착각을 준다. */
  private blink(durationMs: number = PLAYER.invulnerabilityMs): void {
    const sprite = this.sprite;
    if (!sprite) return;

    this.blinkTween?.remove();
    const halfCycles = Math.max(1, Math.round(durationMs / TUNING.feedback.blinkMs));
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
  /**
   * 타격감용 스케일 펀치.
   *
   * Arcade Body는 매 프레임 스프라이트의 scaleY로 충돌 박스의 높이와 위치를 다시
   * 계산한다(`Body.updateFromGameObject`). 평소에는 중력이 매 프레임 바닥으로
   * 눌러줘서 어긋난 만큼 곧바로 되잡히지만, 대시 중에는 그 보정이 약하다 —
   * 그래서 대시 중에는 아예 걸지 않고, 진행 중이던 것도 대시 시작 때 걷어낸다.
   */
  private punch(scaleX: number, scaleY: number): void {
    const sprite = this.sprite;
    if (!sprite || this.isDashing) return;

    /**
     * Arcade Body는 매 프레임 무조건 `Body.preUpdate → updateFromGameObject`를 돌려
     * scaleY로 충돌 박스의 높이와 y 위치를 다시 계산한다(Phaser 소스로 확인함).
     * 접지 중에 세로로 크게 스쿼시하면(특히 총 3발째처럼 배율을 키운 경우) 그 순간
     * 박스가 바닥과 크게 어긋났다가 다음 프레임에 다 못 따라잡아 바닥에 파묻히거나
     * 뜬 것처럼 보인다 — 착지·대시 때 겪은 것과 같은 원인이다.
     * 접지 중에는 세로를 건드리지 않고 가로만 스쿼시한다. 공중에서는 바닥 충돌이
     * 없으니 그대로 세로까지 쓴다.
     */
    const effectiveScaleY = this.isGrounded ? 1 : scaleY;

    this.punchTween?.remove();
    this.punchTween = this.scene.tweens.add({
      targets: sprite,
      scaleX: this.baseScale.x * scaleX,
      scaleY: this.baseScale.y * effectiveScaleY,
      duration: TUNING.feedback.punchMs,
      yoyo: true,
      // 겹쳐 들어와도 원래 크기로 확실히 돌아오게 한다.
      onComplete: () => {
        sprite.setScale(this.baseScale.x, this.baseScale.y);
        this.punchTween = null;
      },
    });
  }

  /** 진행 중인 스케일 펀치를 걷어내고 원래 크기로 되돌린다. */
  private clearPunch(): void {
    this.punchTween?.remove();
    this.punchTween = null;
    this.sprite?.setScale(this.baseScale.x, this.baseScale.y);
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
    // 느려질수록 잔상이 좁게 겹쳐 가산 블렌드로 밝기가 쌓인다.
    // 속도에 비례해 옅게 남겨야 대시 후반에 뭉치지 않는다.
    const speed = Math.abs((sprite.body as Phaser.Physics.Arcade.Body).velocity.x);
    const intensity = Phaser.Math.Clamp(speed / (PLAYER.moveSpeed * 2.2), 0, 1);
    ghost.setAlpha(TUNING.feedback.afterimageAlpha * intensity);
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
    if (this.isDead) return;

    const body = this.sprite?.body as Phaser.Physics.Arcade.Body | undefined;
    if (!body) return;

    const now = this.scene.time.now;
    if (this.attackAnimUntilMs > now) {
      // 마무리 구간에서 이미 움직이고 있다면 그림을 이동으로 넘긴다.
      // 끝까지 붙잡으면 걷는 중에도 공격 자세가 남아 조작이 굼떠 보인다.
      const canCancel = now >= this.animCancelAtMs && Math.abs(body.velocity.x) > 1;
      if (!canCancel) return;
      this.attackAnimUntilMs = 0;
    }

    // 지면 판정만 보고 jump로 넘기면 안 된다.
    // 평지를 걷는 중에도 blocked.down이 한 프레임 흔들릴 수 있는데,
    // jump는 loop가 없어서 그때마다 run이 처음부터 다시 시작한다. 걷기가 뚝뚝 끊겨 보인다.
    // 진입은 세로 속도로 확인하되(순간 흔들림 배제), 한 번 들어가면 착지 전까지는
    // 속도를 다시 보지 않는다 — 정점에서 속도가 0을 지나가는 순간에도 자세를 유지해야
    // "몸이 다시 접힌다"는 깜빡임이 안 생긴다.
    if (this.isGrounded) {
      this.isJumpAnimating = false;
    } else if (!this.isJumpAnimating && Math.abs(body.velocity.y) > TUNING.airborneVelocityY) {
      this.isJumpAnimating = true;
    }

    if (this.isJumpAnimating) this.playAnim("jump");
    else if (Math.abs(body.velocity.x) > 1) this.playAnim("run");
    else this.playAnim("idle");

    // 발소리는 땅에서 실제로 이동 중일 때만 돈다 — 점프·정지 중엔 멎는다.
    const running = this.isGrounded && !this.isJumpAnimating && Math.abs(body.velocity.x) > 1;
    if (running && !this.footsteps) this.footsteps = startFootsteps(this.scene);
    else if (!running && this.footsteps) {
      stopFootsteps(this.footsteps);
      this.footsteps = null;
    }

    if (running && now >= this.nextRunDustAtMs && this.sprite) {
      groundDust(this.scene, this.sprite.x, body.bottom, "run");
      this.nextRunDustAtMs = now + TUNING.runDustIntervalMs;
    }
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
      (this.hasUpgrade("DASH_CHARGE_UP") ? TUNING.upgrade.dashChargeBonus : 0) +
      (hasEngraving("AFTERIMAGE") ? ENGRAVING_EFFECT.dashChargeBonus : 0)
    );
  }

  private get maxMagazineSize(): number {
    return (
      TUNING.ranged.magazineSize +
      (this.hasUpgrade("RANGED_MAG_UP") ? TUNING.upgrade.magazineBonus : 0) +
      (hasEngraving("SPARE_SHELL") ? ENGRAVING_EFFECT.magazineBonus : 0)
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

    this.projectiles = this.projectiles.filter(({ body, trail }) => {
      // 씬이 관통 없는 탄을 적중 즉시 없앤다.
      // 그때 탄의 data도 함께 사라지므로, 꼬리는 여기 배열에 들고 있는 참조로만 정리할 수 있다.
      if (!body.active) {
        trail.destroy();
        return false;
      }

      // 씬이 적중한 적을 이 Set에 모아둔다. 관통 수를 세는 유일한 근거다.
      const hitCount = (body.getData("hitEnemies") as Set<unknown> | undefined)?.size ?? 0;
      const expired =
        hitCount >= (body.getData("maxHits") as number) ||
        nowMs > (body.getData("expiresAtMs") as number) ||
        // 사거리 제한 — 조준선이 닿는 곳(maxRangePx)을 넘어가면 탄도 사라진다.
        Math.abs(body.x - (body.getData("startX") as number)) > TUNING.ranged.maxRangePx ||
        body.x < 0 ||
        body.x > width;

      if (expired) {
        trail.destroy();
        body.destroy();
        return false;
      }

      trail.setPosition(body.x, body.y);
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
        maxHp: this.maxHp,
        mode: this.mode,
        roomIndex: this.lastRoomIndex,
        enemiesRemaining: this.lastEnemiesRemaining,
        selectedUpgrades: this.deps.upgrades,
        ammo: this.ammo,
        magazineSize: this.maxMagazineSize,
        reloading: this.scene.time.now < this.reloadingUntilMs,
        shards: this.deps.getShards(),
        skills: SKILL_SLOTS.filter((slot) => this.deps.upgrades.includes(slot.id)).map(
          (slot) => ({
            id: slot.id,
            key: KEY_BINDINGS[slot.action],
            ready: this.scene.time.now >= (this.skillCooldownUntil[slot.id] ?? 0),
          }),
        ),
      },
    });
  }
}
