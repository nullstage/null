/**
 * Phaser 게임 인스턴스 생성.
 *
 * Phaser는 `window`를 요구하므로 정적 프리렌더 중에 실행되면 안 된다. (DEC-005)
 * 반드시 브라우저에서만, `GameCanvas`의 `ssr: false` 동적 임포트를 통해 호출한다.
 *
 * 결과 화면은 React 패널이라 Phaser 씬으로 만들지 않는다. (DEC-006)
 */

import Phaser from "phaser";

import { eventBus } from "./EventBus";
import { VIEWPORT } from "./config/gameConfig";
import { BootScene } from "./scenes/BootScene";
import { BossScene } from "./scenes/BossScene";
import { CombatScene } from "./scenes/CombatScene";
import { ReadyScene } from "./scenes/ReadyScene";
import { HitFxPipeline } from "./systems/CombatVfx";
import { runState } from "./systems/RunState";

/** 일시정지가 의미 있는 씬. 시작 화면은 멈출 것이 없다. */
const PAUSABLE_SCENES = ["Combat", "Boss"] as const;

/**
 * 일시정지 메뉴(React)와 씬을 잇는다.
 *
 * React는 씬을 직접 만지지 않는다. (DEC-006) 여기가 이벤트를 씬 제어로 바꾸는 유일한 지점이다.
 * 씬마다 같은 구독을 달면 방을 넘길 때 restart 되면서 구독이 끊기거나 중복된다.
 */
const wireLifecycle = (game: Phaser.Game): void => {
  const forEachLive = (fn: (key: string) => void) => {
    for (const key of PAUSABLE_SCENES) {
      if (game.scene.isActive(key) || game.scene.isPaused(key)) fn(key);
    }
  };

  const unsubscribe = [
    eventBus.on("game:pause", () => forEachLive((key) => game.scene.pause(key))),
    eventBus.on("game:resume", () => forEachLive((key) => game.scene.resume(key))),
    eventBus.on("run:abort", () => {
      // 멈춘 채로 stop하면 다음에 되살아날 때 타이머가 어긋난다. 먼저 풀고 내린다.
      forEachLive((key) => {
        game.scene.resume(key);
        game.scene.stop(key);
      });
      runState.reset(game.loop.time);
      game.scene.start("Ready");
    }),
  ];

  game.events.once(Phaser.Core.Events.DESTROY, () => {
    for (const off of unsubscribe) off();
  });
};

export const createGame = (parent: HTMLElement): Phaser.Game => {
  const game = new Phaser.Game({
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
    // 포스트 파이프라인은 게임 생성 시점에만 등록할 수 있다. 씬에서 나중에 붙이지 못한다.
    pipeline: { HitFx: HitFxPipeline } as unknown as Phaser.Types.Core.PipelineConfig,
    scene: [BootScene, ReadyScene, CombatScene, BossScene],
  });

  wireLifecycle(game);
  return game;
};
