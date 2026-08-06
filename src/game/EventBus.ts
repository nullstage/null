/**
 * Phaser와 React UI 사이의 유일한 통신 경로. (DEC-006)
 *
 * 규칙:
 * - Phaser는 React 컴포넌트를 직접 참조하지 않는다.
 * - React는 Phaser 씬이나 게임 오브젝트를 직접 참조하지 않는다.
 * - UI가 없어도 런은 성립해야 한다. 게임 로직은 이벤트 응답을 기다려 멈추지 않는다.
 *   단, `ui:continue`처럼 명시적으로 사용자 입력을 기다리는 지점은 예외다.
 *
 * Phaser에 의존하지 않는 순수 구현이라 React 번들이 Phaser를 끌어오지 않는다.
 */

import type {
  BossPatternWeights,
  CombatTelemetry,
  DeceptionResult,
  DirectorAnalysis,
  GamePhase,
  HudState,
  RoomId,
  RunResult,
  UpgradeDefinition,
  UpgradeId,
} from "./types/game";

export interface GameEventMap {
  /** Phaser → React */
  "phase:change": { phase: GamePhase };
  "room:start": { roomIndex: number; roomId: RoomId };
  "room:clear": { roomIndex: number; telemetry: CombatTelemetry };
  "analysis:ready": { analysis: DirectorAnalysis };
  "upgrade:offer": { choices: UpgradeDefinition[] };
  "deception:result": { result: DeceptionResult };
  "boss:weights": { weights: BossPatternWeights };
  "hud:update": { hud: HudState };
  "run:result": { result: RunResult };

  /** React → Phaser */
  "upgrade:select": { upgradeId: UpgradeId };
  "ui:continue": Record<string, never>;
  "run:restart": Record<string, never>;

  /** 양방향 */
  "debug:toggle": { visible: boolean };
}

type Handler<T> = (payload: T) => void;

class TypedEventBus<M extends Record<keyof M, unknown>> {
  private handlers: { [K in keyof M]?: Set<Handler<M[K]>> } = {};

  /** 구독을 등록하고 해제 함수를 돌려준다. React useEffect 정리에 그대로 쓴다. */
  on<K extends keyof M>(event: K, handler: Handler<M[K]>): () => void {
    const set = (this.handlers[event] ??= new Set());
    set.add(handler);
    return () => this.off(event, handler);
  }

  off<K extends keyof M>(event: K, handler: Handler<M[K]>): void {
    this.handlers[event]?.delete(handler);
  }

  emit<K extends keyof M>(event: K, payload: M[K]): void {
    const set = this.handlers[event];
    if (!set) return;
    for (const handler of [...set]) handler(payload);
  }

  /** 게임 인스턴스를 파괴할 때 호출한다. 재시작 시 구독이 중복 누적되는 것을 막는다. */
  removeAll(): void {
    this.handlers = {};
  }
}

export const eventBus = new TypedEventBus<GameEventMap>();
