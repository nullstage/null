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
import { AmbientLightPipeline, GlitchFxPipeline, HitFxPipeline } from "./systems/CombatVfx";
import { runState } from "./systems/RunState";
import { stopRoomBgm } from "./systems/audio";

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
      // Phaser의 사운드 매니저는 게임 전역이라 씬을 stop해도 BGM이 계속 돈다.
      // 그대로 두면 시작 화면에서 전투 BGM과 타이틀 BGM이 겹쳐 울린다.
      stopRoomBgm(game);
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
      // 세로는 중앙 정렬하지 않는다. 창 비율이 16:9와 다를 때 남는 여백을 위아래로
      // 나누면 위쪽에 빈 줄이 생겨 하늘 그림이 잘린 것처럼 보인다. 캔버스를 맨 위에
      // 붙이면(가로만 중앙 정렬) 남는 여백이 전부 아래로 몰려 배경이 위까지 꽉 찬다.
      autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
    },
    physics: {
      default: "arcade",
      arcade: {
        gravity: { x: 0, y: 1400 },
        debug: false,
      },
    },
    // 포스트 파이프라인은 게임 생성 시점에만 등록할 수 있다. 씬에서 나중에 붙이지 못한다.
    pipeline: {
      HitFx: HitFxPipeline,
      AmbientLight: AmbientLightPipeline,
      GlitchFx: GlitchFxPipeline,
    } as unknown as Phaser.Types.Core.PipelineConfig,
    scene: [BootScene, ReadyScene, CombatScene, BossScene],
  });

  wireLifecycle(game);

  // 개발용: 콘솔에서 씬을 직접 조작해 테스트할 수 있게 한다(예: 보스전 즉시 진입).
  // runState 노출과 같은 패턴이며 프로덕션 빌드에는 포함하지 않는다.
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
    (window as unknown as { phaserGame: Phaser.Game }).phaserGame = game;
  }

  return game;
};
