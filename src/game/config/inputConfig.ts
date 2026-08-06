/**
 * 키 바인딩.
 *
 * OQ-004 미결정 — 아래는 임시 매핑이다. 확정되면 이 파일만 고친다.
 * 전투 구현(팀원 담당)은 키 코드를 하드코딩하지 말고 이 맵을 참조한다.
 */

export type GameAction =
  | "MOVE_LEFT"
  | "MOVE_RIGHT"
  | "JUMP"
  | "DASH"
  | "ATTACK"
  | "SWITCH_MODE"
  | "CONFIRM"
  | "TOGGLE_DEBUG"
  | "DEBUG_SKIP_ROOM";

/** Phaser의 `Phaser.Input.Keyboard.KeyCodes` 이름과 동일한 문자열을 쓴다. */
export const KEY_BINDINGS: Record<GameAction, string> = {
  MOVE_LEFT: "A",
  MOVE_RIGHT: "D",
  JUMP: "SPACE",
  DASH: "SHIFT",
  ATTACK: "J",
  SWITCH_MODE: "K",
  CONFIRM: "ENTER",
  TOGGLE_DEBUG: "F1",
  /** 개발·시연 전용. 남은 적을 무시하고 현재 방(또는 보스)을 즉시 클리어한다. */
  DEBUG_SKIP_ROOM: "F2",
};
