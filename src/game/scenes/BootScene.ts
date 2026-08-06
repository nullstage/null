/**
 * 에셋 로딩과 초기화.
 *
 * OQ-024 미결정 — 아트 에셋이 아직 없다. 지금은 도형 플레이스홀더 텍스처만 만든다.
 * 에셋이 들어오면 `preload`에서 `assetPath()`로 경로를 만들어 로드한다.
 * GitHub Pages 하위 경로 때문에 상대 경로를 직접 쓰면 배포에서 깨진다. (DEC-005)
 */

import Phaser from "phaser";

import { eventBus } from "../EventBus";
import { runState } from "../systems/RunState";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload(): void {
    // 예: this.load.image("player", assetPath("sprites/player.png"));
    this.createPlaceholderTextures();
  }

  create(): void {
    runState.reset(this.time.now);
    runState.setPhase("READY");
    this.scene.start("Ready");
  }

  /** 에셋 없이도 화면에서 형태를 구분할 수 있게 단색 사각형 텍스처를 만든다. */
  private createPlaceholderTextures(): void {
    const swatches: Record<string, number> = {
      px_player: 0x6fd3ff,
      px_chaser: 0xff6b6b,
      px_ranged: 0xffd166,
      px_mobility: 0xb388ff,
      px_boss: 0xff3b6b,
      px_ground: 0x2a2f3a,
      px_hazard: 0xff8a3d,
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
