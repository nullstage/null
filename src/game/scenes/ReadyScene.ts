/**
 * READY 단계를 유지하는 씬.
 *
 * 시작 화면은 Figma 디자인 그대로 React `TitleScreen`이 그린다. (DEC-006)
 * 시작 입력도 거기서 받으므로 이 씬은 키를 직접 듣지 않는다.
 * 두 곳에서 입력을 받으면 런이 두 번 시작된다.
 *
 * 사운드는 사용자 입력 이후 활성화한다. (CLAUDE.md 배포 규칙)
 */

import Phaser from "phaser";

import { eventBus } from "../EventBus";
import { debugFlag } from "../config/gameConfig";
import { FIXED_ROOM_SEQUENCE } from "../data/rooms";
import { runState } from "../systems/RunState";

export class ReadyScene extends Phaser.Scene {
  private subscriptions: (() => void)[] = [];

  constructor() {
    super("Ready");
  }

  create(): void {
    this.subscriptions = [];
    runState.setPhase("READY");

    const unsubscribe = eventBus.on("ui:continue", () => {
      unsubscribe();
      this.startRun();
    });
    this.subscriptions.push(unsubscribe);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  private startRun(): void {
    runState.reset(this.time.now);

    // 개발·시연 전용 보스 직행(`?boss=1`). 앞의 방 세 개를 매번 지나지 않고
    // 보스전만 확인하기 위한 것이다. 성향 가중치는 reset이 넣어둔 기본값을 그대로 쓴다
    // (분석을 거치지 않았으므로 특정 성향으로 치우치면 안 된다).
    if (debugFlag("boss")) {
      this.scene.start("Boss");
      return;
    }

    this.scene.start("Combat", { roomId: FIXED_ROOM_SEQUENCE[0] });
  }

  private cleanup(): void {
    for (const unsubscribe of this.subscriptions) unsubscribe();
    this.subscriptions = [];
  }
}
