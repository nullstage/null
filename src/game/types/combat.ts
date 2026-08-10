/**
 * 전투 물리 계약.
 *
 * 플레이어·적·보스를 각각 다른 사람이 만들기 때문에, 서로를 직접 참조하지 않고
 * 여기 정의된 그룹에만 오브젝트를 넣는다. 실제 충돌 연결은 씬이 한 곳에서 건다.
 * 이 규칙이 깨지면 누가 누구를 때렸는지 추적할 수 없게 된다.
 *
 * 오브젝트에 실어 보내는 데이터 규약:
 *   attack.setData("damage", 12)          // 공격체 필수
 *   attack.setData("mode", "MELEE")       // 플레이어 공격체 필수. 분류의 근거가 된다.
 *   attack.setData("consumeOnHit", true)  // 맞으면 사라지는 투사체
 *   body.setData("enemy", this)           // 적 본체 필수. 씬이 이걸로 피해를 전달한다.
 */

import Phaser from "phaser";

export interface CombatArena {
  /** 바닥과 발판. 플레이어와 적이 올라선다. */
  solids: Phaser.Physics.Arcade.StaticGroup;
  /** 적 본체. 플레이어 공격의 대상이자 접촉 피해원이다. */
  enemyBodies: Phaser.Physics.Arcade.Group;
  /** 플레이어가 만든 공격체. 근접 히트박스와 투사체를 모두 여기 넣는다. */
  playerAttacks: Phaser.Physics.Arcade.Group;
  /** 적이 만든 공격체. 투사체·장판·돌진 히트박스를 모두 여기 넣는다. */
  enemyAttacks: Phaser.Physics.Arcade.Group;
  /** 방의 크기와 바닥 높이. 스폰과 순찰 범위를 여기서 가져다 쓴다. */
  bounds: { width: number; height: number; floorY: number };
  /** 바닥이 실제로 존재하는 구간들. 틈(낭떠러지)이 있는 방은 여러 조각이 된다. */
  floorSegments: { x: number; width: number }[];
  /** 공중 발판들. 미니맵 실루엣과 스폰 보정에 쓴다. */
  platforms: { x: number; y: number; width: number }[];
  /** 배경(있으면). 씬이 매 프레임 `tilePositionX`를 직접 늘려 구름이 흐르게 한다. */
  background?: Phaser.GameObjects.TileSprite;
  /** 배경 위에 얹는 구름 띠(있으면). 배경보다 살짝 더 빠르게 흘려 깊이감을 준다. */
  clouds?: Phaser.GameObjects.TileSprite;
}

/**
 * 도형 플레이스홀더 팔레트. (OQ-024)
 *
 * 스프라이트가 없는 동안 형태를 구분하기 위한 색이다. 시작 화면의 붉은 톤에 맞춘다.
 * 스프라이트가 들어오면 텍스처 키만 바꾸면 되도록, 색을 코드 곳곳에 흩뿌리지 않는다.
 */
export const SILHOUETTE = {
  /** 플레이어는 배경에서 가장 밝아야 한다. 어디 있는지 즉시 보여야 하기 때문이다. */
  player: 0xf2e9e4,
  playerAttack: 0xffd9dd,
  /** 적은 역할별로 색을 나눈다. 카운터 관계가 눈으로 구분돼야 한다. (MVP_PLAN §2) */
  chaser: 0xc8383c,
  ranged: 0x9a5f86,
  mobility: 0x5f8fa6,
  boss: 0xff3b6b,
  enemyAttack: 0xff6b6b,
  /** 예고 표시. 실제 피해 전에 반드시 먼저 보여야 한다. (DEC-004) */
  telegraph: 0xffb547,
  hazard: 0xff8a3d,
  solid: 0x241a1f,
} as const;

/** 플레이스홀더 텍스처 키. `BootScene`이 만든다. */
export const TEXTURE = {
  player: "px_player",
  chaser: "px_chaser",
  ranged: "px_ranged",
  mobility: "px_mobility",
  /** 보스 — 상태별로 텍스처가 갈린다(idle·walk·spawn 등). 아래 `BOSS_SPRITE_SHEET` 참고. */
  bossIdle: "tex_boss_idle",
  bossWalk: "tex_boss_walk",
  bossSpawn: "tex_boss_spawn",
  bossSwordCombo: "tex_boss_sword_combo",
  bossExecutionSlam: "tex_boss_execution_slam",
  bossDashAttack: "tex_boss_dash_attack",
  bossChainWhip: "tex_boss_chain_whip",
  bossChainPull: "tex_boss_chain_pull",
  bossJudgment: "tex_boss_judgment",
  bossHurt: "tex_boss_hurt",
  bossPhaseChange: "tex_boss_phase_change",
  bossDeath: "tex_boss_death",
  solid: "px_ground",
  hazard: "px_hazard",
  telegraph: "px_telegraph",
  playerAttack: "px_player_attack",
  enemyAttack: "px_enemy_attack",
  /** (실험) 방 2·3 배경 — 폐허 스카이라인 한 장. 아직 레이어 분리 없이 한 장만 깐다. (OQ-029) */
  background: "tex_bg_ruins",
  /** (실험) 방 1(튜토리얼) 전용 배경. */
  backgroundTutorial: "tex_bg_bloodmoon",
  /** (실험) 바닥 타일 — 벽/아치 시트에서 잘라낸 돌바닥 띠. 방 1~3 전부 이걸로 통일했다. */
  floorTileStone: "tex_floor_stone",
  /** (실험) 전송 게이트 — 방 1을 클리어하는 지점. */
  gate: "tex_decor_gate",
  /** (실험) 배경 위에 얹는 흐르는 구름 띠. 배경 그림 속 구름은 정적이라 따로 얹어 흐르게 한다. */
  clouds: "tex_clouds",
  /** 시작·부활 시 앉았다 일어나는 인트로 4프레임. */
  playerIntro: "player_intro_sheet",
  /** 보스 체력바 장식 프레임. 위 문장(이름)·아래 문장(부제)·가운데 띠(게이지 창)를 담는다. */
  bossHpFrame: "tex_boss_hp_frame",
  /** 보스방 전용 배경 — 고딕 성당 옥좌. 다른 방과 다른 실내 그림이라 구름 없이 한 장만 깐다. */
  bossThrone: "tex_boss_throne",
  /** 보스방 전용 바닥 타일 — 제공받은 붉은 고딕 타일시트에서 잘라낸 벽돌 한 칸(52px). */
  bossFloorTile: "tex_boss_floor_tile",
  /** 검기(Q) 궤적 — 날아가는 초승달 참격이 옅어지는 6프레임. */
  skillWave: "tex_skill_wave",
  /** 검극(R) 가시 폭발 — 바닥에서 솟는 6프레임. */
  skillEruption: "tex_skill_eruption",
  /** 검무(F) 회전 폭발 — 소용돌이가 흩어지는 8프레임. */
  skillCyclone: "tex_skill_cyclone",
  /** 관통탄(총 슬롯) — 단발 섬광. */
  skillPierce: "tex_skill_pierce",
  skillPierceMuzzle: "tex_skill_pierce_muzzle",
  /** 총검돌격(총 슬롯) — 총검을 내지르는 긴 참격. */
  skillBayonet: "tex_skill_bayonet",
  /** 확산탄(총 슬롯) — 부채꼴로 퍼지는 탄막. */
  skillSpread: "tex_skill_spread",
  /** 질주의 잔영(대쉬 슬롯) — 잔상이 옅어지는 5프레임. */
  skillRushTrail: "tex_skill_rush_trail",
  /** 심연의 도약(대쉬 슬롯) — 포탈이 열리는 3프레임. */
  skillAbyssLeap: "tex_skill_abyss_leap",
  /** 패링 유지 — 막는 동안 방패가 커지는 8프레임. */
  parryCharge: "tex_parry_charge",
  /** 완벽 패링 성공 — 방패가 터지는 7프레임. */
  parryPerfect: "tex_parry_perfect",
  /** 보스 베기 — 붉은 초승달 궤적이 터지는 7프레임. */
  vfxSlashCrescent: "tex_vfx_slash_crescent",
  /** 보스 내려찍기 — 기둥이 솟았다 터지는 8프레임. */
  vfxSlamEruption: "tex_vfx_slam_eruption",
  /** 보스 사슬 발사 — 갈고리가 날아가는 7프레임. */
  vfxChainLaunch: "tex_vfx_chain_launch",
  /** 보스 사슬 포획 — 적중부터 되감기까지 8프레임. */
  vfxChainPullImpact: "tex_vfx_chain_pull_impact",
  /** 보스 공격 예고 — 사각 위험구역이 채워지는 5프레임. */
  vfxTelegraphBox: "tex_vfx_telegraph_box",
  /** 보스 돌진 베기 — 궤적이 커지는 6프레임. */
  vfxDashSlash: "tex_vfx_dash_slash",
  /** 보스 사슬 회전 — 원형으로 도는 6프레임(사슬 포획 예고 중 재생). */
  vfxChainOrbit: "tex_vfx_chain_orbit",
  /** 판결선 예고 → 낙하 — 5프레임. */
  vfxJudgmentLine: "tex_vfx_judgment_line",
  /** 원형 심판진 — 고리가 조립되어 폭발하는 7프레임. */
  vfxJudgmentRing: "tex_vfx_judgment_ring",
  /** 그림자 등장 — 4프레임(등장 연출에 겹쳐 쓴다). */
  vfxShadowEmerge: "tex_vfx_shadow_emerge",
  /** 페이즈 전환 오오라 — 7프레임. */
  vfxPhaseAura: "tex_vfx_phase_aura",
  /** 지면 가시/암흑 폭발 — 7프레임(사망 연출에 겹쳐 쓴다). */
  vfxGroundSpike: "tex_vfx_ground_spike",
} as const;

/**
 * 스킬 이펙트 스프라이트시트. 사용자가 그려 준 원본에서 프레임마다 크기가 달라
 * 셀을 그 행의 최댓값 + 여백 6px로 통일해 packing했다. 시트를 다시 뽑으면
 * 이 값들도 다시 재야 한다.
 */
export const SKILL_VFX_SHEET = {
  /** 사용자가 156px 그리드로 정렬해 준 스트립(vfx-skill, 2026-08-10)에서 재추출한 시트들. */
  wave: { path: "vfx/skill-wave.png", frameWidth: 159, frameHeight: 117, frames: 9 },
  eruption: { path: "vfx/skill-eruption.png", frameWidth: 141, frameHeight: 138, frames: 8 },
  cyclone: { path: "vfx/skill-cyclone.png", frameWidth: 134, frameHeight: 106, frames: 5 },
  /** 총 스킬 3종 — 원본 콜라주(651d47fa)에서 다프레임으로 재추출했다. 한 프레임만 잘라 써서
   *  "스프라이트 하나만 나온다"던 문제의 원인이었다. */
  pierce: { path: "vfx/skill-piercing.png", frameWidth: 130, frameHeight: 44, frames: 3 },
  /** 관통탄 총구 화염 — 발사 순간 제자리에서 터지는 부분(비행 탄과 분리). */
  pierceMuzzle: { path: "vfx/skill-pierce-muzzle.png", frameWidth: 120, frameHeight: 100, frames: 4 },
  bayonet: { path: "vfx/skill-bayonet.png", frameWidth: 314, frameHeight: 80, frames: 3 },
  spread: { path: "vfx/skill-spread.png", frameWidth: 207, frameHeight: 92, frames: 2 },
  rushTrail: { path: "vfx/skill-rushtrail.png", frameWidth: 131, frameHeight: 122, frames: 7 },
  abyssLeap: { path: "vfx/skill-abyssleap.png", frameWidth: 158, frameHeight: 150, frames: 6 },
  parryCharge: { path: "vfx/parry-charge.png", frameWidth: 216, frameHeight: 359, frames: 8 },
  parryPerfect: { path: "vfx/parry-perfect.png", frameWidth: 283, frameHeight: 395, frames: 7 },
} as const;

/**
 * 스킬 이펙트 애니메이션. `registerFrameAnimations`(적·보스와 같은 헬퍼)로 등록한다.
 * fps는 각 스킬의 지속 시간(`TUNING.upgrade`)에 맞춰 프레임 수를 나눈 값이다.
 */
export const SKILL_VFX_ANIM = {
  // 9프레임 ÷ 18fps = 500ms — 검기 수명(swordWaveLifeMs)과 맞춘 값.
  skillWaveFly: { key: TEXTURE.skillWave, start: 0, frames: SKILL_VFX_SHEET.wave.frames, fps: 18, loop: false },
  skillEruptionBurst: {
    key: TEXTURE.skillEruption,
    start: 0,
    frames: SKILL_VFX_SHEET.eruption.frames,
    fps: 20,
    loop: false,
  },
  skillCycloneBurst: {
    key: TEXTURE.skillCyclone,
    start: 0,
    frames: SKILL_VFX_SHEET.cyclone.frames,
    // 5프레임 ÷ 23fps ≈ 217ms — 검무 판정 시간(cycloneActiveMs 220)과 맞춘 값.
    fps: 23,
    loop: false,
  },
  /** 비행 중 두 프레임을 번갈아 깜빡인다 — 발사체가 사는 동안 계속 돌므로 loop. */
  skillPierceBurst: { key: TEXTURE.skillPierce, start: 0, frames: SKILL_VFX_SHEET.pierce.frames, fps: 12, loop: true },
  skillPierceMuzzle: {
    key: TEXTURE.skillPierceMuzzle,
    start: 0,
    frames: SKILL_VFX_SHEET.pierceMuzzle.frames,
    fps: 20,
    loop: false,
  },
  skillBayonetBurst: {
    key: TEXTURE.skillBayonet,
    start: 0,
    frames: SKILL_VFX_SHEET.bayonet.frames,
    // 3프레임 ÷ 14fps ≈ 214ms — 찌르기 판정 수명(bayonetLifeMs 220)에 맞춘 값.
    fps: 14,
    loop: false,
  },
  skillSpreadBurst: { key: TEXTURE.skillSpread, start: 0, frames: SKILL_VFX_SHEET.spread.frames, fps: 12, loop: false },
  skillRushTrailFly: {
    key: TEXTURE.skillRushTrail,
    start: 0,
    frames: SKILL_VFX_SHEET.rushTrail.frames,
    fps: 17,
    loop: false,
  },
  skillAbyssLeapBurst: {
    key: TEXTURE.skillAbyssLeap,
    start: 0,
    frames: SKILL_VFX_SHEET.abyssLeap.frames,
    fps: 12,
    loop: false,
  },
} as const;

export type SkillVfxKey = keyof typeof SKILL_VFX_ANIM;

/** 애니메이션 키 → 텍스처 키. 스프라이트 생성 시 초기 텍스처를 맞추는 용도. */
export const SKILL_VFX_TEXTURE: Record<SkillVfxKey, string> = {
  skillWaveFly: TEXTURE.skillWave,
  skillEruptionBurst: TEXTURE.skillEruption,
  skillCycloneBurst: TEXTURE.skillCyclone,
  skillPierceBurst: TEXTURE.skillPierce,
  skillPierceMuzzle: TEXTURE.skillPierceMuzzle,
  skillBayonetBurst: TEXTURE.skillBayonet,
  skillSpreadBurst: TEXTURE.skillSpread,
  skillRushTrailFly: TEXTURE.skillRushTrail,
  skillAbyssLeapBurst: TEXTURE.skillAbyssLeap,
};

/** 패링 이펙트 애니메이션. 스킬과 달리 아이템 없이 항상 쓰는 기본 동작이라 별도 표로 둔다. */
export const PARRY_VFX_ANIM = {
  parryChargeLoop: {
    key: TEXTURE.parryCharge,
    start: 0,
    frames: SKILL_VFX_SHEET.parryCharge.frames,
    fps: 24,
    loop: false,
  },
  parryPerfectBurst: {
    key: TEXTURE.parryPerfect,
    start: 0,
    frames: SKILL_VFX_SHEET.parryPerfect.frames,
    fps: 23,
    loop: false,
  },
} as const;

/**
 * 보스 공격 이펙트 스프라이트시트 12장. 사용자가 그려 준 절차적 VFX 대체용 원본
 * 4장(베기·체인·심판·그림자, 각 3행)에서 시퀀스별로 잘라 packing했다 —
 * `CombatVfx.ts`의 `bossTelegraphZone`/`bossShockwave`/`bossOrbTrail`/`enemySlash`
 * (보스 호출부만) 자리를 대체한다.
 */
export const BOSS_VFX_SHEET = {
  slashCrescent: { path: "vfx/vfx-slash-crescent.png", frameWidth: 247, frameHeight: 254, frames: 7 },
  slamEruption: { path: "vfx/vfx-slam-eruption.png", frameWidth: 250, frameHeight: 351, frames: 8 },
  dashSlash: { path: "vfx/vfx-dash-slash.png", frameWidth: 279, frameHeight: 180, frames: 6 },
  chainLaunch: { path: "vfx/vfx-chain-launch.png", frameWidth: 328, frameHeight: 220, frames: 7 },
  chainPullImpact: { path: "vfx/vfx-chain-pull-impact.png", frameWidth: 229, frameHeight: 257, frames: 8 },
  chainOrbit: { path: "vfx/vfx-chain-orbit.png", frameWidth: 266, frameHeight: 267, frames: 6 },
  judgmentLine: { path: "vfx/vfx-judgment-line.png", frameWidth: 485, frameHeight: 334, frames: 5 },
  telegraphBox: { path: "vfx/vfx-telegraph-box.png", frameWidth: 496, frameHeight: 277, frames: 5 },
  judgmentRing: { path: "vfx/vfx-judgment-ring.png", frameWidth: 376, frameHeight: 337, frames: 7 },
  shadowEmerge: { path: "vfx/vfx-shadow-emerge.png", frameWidth: 485, frameHeight: 395, frames: 4 },
  phaseAura: { path: "vfx/vfx-phase-aura.png", frameWidth: 352, frameHeight: 335, frames: 7 },
  groundSpike: { path: "vfx/vfx-ground-spike.png", frameWidth: 326, frameHeight: 240, frames: 7 },
} as const;

/**
 * 보스 VFX 애니메이션. 예고류(chainOrbit/telegraphBox)만 loop=true로 두고
 * 호출부가 durationMs만큼 붙잡고 있다가 직접 destroy한다 — 나머지는 전부
 * 한 번 재생하고 끝난다(스킬 이펙트와 같은 문법).
 */
export const BOSS_VFX_ANIM = {
  bossSlashCrescentBurst: {
    key: TEXTURE.vfxSlashCrescent,
    start: 0,
    frames: BOSS_VFX_SHEET.slashCrescent.frames,
    fps: 14,
    loop: false,
  },
  bossSlamEruptionBurst: {
    key: TEXTURE.vfxSlamEruption,
    start: 0,
    frames: BOSS_VFX_SHEET.slamEruption.frames,
    fps: 14,
    loop: false,
  },
  bossDashSlashBurst: {
    key: TEXTURE.vfxDashSlash,
    start: 0,
    frames: BOSS_VFX_SHEET.dashSlash.frames,
    fps: 12,
    loop: false,
  },
  bossChainLaunchLoop: {
    key: TEXTURE.vfxChainLaunch,
    start: 0,
    frames: BOSS_VFX_SHEET.chainLaunch.frames,
    fps: 16,
    loop: true,
  },
  bossChainPullImpactBurst: {
    key: TEXTURE.vfxChainPullImpact,
    start: 0,
    frames: BOSS_VFX_SHEET.chainPullImpact.frames,
    fps: 14,
    loop: false,
  },
  bossChainOrbitLoop: {
    key: TEXTURE.vfxChainOrbit,
    start: 0,
    frames: BOSS_VFX_SHEET.chainOrbit.frames,
    fps: 10,
    loop: true,
  },
  bossJudgmentLineBurst: {
    key: TEXTURE.vfxJudgmentLine,
    start: 0,
    frames: BOSS_VFX_SHEET.judgmentLine.frames,
    fps: 10,
    loop: false,
  },
  bossTelegraphBoxBurst: {
    key: TEXTURE.vfxTelegraphBox,
    start: 0,
    frames: BOSS_VFX_SHEET.telegraphBox.frames,
    fps: 10,
    loop: false,
  },
  bossJudgmentRingBurst: {
    key: TEXTURE.vfxJudgmentRing,
    start: 0,
    frames: BOSS_VFX_SHEET.judgmentRing.frames,
    fps: 12,
    loop: false,
  },
  bossShadowEmergeBurst: {
    key: TEXTURE.vfxShadowEmerge,
    start: 0,
    frames: BOSS_VFX_SHEET.shadowEmerge.frames,
    fps: 8,
    loop: false,
  },
  bossPhaseAuraBurst: {
    key: TEXTURE.vfxPhaseAura,
    start: 0,
    frames: BOSS_VFX_SHEET.phaseAura.frames,
    fps: 10,
    loop: false,
  },
  bossGroundSpikeBurst: {
    key: TEXTURE.vfxGroundSpike,
    start: 0,
    frames: BOSS_VFX_SHEET.groundSpike.frames,
    fps: 12,
    loop: false,
  },
} as const;

export type BossVfxKey = keyof typeof BOSS_VFX_ANIM;

/** 애니메이션 키 → 텍스처 키. 스프라이트 생성 시 초기 텍스처를 맞추는 용도. */
export const BOSS_VFX_TEXTURE: Record<BossVfxKey, string> = {
  bossSlashCrescentBurst: TEXTURE.vfxSlashCrescent,
  bossSlamEruptionBurst: TEXTURE.vfxSlamEruption,
  bossDashSlashBurst: TEXTURE.vfxDashSlash,
  bossChainLaunchLoop: TEXTURE.vfxChainLaunch,
  bossChainPullImpactBurst: TEXTURE.vfxChainPullImpact,
  bossChainOrbitLoop: TEXTURE.vfxChainOrbit,
  bossJudgmentLineBurst: TEXTURE.vfxJudgmentLine,
  bossTelegraphBoxBurst: TEXTURE.vfxTelegraphBox,
  bossJudgmentRingBurst: TEXTURE.vfxJudgmentRing,
  bossShadowEmergeBurst: TEXTURE.vfxShadowEmerge,
  bossPhaseAuraBurst: TEXTURE.vfxPhaseAura,
  bossGroundSpikeBurst: TEXTURE.vfxGroundSpike,
};

/**
 * 보스 스프라이트시트 12장. 사용자가 그려 준 원본(집행자) 4장에서 시퀀스별로 잘라
 * packing했다 — 모든 시퀀스가 같은 463×409 셀을 쓰고, 그림마다 바닥선(발밑)이
 * 셀 하단 기준 같은 위치에 오도록 정렬했다. 그래야 idle↔walk↔공격 사이를
 * 텍스처째로 갈아 끼워도 발이 화면에서 튀지 않는다. 시트를 다시 뽑으면 이 값도 다시 잰다.
 */
export const BOSS_SPRITE_SHEET = {
  idle: { path: "sprites/boss/boss-idle.png", frameWidth: 463, frameHeight: 409, frames: 5 },
  walk: { path: "sprites/boss/boss-walk.png", frameWidth: 463, frameHeight: 409, frames: 8 },
  spawn: { path: "sprites/boss/boss-spawn.png", frameWidth: 463, frameHeight: 409, frames: 6 },
  swordCombo: { path: "sprites/boss/boss-sword-combo.png", frameWidth: 463, frameHeight: 409, frames: 7 },
  executionSlam: { path: "sprites/boss/boss-execution-slam.png", frameWidth: 463, frameHeight: 409, frames: 8 },
  dashAttack: { path: "sprites/boss/boss-dash-attack.png", frameWidth: 463, frameHeight: 409, frames: 6 },
  chainWhip: { path: "sprites/boss/boss-chain-whip.png", frameWidth: 463, frameHeight: 409, frames: 7 },
  chainPull: { path: "sprites/boss/boss-chain-pull.png", frameWidth: 463, frameHeight: 409, frames: 7 },
  judgment: { path: "sprites/boss/boss-judgment.png", frameWidth: 463, frameHeight: 409, frames: 6 },
  hurt: { path: "sprites/boss/boss-hurt.png", frameWidth: 463, frameHeight: 409, frames: 4 },
  phaseChange: { path: "sprites/boss/boss-phase-change.png", frameWidth: 463, frameHeight: 409, frames: 8 },
  death: { path: "sprites/boss/boss-death.png", frameWidth: 463, frameHeight: 409, frames: 6 },
} as const;

/**
 * 보스 애니메이션. idle·walk·spawn·hurt·phaseChange·death는 시퀀스 하나를 통째로 재생하고,
 * 공격 4종(slash·dash·projectile·slam)과 새 기믹 2종(judgment·chainPull)은 각 시퀀스를
 * 앞부분(예고, loop)·뒷부분(타격, 1회)으로 나눠 기존 setPose/strikePose 문법을 그대로 쓴다.
 * (DEC-004 — 피해가 나가기 전에 반드시 예고 자세가 먼저 보여야 한다)
 */
export const BOSS_ANIM = {
  bossIdleLoop: { key: TEXTURE.bossIdle, start: 0, frames: BOSS_SPRITE_SHEET.idle.frames, fps: 6, loop: true },
  bossWalkLoop: { key: TEXTURE.bossWalk, start: 0, frames: BOSS_SPRITE_SHEET.walk.frames, fps: 8, loop: true },
  bossSpawnRise: { key: TEXTURE.bossSpawn, start: 0, frames: BOSS_SPRITE_SHEET.spawn.frames, fps: 7, loop: false },
  bossHurtFlinch: { key: TEXTURE.bossHurt, start: 0, frames: BOSS_SPRITE_SHEET.hurt.frames, fps: 10, loop: false },
  bossPhaseChangeSurge: {
    key: TEXTURE.bossPhaseChange,
    start: 0,
    frames: BOSS_SPRITE_SHEET.phaseChange.frames,
    fps: 10,
    loop: false,
  },
  bossDeathCollapse: { key: TEXTURE.bossDeath, start: 0, frames: BOSS_SPRITE_SHEET.death.frames, fps: 6, loop: false },

  bossSlashTelegraph: { key: TEXTURE.bossSwordCombo, start: 0, frames: 3, fps: 6, loop: true },
  bossSlashStrike: { key: TEXTURE.bossSwordCombo, start: 3, frames: 4, fps: 12, loop: false },

  bossDashTelegraph: { key: TEXTURE.bossDashAttack, start: 0, frames: 2, fps: 6, loop: true },
  bossDashStrike: { key: TEXTURE.bossDashAttack, start: 2, frames: 4, fps: 14, loop: false },

  bossProjectileTelegraph: { key: TEXTURE.bossChainWhip, start: 0, frames: 3, fps: 6, loop: true },
  bossProjectileStrike: { key: TEXTURE.bossChainWhip, start: 3, frames: 4, fps: 12, loop: false },

  bossSlamTelegraph: { key: TEXTURE.bossExecutionSlam, start: 0, frames: 3, fps: 5, loop: true },
  bossSlamStrike: { key: TEXTURE.bossExecutionSlam, start: 3, frames: 5, fps: 12, loop: false },

  bossJudgmentTelegraph: { key: TEXTURE.bossJudgment, start: 0, frames: 2, fps: 6, loop: true },
  bossJudgmentStrike: { key: TEXTURE.bossJudgment, start: 2, frames: 4, fps: 10, loop: false },

  bossChainPullTelegraph: { key: TEXTURE.bossChainPull, start: 0, frames: 3, fps: 6, loop: true },
  bossChainPullStrike: { key: TEXTURE.bossChainPull, start: 3, frames: 4, fps: 12, loop: false },
} as const;

/** 상태·패턴별 예고(telegraph)·타격(strike) 포즈가 재생할 애니메이션 키. `Boss.ts`의 setPose/strikePose가 쓴다. */
export const BOSS_FRAME = {
  idle: "bossIdleLoop",
  walk: "bossWalkLoop",
  spawn: "bossSpawnRise",
  hurt: "bossHurtFlinch",
  phaseChange: "bossPhaseChangeSurge",
  death: "bossDeathCollapse",
  slashTelegraph: "bossSlashTelegraph",
  slashStrike: "bossSlashStrike",
  dashTelegraph: "bossDashTelegraph",
  dashStrike: "bossDashStrike",
  projectileTelegraph: "bossProjectileTelegraph",
  projectileStrike: "bossProjectileStrike",
  slamTelegraph: "bossSlamTelegraph",
  slamStrike: "bossSlamStrike",
  judgmentTelegraph: "bossJudgmentTelegraph",
  judgmentStrike: "bossJudgmentStrike",
  chainPullTelegraph: "bossChainPullTelegraph",
  chainPullStrike: "bossChainPullStrike",
} as const satisfies Record<string, keyof typeof BOSS_ANIM>;

/** 전투 효과음·BGM 키. Phaser 내장 사운드로 재생한다 — UI 효과음(`sfx.ts`)과는 별도 경로다. */
export const AUDIO = {
  swordHit1: "sfx_sword_1",
  swordHit2: "sfx_sword_2",
  swordHit3: "sfx_sword_3",
  gunShot: "sfx_gun",
  shellDrop: "sfx_shell",
  hitEnemy: "sfx_hit_enemy",
  parry: "sfx_parry",
  /** 패링 자세를 잡는 순간. 성공음(parry)과 구분되는 시전음이다. */
  parryCast: "sfx_parry_cast",
  playerHurt: "sfx_player_hurt",
  swordWave: "sfx_skill_sword_wave",
  spike: "sfx_skill_spike",
  /** 그림자 실체화(깨어남) — 인트로 연출 길이에 맞춘 긴 트랙. */
  bossAwaken: "sfx_boss_awaken",
  bossChain: "sfx_boss_chain",
  bossSlam: "sfx_boss_slam",
  footstepRun: "sfx_run",
  dash: "sfx_dash",
  portal: "sfx_portal",
  bgmCombat: "bgm_combat",
  /** 방 1(튜토리얼) 전용 — 아직 전투가 없는 마을 분위기라 전투 BGM과 다르게 튼다. */
  bgmVillage: "bgm_village",
  /** 보스방 전용. */
  bgmBoss: "bgm_boss",
} as const;

/**
 * 플레이어 스프라이트시트. `sprite-gen`이 뽑은 `manifest.json`의 값을 옮겨 적었다.
 *
 * 시트를 다시 생성하면 manifest의 `animation.rows`와 이 표가 어긋나지 않는지 확인해야 한다.
 * 어긋나면 엉뚱한 행이 재생되는데, 화면에서만 보이고 오류로는 드러나지 않는다.
 */
export const PLAYER_SPRITE = {
  key: "player_sheet",
  /** 512x704, 8열 11행. 오른손 총·왼손 검을 함께 든 양손 무기 시트다. */
  path: "sprites/player/player.png",
  frameWidth: 64,
  frameHeight: 64,
  columns: 8,
  /**
   * 프레임 안에서 발끝이 닿는 y. 프레임 아래에 빈 줄이 남아 있어 48이 아니다.
   *
   * 충돌 바디의 바닥을 여기에 맞춰야 캐릭터가 지면에 붙는다.
   * 프레임 높이를 그대로 쓰면 남은 여백만큼(스케일 배수로) 공중에 뜬 것처럼 보인다.
   * 시트를 다시 뽑으면 이 값도 함께 확인해야 한다.
   */
  footY: 57,
  states: {
    idle: { row: 0, frames: 6, fps: 6, loop: true },
    run: { row: 1, frames: 8, fps: 12, loop: true },
    /**
     * 1프레임만 쓴다. 원래 6프레임을 다 돌리면 공중에서 다리를 파닥거리는 것처럼
     * 보였다 — 웅크린 자세(프레임 0) 하나로 붙잡아 두는 쪽이 더 깔끔하다.
     */
    jump: { row: 2, frames: 1, fps: 9, loop: false },
    dash: { row: 3, frames: 6, fps: 16, loop: false },
    /**
     * 왼손 검 3연타. 타마다 그림이 달라야 콤보가 콤보로 읽힌다.
     * 1타 수평 베기 → 2타 올려 베기 → 3타 내려찍기.
     *
     * `frameDurations`는 프레임마다 **더해지는** 시간이다(Phaser 규칙).
     * 모든 프레임을 같은 길이로 재생하면 그림이 아무리 좋아도 정적으로 보인다.
     * 윈드업에서 뜸을 들이고 베는 순간은 최소 시간으로 지나가야 힘이 실린다.
     */
    /**
     * 2·3프레임이 검을 드는 동작인데 원래 추가 시간이 0이라 순식간에 지나갔다
     * (사용자 지적). 그 두 프레임에 뜸을 몰아주고, 실제로 베는 4프레임은 오히려
     * 더 줄여 발도하듯 순간적으로 터지게 했다.
     */
    attack1: { row: 4, frames: 6, fps: 26, loop: false, frameDurations: [30, 20, 90, 60, 15, 80] },
    attack2: { row: 5, frames: 6, fps: 26, loop: false, frameDurations: [45, 30, 0, 0, 35, 75] },
    /** 마무리 타격. 가장 무겁게 뜸을 들이고 가장 길게 여운을 남긴다. */
    attack3: {
      row: 6,
      frames: 7,
      fps: 24,
      loop: false,
      frameDurations: [70, 55, 0, 0, 40, 70, 110],
    },
    /**
     * 오른손 총 3연사. 근거리와 그림이 갈려야 지금 무엇을 쓰는지 보인다.
     * 1발 뽑아 들며 사격 → 2발 겨눈 채 후속 → 3발 버티며 강한 반동.
     */
    shoot1: {
      row: 7,
      frames: 8,
      fps: 28,
      loop: false,
      frameDurations: [45, 35, 25, 0, 30, 30, 35, 60],
    },
    shoot2: {
      row: 8,
      frames: 8,
      fps: 28,
      loop: false,
      frameDurations: [30, 25, 0, 25, 25, 30, 30, 55],
    },
    shoot3: {
      row: 9,
      frames: 8,
      fps: 26,
      loop: false,
      frameDurations: [45, 35, 25, 0, 35, 35, 40, 70],
    },
    switch: { row: 10, frames: 4, fps: 14, loop: false },
  },
} as const;

export type PlayerAnimState = keyof typeof PLAYER_SPRITE.states;

/**
 * 콤보 단계(1~3)를 애니메이션 상태로 바꾼다.
 *
 * 단계 번호와 시트 행이 어긋나면 2타를 쳤는데 3타 그림이 나온다.
 * 화면에서만 티가 나고 오류로는 드러나지 않으니 한 곳에서만 관리한다.
 */
export const MELEE_ANIM_BY_STEP = ["attack1", "attack2", "attack3"] as const;
export const RANGED_ANIM_BY_STEP = ["shoot1", "shoot2", "shoot3"] as const;

/** 단계 값이 범위를 벗어나도 첫 타로 떨어지게 한다. */
export const comboAnim = (
  table: readonly PlayerAnimState[],
  step: number,
): PlayerAnimState => table[Math.min(Math.max(step, 1), table.length) - 1];

/** 애니메이션 키. 씬과 엔티티가 같은 문자열을 쓰도록 한 곳에서 만든다. */
export const playerAnimKey = (state: PlayerAnimState): string => `player-${state}`;

/** 기상 인트로 애니메이션 키. 시작·부활 때 한 번만 재생한다. */
export const PLAYER_INTRO_ANIM = "player-intro";

/**
 * 적 애니메이션. 제공된 스프라이트시트에서 프레임 구간만 골라 쓴다.
 *
 * 원본 시트를 그대로 로드하므로(64px 정사각 셀) start는 `행 * 열수 + 칸` 또는
 * (적2처럼) 소스의 프레임 태그를 기준으로 역산한 값이다.
 *   - 적1(ranged, 18열): idle=0행, walk=1행, attack=3행(투사체 던지는 구간 포함)
 *   - 적2(chaser, 16열): aseprite 태그 기준 idle/walk/attack 1 구간 (1-based 태그 → 0-based로 -1)
 * 애니메이션 키 문자열은 이 객체의 속성 이름을 그대로 쓴다(`registerEnemyAnimations` 참고).
 */
export const ENEMY_ANIM = {
  rangedIdle: { key: TEXTURE.ranged, start: 0, frames: 8, fps: 8, loop: true },
  rangedWalk: { key: TEXTURE.ranged, start: 18, frames: 8, fps: 10, loop: true },
  rangedAttack: { key: TEXTURE.ranged, start: 54, frames: 12, fps: 14, loop: false },
  /**
   * 고블린 시트는 태그마다 새 행에서 시작하고 행 끝은 빈 칸이다.
   * 그리드 번호는 aseprite JSON의 frame x·y에서 역산했다 — JSON 나열 순서(0,1,2…)를
   * 그대로 쓰면 빈 칸이나 엉뚱한 동작이 재생된다(예고 중 고블린이 투명해지던 버그).
   */
  chaserIdle: { key: TEXTURE.chaser, start: 64, frames: 8, fps: 8, loop: true },
  chaserWalk: { key: TEXTURE.chaser, start: 80, frames: 8, fps: 10, loop: true },
  chaserAttack: { key: TEXTURE.chaser, start: 128, frames: 8, fps: 14, loop: false },
} as const;

/**
 * 렌더 순서. 흩어져 있으면 "장식이 적을 가린다" 같은 문제가 생겨 한 곳에 모은다.
 * 적은 예전에 depth를 지정하지 않아 기본값 0이었고, 그래서 장식(2)에 가려졌다.
 */
export const DEPTH = {
  background: -10,
  clouds: -9,
  floor: 1,
  decor: 2,
  enemy: 6,
  player: 10,
} as const;

/** 바닥 두께. 스폰 높이 계산의 기준이 된다. */
export const FLOOR_HEIGHT = 48;

/** `background` 텍스처(`ruins-dusk.png`)의 원본 픽셀 크기. 비율 계산에 쓴다. */
const BACKGROUND_SOURCE = { width: 1774, height: 887 };

/** `clouds` 텍스처(`clouds.png`)의 원본 픽셀 크기. */
const CLOUD_SOURCE = { width: 1536, height: 197 };

/**
 * 바닥과 충돌 그룹을 만든다. 전투방과 보스방이 같은 구조를 쓴다.
 * 발판이 필요한 방 템플릿은 여기 만든 `solids`에 덧붙이면 된다. (MVP_PLAN §2-3)
 */
export const createArena = (
  scene: Phaser.Scene,
  viewport: { width: number; height: number },
  /** (실험) 넘기면 바닥 위에 이 텍스처를 가로로 반복해 깐다. 안 넘기면 기존 단색 그대로다. */
  floorTileKey?: string,
  /** (실험) 넘기면 방 전체 크기로 늘려 맨 뒤에 깐다. 레이어 분리 없는 배경 한 장이다. */
  backgroundKey?: string,
  /** 바닥 타일 원본 높이(px). 타일마다 실제 그림 높이가 달라 고정값 32를 쓸 수 없다. */
  floorTileHeight = 32,
  /** 바닥 타일 틴트. 방 분위기에 따라 달리 칠한다(튜토리얼 vs 전투방). */
  floorTint = 0x27141d,
  /**
   * (실험) 랜덤 지형. gaps는 바닥에 뚫리는 낭떠러지, platforms는 공중 발판.
   * 안 넘기면 기존처럼 평평한 통짜 바닥이다(튜토리얼·보스방).
   */
  layout?: {
    gaps: { x: number; width: number }[];
    platforms: { x: number; y: number; width: number }[];
  },
): CombatArena => {
  // 위는 밝고 아래로 갈수록 어두워지는 세로 그라데이션 — 단색보다 입체감이 산다.
  const tintTop = Phaser.Display.Color.ValueToColor(floorTint).lighten(28).color;
  const tintBottom = Phaser.Display.Color.ValueToColor(floorTint).darken(35).color;
  const { width, height } = viewport;
  const floorY = height - FLOOR_HEIGHT;

  let background: Phaser.GameObjects.TileSprite | undefined;
  if (backgroundKey) {
    // 모든 것보다 뒤에 있어야 한다. 다른 오브젝트는 깊이 0 이상을 쓰므로 음수로 확실히 뺀다.
    const scale = height / BACKGROUND_SOURCE.height;
    const scaledWidth = BACKGROUND_SOURCE.width * scale;

    // TileSprite를 쓴다 — 이미지는 정적이지만, `tilePositionX`를 씬 쪽에서 매 프레임
    // 조금씩 늘려 그림 속 구름이 떠다니는 것처럼 보이게 한다(사용자 요청).
    //
    // 처음엔 이걸 반복 트윈("+=40", repeat:-1)으로 돌렸다가 40초마다 배경이 원래
    // 자리로 툭 튀는 버그가 났다 — Phaser 트윈은 상대값을 시작 시점에 딱 한 번만
    // 절대값으로 확정하고, yoyo 없는 repeat는 매 반복마다 그 시작 값으로 되돌아간다.
    // 그래서 한쪽으로만 계속 흐르게 하려면 트윈이 아니라 매 프레임 누적해야 한다.
    if (scaledWidth >= width) {
      // 방이 배경보다 좁다 — 세로 기준으로만 맞추고, 가운데만 보여주고 양옆은 잘린다.
      // 가로까지 방 폭에 맞춰 늘리면 배경 속 성이 옆으로 눌려 찌그러진다.
      background = scene.add.tileSprite(width / 2, height, scaledWidth, height, backgroundKey);
      background.setOrigin(0.5, 1);
      background.setTileScale(scale, scale);
    } else {
      // 방이 배경보다 넓다(튜토리얼 방) — 그림 한 장을 방 크기에 맞춰 그대로 키운다.
      // 반복 타일링(가로로 여러 장)은 이음매가 보여서 안 쓴다 — 사용자가 "무한스크롤 하지
      // 말고, 사진을 키워서 맵을 길게" 해달라고 명시했다. 가로가 많이 늘어나 다소 눌려 보일 수 있다.
      background = scene.add.tileSprite(0, 0, width, height, backgroundKey);
      background.setOrigin(0, 0);
      background.setTileScale(width / BACKGROUND_SOURCE.width, height / BACKGROUND_SOURCE.height);
    }
    background.setDepth(DEPTH.background);
  }

  // 구름 띠. 배경 그림 속 구름은 정적이라 그 위에 옅게 겹쳐 얹고 흘려서 하늘이 살아있게 한다.
  // 배경이 없는 방(보스방 등)에는 뜬금없이 하늘만 떠 있을 수 있어 배경이 있을 때만 만든다.
  let clouds: Phaser.GameObjects.TileSprite | undefined;
  if (backgroundKey) {
    const cloudScale = 260 / CLOUD_SOURCE.height;
    clouds = scene.add.tileSprite(0, 0, width, 260, TEXTURE.clouds);
    clouds.setOrigin(0, 0);
    clouds.setTileScale(cloudScale, cloudScale);
    clouds.setDepth(DEPTH.clouds);
    clouds.setBlendMode(Phaser.BlendModes.ADD);
    clouds.setAlpha(0.35);
  }

  const solids = scene.physics.add.staticGroup();

  // 틈(gaps)을 기준으로 바닥을 조각낸다. 틈이 없으면 통짜 한 장이다.
  const floorSegments: { x: number; width: number }[] = [];
  {
    const sortedGaps = [...(layout?.gaps ?? [])].sort((a, b) => a.x - b.x);
    let cursor = 0;
    for (const gap of sortedGaps) {
      if (gap.x > cursor) floorSegments.push({ x: cursor, width: gap.x - cursor });
      cursor = gap.x + gap.width;
    }
    if (cursor < width) floorSegments.push({ x: cursor, width: width - cursor });
  }

  for (const segment of floorSegments) {
    const floor = solids.create(
      segment.x + segment.width / 2,
      floorY + FLOOR_HEIGHT / 2,
      TEXTURE.solid,
    ) as Phaser.Physics.Arcade.Sprite;
    floor.setDisplaySize(segment.width, FLOOR_HEIGHT).refreshBody();

    if (floorTileKey) {
      // 충돌은 위 단색 바닥이 맡는다. 이건 그 위에 얹는 장식(타일 반복)일 뿐이다.
      const cap = scene.add.tileSprite(
        segment.x,
        floorY,
        segment.width,
        floorTileHeight,
        floorTileKey,
      );
      cap.setOrigin(0, 0);
      cap.setDepth(DEPTH.floor);
      // 타일 이음매가 조각 시작점마다 리셋되지 않게 방 좌표 기준으로 밀어 둔다.
      cap.setTilePosition(segment.x, 0);
      // 원본 돌바닥은 무채색 회갈색이라 방의 붉은 톤과 겉돈다. 사용자 지정 색 기준으로
      // 위 밝음 → 아래 어두움 코너 틴트를 걸어 세로 그라데이션을 만든다.
      cap.setTint(tintTop, tintTop, tintBottom, tintBottom);
    }
  }

  // 공중 발판. 아래·옆에서 통과하고 위에서만 밟는 원웨이 플랫폼이다 —
  // 옆면이 막히면 좁은 방에서 발판이 벽처럼 굴어 이동이 답답해진다.
  const platforms = layout?.platforms ?? [];
  for (const platform of platforms) {
    const body = solids.create(
      platform.x + platform.width / 2,
      platform.y,
      TEXTURE.solid,
    ) as Phaser.Physics.Arcade.Sprite;
    body.setDisplaySize(platform.width, 18).refreshBody();
    const arcade = body.body as Phaser.Physics.Arcade.StaticBody;
    arcade.checkCollision.down = false;
    arcade.checkCollision.left = false;
    arcade.checkCollision.right = false;

    if (floorTileKey) {
      const cap = scene.add.tileSprite(platform.x, platform.y - 9, platform.width, 18, floorTileKey);
      cap.setOrigin(0, 0);
      cap.setDepth(DEPTH.floor);
      // 발판은 바닥 띠보다 얇다 — 타일 세로를 눌러 얇은 판으로 보이게 한다.
      cap.setTileScale(1, 18 / floorTileHeight);
      cap.setTint(tintTop, tintTop, tintBottom, tintBottom);
    }
  }

  return {
    solids,
    enemyBodies: scene.physics.add.group(),
    // 공격체는 중력을 받지 않는다. 투사체가 바닥으로 떨어지면 안 된다.
    playerAttacks: scene.physics.add.group({ allowGravity: false }),
    enemyAttacks: scene.physics.add.group({ allowGravity: false }),
    bounds: { width, height, floorY },
    floorSegments,
    platforms,
    background,
    clouds,
  };
};

/**
 * (실험) 계단식 경사 발판.
 *
 * Phaser Arcade Physics는 진짜 비스듬한 경사 충돌을 지원하지 않는다(사각형 AABB만 다룬다).
 * 계단을 층층이 쌓아 오르는 느낌만 낸다 — 발판 하나하나는 평평한 사각형이라, 걸을 때
 * 아주 미세하게 턱턱 걸리는 감각은 남는다. 진짜 경사가 필요해지면 별도 검토가 필요하다.
 *
 * 각 칸이 바닥(`floorY`)에서부터 한 칸씩 더 높이 솟아, 옆에서 보면 계단 실루엣이 된다.
 */
export const addStaircase = (
  solids: Phaser.Physics.Arcade.StaticGroup,
  originX: number,
  floorY: number,
  steps = 6,
  stepWidth = 64,
  stepHeight = 24,
): void => {
  for (let i = 0; i < steps; i += 1) {
    const blockHeight = (i + 1) * stepHeight;
    const cx = originX + i * stepWidth + stepWidth / 2;
    const cy = floorY - blockHeight / 2;
    const step = solids.create(cx, cy, TEXTURE.solid) as Phaser.Physics.Arcade.Sprite;
    step.setDisplaySize(stepWidth, blockHeight).refreshBody();
  }
};

/**
 * (실험) 배경 장식 하나를 바닥에 붙여 놓는다.
 *
 * 충돌이 없는 순수 장식이다. 이미지마다 높이가 제각각이라, 바닥 중앙 하단(origin 0.5, 1)에
 * 맞추면 어떤 크기든 발이 바닥에 붙은 것처럼 보인다.
 */
export const addDecor = (
  scene: Phaser.Scene,
  key: string,
  x: number,
  floorY: number,
  scale = 1,
  /**
   * 배경으로 물릴지. 전투방에서는 구조물이 선명하면 적보다 눈에 먼저 들어와 시선을
   * 뺏는다 — 흐리고 어둡게 눌러 뒤로 보낸다. 튜토리얼은 볼거리가 장식뿐이라 끈다.
   */
  recede = false,
): void => {
  const image = scene.add.image(x, floorY, key);
  image.setOrigin(0.5, 1);
  image.setScale(scale);
  // 적(DEPTH.enemy)보다 뒤, 바닥 타일보다는 앞 — 바닥 위에 서 있는 것처럼 보인다.
  image.setDepth(DEPTH.decor);

  if (!recede) return;
  // 어둡게 깔아 배경 톤에 묻히게 한다. 흐림은 WebGL에서만 걸린다(Canvas는 색만 적용된다).
  image.setTint(0x6b5560);
  image.setAlpha(0.85);
  if (scene.game.renderer.type === Phaser.WEBGL) {
    image.postFX.addBlur(1, 2, 2, 1.1);
  }
};
