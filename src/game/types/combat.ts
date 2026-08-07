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
    shoot1: { row: 7, frames: 5, fps: 26, loop: false, frameDurations: [45, 25, 0, 35, 70] },
    shoot2: { row: 8, frames: 5, fps: 26, loop: false, frameDurations: [20, 0, 25, 40, 65] },
    shoot3: {
      row: 9,
      frames: 6,
      fps: 24,
      loop: false,
      frameDurations: [50, 30, 0, 45, 70, 100],
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

/**
 * 바닥과 충돌 그룹을 만든다. 전투방과 보스방이 같은 구조를 쓴다.
 * 발판이 필요한 방 템플릿은 여기 만든 `solids`에 덧붙이면 된다. (MVP_PLAN §2-3)
 */
export const createArena = (
  scene: Phaser.Scene,
  viewport: { width: number; height: number },
): CombatArena => {
  const { width, height } = viewport;
  const floorY = height - FLOOR_HEIGHT;

  const solids = scene.physics.add.staticGroup();
  const floor = solids.create(
    width / 2,
    floorY + FLOOR_HEIGHT / 2,
    TEXTURE.solid,
  ) as Phaser.Physics.Arcade.Sprite;
  floor.setDisplaySize(width, FLOOR_HEIGHT).refreshBody();

  return {
    solids,
    enemyBodies: scene.physics.add.group(),
    // 공격체는 중력을 받지 않는다. 투사체가 바닥으로 떨어지면 안 된다.
    playerAttacks: scene.physics.add.group({ allowGravity: false }),
    enemyAttacks: scene.physics.add.group({ allowGravity: false }),
    bounds: { width, height, floorY },
  };
};
