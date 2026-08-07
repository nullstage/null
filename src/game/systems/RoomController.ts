/**
 * 방 생명주기 관리. 적 스폰과 종료 판정을 한 곳에서 담당한다.
 *
 * 시스템 담당 영역: 스폰 예약, 클리어 판정, 중복 클리어 방지, 텔레메트리 시작/종료.
 * 전투 담당 영역: 실제 적 인스턴스 생성과 동작. `spawnEnemy` 콜백으로 주입받는다.
 */

import type Phaser from "phaser";

import { getRoomPreset } from "../data/rooms";
import type { CombatTelemetry, EnemySpawn, RoomId, RoomPreset } from "../types/game";
import type { CombatTelemetryRecorder } from "./CombatTelemetry";

/** 웨이브 전멸 후 다음 웨이브가 쏟아지기까지의 텀. */
const WAVE_GAP_MS = 1200;

export interface RoomControllerDeps {
  scene: Phaser.Scene;
  telemetry: CombatTelemetryRecorder;
  /** 전투 담당이 구현한다. 적 하나를 만들고 사망 시 `onEnemyDefeated`를 호출해야 한다. */
  spawnEnemy: (spawn: EnemySpawn, preset: RoomPreset) => void;
  /** 장판 함정 활성화. 전투 담당이 구현한다. */
  enableHazards?: (preset: RoomPreset) => void;
  onRoomClear: (telemetry: CombatTelemetry) => void;
  /** 방 종료 시 기록할 남은 체력을 돌려준다. */
  getRemainingHp: () => number;
}

export class RoomController {
  private readonly deps: RoomControllerDeps;
  private preset: RoomPreset | null = null;
  private pendingSpawns = 0;
  private aliveEnemies = 0;
  private cleared = false;
  private wavesRemaining = 0;
  private timers: Phaser.Time.TimerEvent[] = [];

  constructor(deps: RoomControllerDeps) {
    this.deps = deps;
  }

  start(roomId: RoomId): void {
    this.dispose();

    const preset = getRoomPreset(roomId);
    this.preset = preset;
    this.cleared = false;
    this.wavesRemaining = preset.extraWaves ?? 0;

    this.deps.telemetry.begin(this.deps.scene.time.now);

    if (preset.hazardsEnabled) this.deps.enableHazards?.(preset);

    this.spawnWave(preset);

    // 적이 하나도 없는 프리셋이면 방이 영원히 안 끝난다. 즉시 클리어로 처리한다.
    if (preset.spawns.length === 0) this.finish();
  }

  /** 프리셋의 스폰 구성을 그대로 다시 스폰한다. 최초 입장과 웨이브 재시작이 공유한다. */
  private spawnWave(preset: RoomPreset): void {
    this.pendingSpawns = preset.spawns.length;
    this.aliveEnemies = 0;

    for (const spawn of preset.spawns) {
      if (spawn.delayMs <= 0) {
        this.spawn(spawn, preset);
        continue;
      }
      this.timers.push(
        this.deps.scene.time.delayedCall(spawn.delayMs, () => this.spawn(spawn, preset)),
      );
    }
  }

  /** 전투 담당이 적 사망 시 호출한다. */
  onEnemyDefeated(): void {
    this.aliveEnemies = Math.max(0, this.aliveEnemies - 1);
    this.checkClear();
  }

  /** 남은 적 수. HUD 표시용. */
  get enemiesRemaining(): number {
    return this.aliveEnemies + this.pendingSpawns;
  }

  get isCleared(): boolean {
    return this.cleared;
  }

  /**
   * 남은 적을 무시하고 방을 클리어 처리한다.
   *
   * 개발·시연 전용이다. 전투가 완성되기 전까지 분석·카운터·역기만·보스 흐름을
   * 확인할 방법이 이것뿐이라 남겨둔다. 일반 플레이 경로에서는 호출되지 않는다.
   */
  forceClear(): void {
    for (const timer of this.timers) timer.remove(false);
    this.timers = [];
    this.pendingSpawns = 0;
    this.aliveEnemies = 0;
    this.finish();
  }

  dispose(): void {
    for (const timer of this.timers) timer.remove(false);
    this.timers = [];
    this.preset = null;
    this.pendingSpawns = 0;
    this.aliveEnemies = 0;
  }

  private spawn(spawn: EnemySpawn, preset: RoomPreset): void {
    this.pendingSpawns = Math.max(0, this.pendingSpawns - 1);
    this.aliveEnemies += 1;
    this.deps.spawnEnemy(spawn, preset);
  }

  private checkClear(): void {
    if (this.cleared) return;
    if (this.pendingSpawns > 0 || this.aliveEnemies > 0) return;

    if (this.wavesRemaining > 0 && this.preset) {
      this.wavesRemaining -= 1;
      const preset = this.preset;
      // 전멸 직후 바로 다시 쏟아지면 숨 돌릴 틈이 없다. 짧게 텀을 둔다.
      this.timers.push(
        this.deps.scene.time.delayedCall(WAVE_GAP_MS, () => this.spawnWave(preset)),
      );
      return;
    }

    this.finish();
  }

  /** 클리어는 방마다 정확히 한 번만 발생한다. (MVP_PLAN §12 중복 이벤트 대응) */
  private finish(): void {
    if (this.cleared) return;
    this.cleared = true;

    const telemetry = this.deps.telemetry.end(
      this.deps.scene.time.now,
      this.deps.getRemainingHp(),
    );
    this.deps.onRoomClear(telemetry);
  }
}
