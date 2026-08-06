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
    this.scene.start("Combat", { roomId: FIXED_ROOM_SEQUENCE[0] });
  }

  private cleanup(): void {
    for (const unsubscribe of this.subscriptions) unsubscribe();
    this.subscriptions = [];
  }
}
