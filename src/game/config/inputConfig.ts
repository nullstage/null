/**
 * 키 바인딩.
 *
 * OQ-004 미결정 — 아래는 기본 매핑이다. 확정되면 `DEFAULT_KEY_BINDINGS`만 고친다.
 * 전투 구현(팀원 담당)은 키 코드를 하드코딩하지 말고 `KEY_BINDINGS`를 참조한다.
 *
 * 설정 화면에서 바꾼 값은 `KEY_BINDINGS`를 직접 덮어쓰고 `localStorage`에 남긴다.
 * 씬은 `create()` 시점에 읽으므로 전투 중 변경은 다음 씬부터 반영된다.
 * 시작 화면에서만 바꿀 수 있으니 실제로는 문제가 되지 않는다.
 */

export type GameAction =
  | "MOVE_LEFT"
  | "MOVE_RIGHT"
  | "JUMP"
  | "DASH"
  | "ATTACK"
  | "SWITCH_MODE"
  | "INTERACT"
  | "CONFIRM"
  | "TOGGLE_DEBUG"
  | "DEBUG_SKIP_ROOM";

/** Phaser의 `Phaser.Input.Keyboard.KeyCodes` 이름과 동일한 문자열을 쓴다. */
export const DEFAULT_KEY_BINDINGS: Readonly<Record<GameAction, string>> = {
  MOVE_LEFT: "A",
  MOVE_RIGHT: "D",
  JUMP: "SPACE",
  DASH: "SHIFT",
  ATTACK: "J",
  SWITCH_MODE: "K",
  /** 전송 게이트 같은 월드 상호작용 지점 전용. 이동·전투 키와 겹치지 않는 W를 쓴다. */
  INTERACT: "W",
  CONFIRM: "ENTER",
  TOGGLE_DEBUG: "F1",
  /** 개발·시연 전용. 남은 적을 무시하고 현재 방(또는 보스)을 즉시 클리어한다. */
  DEBUG_SKIP_ROOM: "F2",
};

/**
 * 현재 적용 중인 바인딩. 씬과 UI가 모두 이 객체를 읽는다.
 * 새 객체로 갈아끼우지 않고 내용만 바꾼다. 이미 import한 쪽이 옛 참조를 들고 있으면 안 된다.
 */
export const KEY_BINDINGS: Record<GameAction, string> = { ...DEFAULT_KEY_BINDINGS };

/**
 * 사용자가 바꿀 수 있는 동작.
 * 디버그 키(F1·F2)는 제외한다. 브라우저 단축키와 겹치기 쉽고 시연용이라 고정이 낫다.
 */
export const REBINDABLE_ACTIONS: readonly GameAction[] = [
  "MOVE_LEFT",
  "MOVE_RIGHT",
  "JUMP",
  "DASH",
  "ATTACK",
  "SWITCH_MODE",
  "CONFIRM",
];

const STORAGE_KEY = "null:keys";

const isRebindable = (value: string): value is GameAction =>
  (REBINDABLE_ACTIONS as readonly string[]).includes(value);

const persist = (): void => {
  try {
    const changed: Partial<Record<GameAction, string>> = {};
    for (const action of REBINDABLE_ACTIONS) {
      if (KEY_BINDINGS[action] !== DEFAULT_KEY_BINDINGS[action]) {
        changed[action] = KEY_BINDINGS[action];
      }
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(changed));
  } catch {
    // 저장에 실패해도 이번 세션의 바인딩은 그대로 적용된다.
  }
};

/** 저장된 바인딩을 불러와 적용한다. 브라우저에서 한 번만 호출한다. */
export const loadKeyBindings = (): void => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return;

    for (const [action, key] of Object.entries(parsed)) {
      // 저장 당시와 동작 목록이 달라졌을 수 있다. 아는 값만 받아들인다.
      if (isRebindable(action) && typeof key === "string" && key.length > 0) {
        KEY_BINDINGS[action] = key;
      }
    }
  } catch {
    // 값이 깨졌으면 기본 바인딩으로 시작한다.
  }
};

/**
 * 바인딩 하나를 바꾼다.
 * 같은 키를 이미 쓰는 동작이 있으면 서로 맞바꾼다. 한 키가 두 동작에 물리면 안 된다.
 */
export const setKeyBinding = (action: GameAction, key: string): void => {
  if (!isRebindable(action)) return;

  const previous = KEY_BINDINGS[action];
  const conflict = REBINDABLE_ACTIONS.find(
    (other) => other !== action && KEY_BINDINGS[other] === key,
  );

  KEY_BINDINGS[action] = key;
  if (conflict) KEY_BINDINGS[conflict] = previous;

  persist();
};

export const resetKeyBindings = (): void => {
  for (const action of REBINDABLE_ACTIONS) {
    KEY_BINDINGS[action] = DEFAULT_KEY_BINDINGS[action];
  }
  persist();
};

/**
 * 키보드 이벤트를 Phaser KeyCodes 이름으로 바꾼다.
 * 배열이 아니라 `code`를 쓴다. 한글 자판이나 다른 레이아웃에서도 물리 키 위치가 같아야 한다.
 * 바인딩으로 받을 수 없는 키는 `null`을 돌려준다.
 */
export const toBindingName = (code: string): string | null => {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Arrow(Up|Down|Left|Right)$/.test(code)) return code.slice(5).toUpperCase();

  switch (code) {
    case "Space":
      return "SPACE";
    case "Enter":
      return "ENTER";
    case "Tab":
      return "TAB";
    case "Backspace":
      return "BACKSPACE";
    case "ShiftLeft":
    case "ShiftRight":
      return "SHIFT";
    case "ControlLeft":
    case "ControlRight":
      return "CTRL";
    case "AltLeft":
    case "AltRight":
      return "ALT";
    default:
      return null;
  }
};
