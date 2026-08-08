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

import type { EngravingId, EngravingView } from "./data/engravings";
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
  "room:start": {
    roomIndex: number;
    roomId: RoomId;
    /** 방 1 기록자 대화창을 열지. 새 런의 첫 진입만 true — 사망·포기 복귀에는 안 연다. */
    showIntro: boolean;
  };
  "room:clear": { roomIndex: number; telemetry: CombatTelemetry };
  "analysis:ready": { analysis: DirectorAnalysis };
  "upgrade:offer": { choices: UpgradeDefinition[] };
  "deception:result": { result: DeceptionResult };
  "boss:weights": { weights: BossPatternWeights };
  "hud:update": { hud: HudState };
  "run:result": { result: RunResult };
  /** 사망·포기 직후 검은 결과창에 띄울 이번 시도 요약. `ui:continue`로 닫는다. */
  "respawn:summary": { survivedMs: number; kills: number };
  /** 마을 그림자 상인과의 거래 시작. 씬은 이걸 쏘고 스스로 멈춘다(대화창과 같은 문법). */
  "shop:open": { choices: UpgradeDefinition[]; shards: number; price: number };
  /** 기록 제단(각인) 열기. 구매 후에도 같은 이벤트로 갱신 스냅샷을 다시 쏜다 — 패널은 열린 채로. */
  "engrave:open": { nodes: EngravingView[]; shards: number };

  /** React → Phaser */
  "upgrade:select": { upgradeId: UpgradeId };
  /** 상점 구매. 검증(잔액)은 Phaser 쪽이 한다 — React는 표시만 담당한다. */
  "shop:buy": { upgradeId: UpgradeId };
  /** 각인 새기기. 검증(선행 조건·잔액)은 Phaser 쪽(Engravings)이 한다. */
  "engrave:buy": { id: EngravingId };
  "ui:continue": Record<string, never>;
  "run:restart": Record<string, never>;
  /** 일시정지 메뉴가 열리고 닫힐 때. 전투 씬의 시간을 멈췄다 되돌린다. */
  "game:pause": Record<string, never>;
  "game:resume": Record<string, never>;
  /** 일시정지 메뉴의 나가기. 진행 중인 런을 버리고 시작 화면으로 돌아간다. */
  "run:abort": Record<string, never>;
  /** 일시정지 메뉴의 포기하기. 사망과 같은 흐름 — 튜토리얼 방으로 되돌아간다. */
  "run:giveup": Record<string, never>;
  /** 설정 패널에서 소리 값을 바꿀 때. Phaser 내장 사운드(BGM·발소리 루프)는 재생 시점에
   * 볼륨을 한 번만 읽어 두므로, 재생 중인 소리는 이 이벤트로 갱신해야 한다. */
  "audio:change": { master: number; bgm: number; sfx: number };

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
