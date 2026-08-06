/**
 * Phaser 게임 인스턴스 생성.
 *
 * Phaser는 `window`를 요구하므로 정적 프리렌더 중에 실행되면 안 된다. (DEC-005)
 * 반드시 브라우저에서만, `GameCanvas`의 `ssr: false` 동적 임포트를 통해 호출한다.
 *
 * 결과 화면은 React 패널이라 Phaser 씬으로 만들지 않는다. (DEC-006)
 */

import Phaser from "phaser";

import { VIEWPORT } from "./config/gameConfig";
import { BootScene } from "./scenes/BootScene";
import { BossScene } from "./scenes/BossScene";
import { CombatScene } from "./scenes/CombatScene";
import { ReadyScene } from "./scenes/ReadyScene";

export const createGame = (parent: HTMLElement): Phaser.Game =>
  new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    backgroundColor: "#12151c",
    pixelArt: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 1400 },
        debug: false,
      },
    },
    scene: [BootScene, ReadyScene, CombatScene, BossScene],
  });
