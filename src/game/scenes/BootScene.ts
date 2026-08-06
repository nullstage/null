/**
 * 에셋 로딩과 초기화.
 *
 * OQ-024 미결정 — 아트 에셋이 아직 없다. 지금은 도형 플레이스홀더 텍스처만 만든다.
 * 에셋이 들어오면 `preload`에서 `assetPath()`로 경로를 만들어 로드한다.
 * GitHub Pages 하위 경로 때문에 상대 경로를 직접 쓰면 배포에서 깨진다. (DEC-005)
 */

import Phaser from "phaser";

import { eventBus } from "../EventBus";
import { assetPath } from "../config/gameConfig";
import { runState } from "../systems/RunState";
import {
  PLAYER_SPRITE,
  SILHOUETTE,
  TEXTURE,
  playerAnimKey,
  type PlayerAnimState,
} from "../types/combat";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload(): void {
    // 적과 보스는 아직 도형이다. 플레이어만 스프라이트로 교체됐다. (OQ-024)
    this.load.spritesheet(PLAYER_SPRITE.key, assetPath(PLAYER_SPRITE.path), {
      frameWidth: PLAYER_SPRITE.frameWidth,
      frameHeight: PLAYER_SPRITE.frameHeight,
    });
    this.createPlaceholderTextures();
  }

  create(): void {
    this.registerPlayerAnimations();
    runState.reset(this.time.now);
    runState.setPhase("READY");
    this.scene.start("Ready");
  }

  /**
   * 플레이어 애니메이션 등록.
   *
   * 씬마다 다시 만들지 않고 부팅 때 한 번만 만든다. 전투방과 보스방이 같은 것을 쓴다.
   * 시트가 6열이므로 프레임 번호는 `행 * 6 + 열`로 계산한다.
   */
  private registerPlayerAnimations(): void {
    for (const [state, spec] of Object.entries(PLAYER_SPRITE.states)) {
      const key = playerAnimKey(state as PlayerAnimState);
      if (this.anims.exists(key)) continue;

      const start = spec.row * PLAYER_SPRITE.columns;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(PLAYER_SPRITE.key, {
          start,
          end: start + spec.frames - 1,
        }),
        frameRate: spec.fps,
        repeat: spec.loop ? -1 : 0,
      });
    }
  }

  /**
   * 에셋 없이도 형태를 구분할 수 있게 단색 사각형 텍스처를 만든다. (OQ-024)
   * 색은 `types/combat.ts`의 팔레트를 따른다. 스프라이트가 들어오면 이 함수만 걷어내면 된다.
   */
  private createPlaceholderTextures(): void {
    const swatches: Record<string, number> = {
      [TEXTURE.player]: SILHOUETTE.player,
      [TEXTURE.playerAttack]: SILHOUETTE.playerAttack,
      [TEXTURE.chaser]: SILHOUETTE.chaser,
      [TEXTURE.ranged]: SILHOUETTE.ranged,
      [TEXTURE.mobility]: SILHOUETTE.mobility,
      [TEXTURE.boss]: SILHOUETTE.boss,
      [TEXTURE.enemyAttack]: SILHOUETTE.enemyAttack,
      [TEXTURE.telegraph]: SILHOUETTE.telegraph,
      [TEXTURE.hazard]: SILHOUETTE.hazard,
      [TEXTURE.solid]: SILHOUETTE.solid,
    };

    for (const [key, color] of Object.entries(swatches)) {
      if (this.textures.exists(key)) continue;
      const graphics = this.make.graphics({ x: 0, y: 0 }, false);
      graphics.fillStyle(color, 1);
      graphics.fillRect(0, 0, 8, 8);
      graphics.generateTexture(key, 8, 8);
      graphics.destroy();
    }
  }

  /** 씬 정리 시 이벤트 버스 구독이 누적되지 않도록 한다. */
  shutdown(): void {
    eventBus.emit("phase:change", { phase: runState.phase });
  }
}
