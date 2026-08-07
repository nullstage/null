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

import type Phaser from "phaser";

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
  boss: "px_boss",
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
    jump: { row: 2, frames: 6, fps: 9, loop: false },
    dash: { row: 3, frames: 6, fps: 16, loop: false },
    /**
     * 왼손 검 3연타. 타마다 그림이 달라야 콤보가 콤보로 읽힌다.
     * 1타 수평 베기 → 2타 올려 베기 → 3타 내려찍기.
     *
     * `frameDurations`는 프레임마다 **더해지는** 시간이다(Phaser 규칙).
     * 모든 프레임을 같은 길이로 재생하면 그림이 아무리 좋아도 정적으로 보인다.
     * 윈드업에서 뜸을 들이고 베는 순간은 최소 시간으로 지나가야 힘이 실린다.
     */
    attack1: { row: 4, frames: 6, fps: 26, loop: false, frameDurations: [55, 40, 0, 0, 40, 80] },
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

/** 바닥 두께. 스폰 높이 계산의 기준이 된다. */
export const FLOOR_HEIGHT = 48;

/** `background` 텍스처(`ruins-dusk.png`)의 원본 픽셀 크기. 비율 계산에 쓴다. */
const BACKGROUND_SOURCE = { width: 1774, height: 887 };

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
): CombatArena => {
  const { width, height } = viewport;
  const floorY = height - FLOOR_HEIGHT;

  if (backgroundKey) {
    // 모든 것보다 뒤에 있어야 한다. 다른 오브젝트는 깊이 0 이상을 쓰므로 음수로 확실히 뺀다.
    const scale = height / BACKGROUND_SOURCE.height;
    const scaledWidth = BACKGROUND_SOURCE.width * scale;

    // TileSprite를 쓴다 — 이미지는 정적이지만, tilePositionX를 아주 천천히 흘려서
    // 그림 속 구름이 떠다니는 것처럼 보이게 한다(사용자 요청). 방이 넓어 반복 이음매가
    // 보일 수 있는 지점까지 흐르려면 수십 분이 걸려 실제 플레이에서는 티가 안 난다.
    let background: Phaser.GameObjects.TileSprite;
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
    background.setDepth(-10);
    scene.tweens.add({
      targets: background,
      tilePositionX: "+=40",
      duration: 40000,
      repeat: -1,
      ease: "linear",
    });
  }

  const solids = scene.physics.add.staticGroup();
  const floor = solids.create(
    width / 2,
    floorY + FLOOR_HEIGHT / 2,
    TEXTURE.solid,
  ) as Phaser.Physics.Arcade.Sprite;
  floor.setDisplaySize(width, FLOOR_HEIGHT).refreshBody();

  if (floorTileKey) {
    // 충돌은 위 단색 바닥이 그대로 맡는다. 이건 그 위에 얹는 장식(타일 반복)일 뿐이다.
    const cap = scene.add.tileSprite(0, floorY, width, floorTileHeight, floorTileKey);
    cap.setOrigin(0, 0);
    cap.setDepth(1);
  }

  return {
    solids,
    enemyBodies: scene.physics.add.group(),
    // 공격체는 중력을 받지 않는다. 투사체가 바닥으로 떨어지면 안 된다.
    playerAttacks: scene.physics.add.group({ allowGravity: false }),
    enemyAttacks: scene.physics.add.group({ allowGravity: false }),
    bounds: { width, height, floorY },
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
): void => {
  const image = scene.add.image(x, floorY, key);
  image.setOrigin(0.5, 1);
  image.setScale(scale);
  // 플레이어(depth 10)보다는 뒤, 바닥 타일(depth 1)보다는 앞 — 바닥 위에 서 있는 것처럼 보인다.
  image.setDepth(2);
};
