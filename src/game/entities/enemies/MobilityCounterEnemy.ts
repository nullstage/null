/**
 * 기동 카운터형. 반복적인 이동 습관을 카운터한다. (MVP_PLAN §2)
 * 전투 담당(팀원) 영역.
 *
 * 행동 흐름:
 *   중거리 유지 → 플레이어가 "가고 있는 쪽" 바닥에 장판 예고 → HAZARD.telegraphMs 뒤 폭발
 *
 * 대시를 처벌하는 적이 아니다. 처벌 대상은 같은 방향으로 계속 흐르는 습관이다. (DEC-004)
 *   - 장판은 예고 표시 없이 절대 터지지 않는다.
 *   - 예고를 보고 방향을 꺾으면 그대로 빗나간다. 대시로 빠져나올 수도 있다.
 *   - 제자리에 있으면 발밑에 깔리므로, 가만히 있는 것도 정답이 아니다.
 *
 * OQ-006 미결정 — 일정이 밀리면 이 적과 MOBILE 분류를 함께 삭제한다.
 */

import type Phaser from "phaser";

import { HAZARD } from "../../config/gameBalance";
import { SILHOUETTE, TEXTURE } from "../../types/combat";
import { BaseEnemy, type EnemyDeps } from "./BaseEnemy";

/** 본체 크기. 셋 중 유일하게 옆으로 넓어 실루엣이 바로 구분된다. */
const BODY_WIDTH = 46;
const BODY_HEIGHT = 38;

/** 유지하려는 거리. 붙지도 도망가지도 않고 장판만 깐다. */
const KEEP_DISTANCE_MIN = 220;
const KEEP_DISTANCE_MAX = 380;
/** 장판 설치 간격(ms). 예고 시간이 끝난 뒤부터 다시 센다. */
const PLANT_INTERVAL_MS = 1800;
/** 플레이어 진행 방향 앞쪽 이만큼에 깐다. 이동을 계속하면 걸어 들어가게 된다. */
const LEAD_DISTANCE = 150;
/** 진행 방향 추정용 감쇠 계수. 클수록 최근 움직임에 민감하다. */
const DRIFT_SMOOTHING = 0.08;
/** 이 정도도 안 움직였으면 멈춰 있는 것으로 보고 발밑에 깐다. */
const DRIFT_DEADZONE = 12;

/** 장판 크기. 폭이 좁으면 예고를 봐도 피할 이유가 없어진다. */
const HAZARD_WIDTH = 130;
const HAZARD_HEIGHT = 28;
/** 폭발 지속 시간(ms). 짧아야 지나가기가 성립한다. */
const HAZARD_ACTIVE_MS = 260;
/** 폭발 순간 부풀어 오르는 비율. */
const HAZARD_BURST_SCALE = 1.25;
const TELEGRAPH_ALPHA_FROM = 0.18;
const TELEGRAPH_ALPHA_TO = 0.6;
/** 벽 안쪽 이 범위에는 장판을 깔지 않는다. 화면 밖에 걸치면 예고가 안 보인다. */
const PLANT_MARGIN = 60;
/** 이만큼 앞의 바닥을 미리 살핀다. 추격형·견제형과 같은 값이다. */
const LEDGE_LOOKAHEAD = 24;

export class MobilityCounterEnemy extends BaseEnemy {
  private plantMs = 0;
  /** 플레이어 위치를 뒤늦게 따라가는 값. 실제 위치와의 차이가 곧 진행 방향이다. */
  private trailingX: number | null = null;
  private pendingTelegraphs = new Set<Phaser.GameObjects.Image>();

  constructor(deps: EnemyDeps) {
    super("MOBILITY_COUNTER", deps);
  }

  spawn(x: number, y: number): void {
    this.spawnBody(x, y, TEXTURE.mobility, BODY_WIDTH, BODY_HEIGHT);
  }

  update(_time: number, deltaMs: number): void {
    const body = this.sprite;
    if (!body) return;

    const player = this.getPlayerPosition();
    this.trailingX ??= player.x;
    this.trailingX += (player.x - this.trailingX) * DRIFT_SMOOTHING;

    const dx = player.x - body.x;
    const distance = Math.abs(dx);
    const speed = this.definition.moveSpeed * this.speedMultiplier;
    // 낭떠러지 앞에서는 멈춘다. 없으면 스스로 빠져 낙사하고, 그게 방 클리어 판정에
    // 들어가 MOBILE 카운터 방이 저절로 끝난다.
    const step = (direction: number): number =>
      this.hasFloorBelow(body.x + direction * LEDGE_LOOKAHEAD) ? direction * speed : 0;

    if (distance < KEEP_DISTANCE_MIN) body.setVelocityX(step(dx === 0 ? 1 : -Math.sign(dx)));
    else if (distance > KEEP_DISTANCE_MAX) body.setVelocityX(step(Math.sign(dx)));
    else body.setVelocityX(0);

    this.plantMs += deltaMs;
    if (this.plantMs >= PLANT_INTERVAL_MS) {
      this.plantMs = 0;
      this.plantHazard(player.x);
    }
  }

  destroy(): void {
    // 아직 안 터진 예고는 함께 걷어낸다. 예고만 남고 주인이 없으면 읽을 수 없는 신호가 된다.
    for (const telegraph of this.pendingTelegraphs) {
      this.scene.tweens.killTweensOf(telegraph);
      telegraph.destroy();
    }
    this.pendingTelegraphs.clear();
    super.destroy();
  }

  // ────────────────────────────── 장판 ──────────────────────────────

  /** 진행 방향 앞쪽에 예고를 깔고, 예고가 끝나야 폭발시킨다. */
  private plantHazard(playerX: number): void {
    const drift = playerX - (this.trailingX ?? playerX);
    const lead = Math.abs(drift) < DRIFT_DEADZONE ? 0 : Math.sign(drift) * LEAD_DISTANCE;

    const { width, floorY } = this.arena.bounds;
    const x = Math.min(Math.max(playerX + lead, PLANT_MARGIN), width - PLANT_MARGIN);
    const y = floorY - HAZARD_HEIGHT / 2;

    const telegraph = this.scene.add.image(x, y, TEXTURE.telegraph);
    telegraph.setDisplaySize(HAZARD_WIDTH, HAZARD_HEIGHT);
    telegraph.setAlpha(TELEGRAPH_ALPHA_FROM);
    this.pendingTelegraphs.add(telegraph);

    // 폭발은 이 트윈이 끝나야 일어난다. 씬이 내려가면 트윈째 취소되어 뒤늦게 터지지 않는다.
    this.scene.tweens.add({
      targets: telegraph,
      alpha: TELEGRAPH_ALPHA_TO,
      duration: HAZARD.telegraphMs,
      onComplete: () => {
        this.pendingTelegraphs.delete(telegraph);
        telegraph.destroy();
        this.detonate(x, y);
      },
    });
  }

  private detonate(x: number, y: number): void {
    const blast = this.arena.enemyAttacks.create(
      x,
      y,
      TEXTURE.hazard,
    ) as Phaser.Physics.Arcade.Sprite;
    blast.setDisplaySize(HAZARD_WIDTH, HAZARD_HEIGHT);
    blast.setTint(SILHOUETTE.hazard);
    blast.setData("damage", HAZARD.damage);
    // 패링 반사용. 이미 죽은 뒤 터지는 함정일 수도 있는데, 그건 BaseEnemy.takeDamage가
    // defeated 가드로 알아서 무시한다.
    blast.setData("source", this);

    this.scene.tweens.add({
      targets: blast,
      scaleY: blast.scaleY * HAZARD_BURST_SCALE,
      alpha: 0,
      duration: HAZARD_ACTIVE_MS,
      onComplete: () => blast.destroy(),
    });
  }
}
