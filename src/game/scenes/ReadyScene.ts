/**
 * 시작 화면. 조작 안내를 보여주고 첫 방으로 넘어간다.
 *
 * 안내 텍스트는 임시다. OQ-004(키 바인딩)와 OQ-021(표기 언어)이 확정되면 다듬는다.
 * 사운드는 사용자 입력 이후 활성화한다. (CLAUDE.md 배포 규칙)
 */

import Phaser from "phaser";

import { KEY_BINDINGS } from "../config/inputConfig";
import { VIEWPORT } from "../config/gameConfig";
import { FIXED_ROOM_SEQUENCE } from "../data/rooms";
import { runState } from "../systems/RunState";

export class ReadyScene extends Phaser.Scene {
  constructor() {
    super("Ready");
  }

  create(): void {
    runState.setPhase("READY");

    const centerX = VIEWPORT.width / 2;

    this.add
      .text(centerX, VIEWPORT.height * 0.32, "PROJECT NULL", {
        fontFamily: "monospace",
        fontSize: "56px",
        color: "#e9edf5",
      })
      .setOrigin(0.5);

    const guide = [
      `이동 ${KEY_BINDINGS.MOVE_LEFT} / ${KEY_BINDINGS.MOVE_RIGHT}`,
      `점프 ${KEY_BINDINGS.JUMP}    대시 ${KEY_BINDINGS.DASH}`,
      `공격 ${KEY_BINDINGS.ATTACK}    모드 전환 ${KEY_BINDINGS.SWITCH_MODE}`,
      `디버그 ${KEY_BINDINGS.TOGGLE_DEBUG}`,
    ].join("\n");

    this.add
      .text(centerX, VIEWPORT.height * 0.52, guide, {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#8b95a7",
        align: "center",
        lineSpacing: 10,
      })
      .setOrigin(0.5);

    this.add
      .text(centerX, VIEWPORT.height * 0.78, "아무 키나 눌러 시작", {
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#6fd3ff",
      })
      .setOrigin(0.5);

    this.input.keyboard?.once("keydown", () => this.startRun());
    this.input.once("pointerdown", () => this.startRun());
  }

  private startRun(): void {
    runState.reset(this.time.now);
    this.scene.start("Combat", { roomId: FIXED_ROOM_SEQUENCE[0] });
  }
}
