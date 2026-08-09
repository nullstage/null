/**
 * 적 공통 뼈대.
 *
 * 이 파일과 하위 3종은 전투 담당(팀원)의 영역이다. (DEC-007)
 * 시스템 담당이 요구하는 계약은 두 가지뿐이다.
 *   1. 사망 시 반드시 `defeat()`를 거친다. RoomController의 클리어 판정이 여기에 걸려 있다.
 *   2. 체력·공격력은 `data/enemies.ts` 정의만 사용한다. 분석 결과로 이 값을 올리지 않는다. (DEC-004)
 *
 * 3종이 공유하는 것은 "몸을 만들고, 맞으면 반응하고, 죽으면 사라지는" 부분뿐이다.
 * 행동은 각 하위 클래스가 전부 따로 가진다. 역할이 눈으로 구분돼야 하기 때문이다. (MVP_PLAN §2)
 */

import Phaser from "phaser";

import { ENEMIES, type EnemyDefinition } from "../../data/enemies";
import { ashRise, deathBurst } from "../../systems/CombatVfx";
import { DEPTH, type CombatArena } from "../../types/combat";
import type { EnemyType } from "../../types/game";

/** 스폰 팝인 시간(ms). 적이 한 프레임 만에 나타나면 어디서 나왔는지 인지하지 못한다. */
const SPAWN_POP_MS = 180;
/** 스폰 시작 크기 비율. 0으로 두면 물리 바디까지 사라져 바닥을 통과할 수 있다. */
const SPAWN_POP_SCALE = 0.6;
/** 피격 흰색 플래시 유지 시간(ms). 짧아야 타격이 "찍히듯" 보인다. */
const HIT_FLASH_MS = 90;

/** 죽을 때 터지는 파편의 색. 역할과 무관하게 검게 산화하는 것으로 통일한다. */
const DEATH_COLOR = 0x0a0a0a;
/** 피격 스케일 펀치. 도형뿐이라 크기 변화가 유일한 타격감이다. */
const HIT_PUNCH_MS = 90;
const HIT_PUNCH_SCALE = 1.22;
/** 사망 축소·페이드 시간(ms). 파티클 대신 쓴다. */
const DEATH_MS = 240;
/** 잔상 한 장의 수명(ms)과 시작 투명도. */
const AFTERIMAGE_MS = 200;
const AFTERIMAGE_ALPHA = 0.45;

export interface EnemyDeps {
  scene: Phaser.Scene;
  /**
   * 지형과 공격체 그룹.
   * 본체는 `arena.enemyBodies`에, 투사체·장판은 `arena.enemyAttacks`에 넣는다.
   * 본체에는 반드시 `setData("enemy", this)`를 걸어야 씬이 피해를 전달할 수 있다.
   */
  arena: CombatArena;
  /** 플레이어의 현재 위치. 추격·조준에 쓴다. 플레이어 객체를 직접 참조하지 않는다. */
  getPlayerPosition: () => { x: number; y: number };
  /** 사망 시 RoomController에 알린다. 이 호출이 빠지면 방이 끝나지 않는다.
   *  좌표는 죽은 자리 — 씬이 그 자리에 그림자 조각을 떨어뜨린다. */
  onDefeated: (x: number, y: number) => void;
}

export abstract class BaseEnemy {
  readonly definition: EnemyDefinition;
  protected readonly scene: Phaser.Scene;
  protected readonly arena: CombatArena;
  /** 플레이어 위치는 이 함수로만 얻는다. Player를 직접 참조하지 않는다. */
  protected readonly getPlayerPosition: () => { x: number; y: number };
  private readonly onDefeated: (x: number, y: number) => void;

  /** 본체. 스프라이트가 들어오면 텍스처 키만 바뀐다. */
  sprite: Phaser.Physics.Arcade.Sprite | null = null;

  hp: number;
  private defeated = false;
  /** 상태 표시용 tint. 피격 플래시가 끝나면 이 색으로 되돌린다. */
  private stateTint: number | null = null;
  /** 냉기 속성 피격 시 낮아진다. 이동 속도를 쓰는 곳(하위 클래스)이 여기 곱해서 읽는다. */
  protected speedMultiplier = 1;

  protected constructor(type: EnemyType, deps: EnemyDeps) {
    this.definition = ENEMIES[type];
    this.scene = deps.scene;
    this.arena = deps.arena;
    this.getPlayerPosition = deps.getPlayerPosition;
    this.onDefeated = deps.onDefeated;
    this.hp = this.definition.hp;
  }

  abstract spawn(x: number, y: number): void;

  abstract update(time: number, deltaMs: number): void;

  /**
   * 본체 생성. 3종이 크기만 다르게 호출한다.
   *
   * 바닥 collider는 씬이 `enemyBodies` 그룹 전체에 이미 걸어두었으므로 여기서 다시 걸지 않는다.
   * 같은 충돌을 두 곳에서 관리하면 나중에 어느 쪽이 밀어낸 건지 추적할 수 없다. (CombatScene.wireCollisions)
   */
  protected spawnBody(
    x: number,
    y: number,
    texture: string,
    width: number,
    height: number,
    /**
     * 스프라이트시트용 배치 정보. 원본 셀(64px)에 여백이 많아 setDisplaySize로 셀을
     * 통째로 늘리면 그림이 작아지고, 발이 셀 하단보다 위에 있어 떠 보인다.
     * scale로 그림을 키우고, 히트박스(width/height는 월드 크기)를 그림 위치
     * (anchorX=내용 가로 중심, anchorY=발끝 y — 둘 다 원본 텍스처 px)에 맞춘다.
     */
    sheet?: { scale: number; anchorX: number; anchorY: number },
  ): Phaser.Physics.Arcade.Sprite {
    const body = this.arena.enemyBodies.create(x, y, texture) as Phaser.Physics.Arcade.Sprite;
    // depth를 지정하지 않으면 기본값 0이라 장식(DEPTH.decor)에 가린다.
    body.setDepth(DEPTH.enemy);
    if (sheet) {
      body.setScale(sheet.scale);
      const sizeW = width / sheet.scale;
      const sizeH = height / sheet.scale;
      body.setSize(sizeW, sizeH);
      body.setOffset(sheet.anchorX - sizeW / 2, sheet.anchorY - sizeH);
      // 검은 실루엣이 어두운 배경에 묻히지 않게 붉은 글로우를 두른다. (WebGL 전용)
      if (this.scene.game.renderer.type === Phaser.WEBGL) {
        body.postFX.addGlow(0xff5560, 3, 0);
      }
    } else {
      body.setDisplaySize(width, height);
    }
    // 화면 밖으로 밀려나면 플레이어가 처리할 수 없는 적이 된다.
    body.setCollideWorldBounds(true);
    // 씬이 이 데이터로만 피해 대상을 찾는다. 빠지면 적이 무적이 된다.
    body.setData("enemy", this);
    this.sprite = body;

    const { scaleX, scaleY } = body;
    body.setScale(scaleX * SPAWN_POP_SCALE, scaleY * SPAWN_POP_SCALE);
    this.scene.tweens.add({
      targets: body,
      scaleX,
      scaleY,
      duration: SPAWN_POP_MS,
      ease: "Back.easeOut",
    });

    return body;
  }

  takeDamage(amount: number): void {
    if (this.defeated) return;
    // 죽는 타격도 맞았다는 게 보여야 한다. 감산보다 먼저 연출한다.
    this.playHitFeedback();
    this.hp -= amount;
    if (this.hp <= 0) this.defeat();
  }

  /** 사망 처리. 두 번 호출돼도 클리어 판정이 두 번 진행되지 않는다. */
  protected defeat(): void {
    if (this.defeated) return;
    this.defeated = true;
    // destroy 전에 죽은 자리를 붙잡아 둔다 — 조각 드랍의 기준점이다.
    const x = this.sprite?.x ?? 0;
    const y = this.sprite?.y ?? 0;
    this.playDeathEffect();
    this.destroy();
    this.onDefeated(x, y);
  }

  get isDefeated(): boolean {
    return this.defeated;
  }

  /**
   * 이 x좌표 아래에 바닥 조각이 있는지. 없으면 낭떠러지 위다.
   * 랜덤 지형(낭떠러지) 도입 이후 적이 앞뒤 안 보고 쫓아오다 스스로 빠지는 것을
   * 막는 데 쓴다 — 플레이어처럼 점프해서 건너지 못하니 아예 멈춰야 한다.
   */
  protected hasFloorBelow(x: number): boolean {
    return this.arena.floorSegments.some((segment) => x >= segment.x && x <= segment.x + segment.width);
  }

  /** 냉기 속성 적중. 이동 속도를 잠시 낮춘다. 겹쳐 걸리면 마지막 것으로 덮어쓴다. */
  applySlow(factor: number, durationMs: number): void {
    if (this.defeated) return;
    this.speedMultiplier = factor;
    this.scene.time.delayedCall(durationMs, () => {
      if (!this.defeated) this.speedMultiplier = 1;
    });
  }

  destroy(): void {
    this.sprite?.destroy();
    this.sprite = null;
  }

  // ────────────────────────────── 연출 ──────────────────────────────

  /**
   * 상태 표시색. 예고 중에는 예고색, 평소에는 원래 색이다.
   * setTint(곱연산)는 검은 실루엣 스프라이트에선 아무 변화가 없다 —
   * 실루엣을 통째로 칠하는 setTintFill을 써야 예고가 보인다.
   */
  protected setStateTint(color: number | null): void {
    this.stateTint = color;
    if (!this.sprite) return;
    if (color === null) this.sprite.clearTint();
    else this.sprite.setTintFill(color);
  }

  /** 돌진처럼 빠른 이동에 남기는 잔상. 도형이라 속도감을 이걸로만 표현할 수 있다. */
  protected spawnAfterimage(): void {
    const body = this.sprite;
    if (!body) return;

    const ghost = this.scene.add.image(body.x, body.y, body.texture.key);
    ghost.setScale(body.scaleX, body.scaleY);
    ghost.setTintFill(this.stateTint ?? 0xffffff);
    ghost.setAlpha(AFTERIMAGE_ALPHA);
    ghost.setDepth(body.depth - 1);
    this.scene.tweens.add({
      targets: ghost,
      alpha: 0,
      duration: AFTERIMAGE_MS,
      onComplete: () => ghost.destroy(),
    });
  }

  private playHitFeedback(): void {
    const body = this.sprite;
    if (!body) return;

    body.setTintFill(0xffffff);
    this.scene.time.delayedCall(HIT_FLASH_MS, () => {
      if (!body.active) return;
      if (this.stateTint === null) body.clearTint();
      else body.setTintFill(this.stateTint);
    });

    // Arcade Body는 매 프레임 scaleY로 충돌 박스 높이·위치를 다시 계산한다(Player.punch와
    // 같은 원인, 그쪽에서 이미 문서화됨). 접지 중인 적을 세로로도 스쿼시하면 그 프레임에
    // 박스가 바닥과 어긋나 파묻히거나 뜬 것처럼 보인다 — 가로만 스쿼시한다.
    const { scaleX, scaleY } = body;
    this.scene.tweens.add({
      targets: body,
      scaleX: scaleX * HIT_PUNCH_SCALE,
      duration: HIT_PUNCH_MS,
      yoyo: true,
      onComplete: () => {
        // yoyo가 끝나도 부동소수 오차가 남는다. 원래 크기로 확실히 되돌린다.
        if (body.active) body.setScale(scaleX, scaleY);
      },
    });
  }

  /**
   * 사망 연출. 본체를 물리에서 떼어내 축소·페이드시킨 뒤 지운다.
   * 떼어내지 않으면 죽은 적이 사라지는 동안에도 접촉 피해를 준다.
   */
  private playDeathEffect(): void {
    const body = this.sprite;
    if (!body) return;

    // 줄어들며 사라지기만 하면 "죽었다"가 아니라 "없어졌다"로 보인다.
    // 파편과 링이 그 자리에 터져야 마지막 한 대가 언제 들어갔는지 읽힌다.
    // 몸을 빙글 돌리는 스핀 대신 재가 떠오르며 흩어지는 쪽이 "산화"에 더 맞는다는 지적 반영.
    deathBurst(this.scene, body.x, body.y, DEATH_COLOR);
    ashRise(this.scene, body.x, body.y, DEATH_COLOR);

    // `destroy()`가 이 스프라이트를 즉시 지우지 않도록 참조를 먼저 끊는다.
    this.sprite = null;
    this.arena.enemyBodies.remove(body);
    body.disableBody(false, false);

    this.scene.tweens.add({
      targets: body,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: DEATH_MS,
      ease: "Quad.easeIn",
      onComplete: () => body.destroy(),
    });
  }
}
