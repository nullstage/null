/**
 * 보스전. (MVP_PLAN §8)
 *
 * 성향은 보스전 시작 시점에 이미 확정되어 있다(`runState.bossWeights`).
 * 전투 중 재분석하지 않는다.
 *
 * 보스전 텔레메트리는 Director 분석에 쓰이지 않지만,
 * 결과 리포트에 넣기 위해 동일한 방식으로 기록한다.
 */

import Phaser from "phaser";

import { eventBus, type GameEventMap } from "../EventBus";
import { VIEWPORT } from "../config/gameConfig";
import { KEY_BINDINGS } from "../config/inputConfig";
import { Boss } from "../entities/Boss";
import { Player } from "../entities/Player";
import { CombatTelemetryRecorder } from "../systems/CombatTelemetry";
import { runState } from "../systems/RunState";

export class BossScene extends Phaser.Scene {
  private telemetry = new CombatTelemetryRecorder();
  private player!: Player;
  private boss!: Boss;
  private subscriptions: (() => void)[] = [];
  private finished = false;

  constructor() {
    super("Boss");
  }

  create(): void {
    this.finished = false;
    this.subscriptions = [];
    runState.setPhase("BOSS");

    this.cameras.main.setBackgroundColor("#171017");
    this.telemetry.begin(this.time.now);

    this.player = new Player({
      scene: this,
      telemetry: this.telemetry,
      upgrades: runState.selectedUpgrades,
      onDamaged: (amount) => runState.damage(amount),
      onDeath: () => this.finish(false),
    });
    this.player.hp = runState.hp;
    this.player.spawn(VIEWPORT.width * 0.2, VIEWPORT.height * 0.6);
    this.player.emitHud(1, runState.roomIndex);

    this.boss = new Boss({
      scene: this,
      weights: runState.bossWeights,
      onPatternSelected: (pattern) => runState.recordBossPattern(pattern),
      onDefeated: () => this.finish(true),
    });
    this.boss.spawn(VIEWPORT.width * 0.8, VIEWPORT.height * 0.6);

    // 확정된 가중치를 UI(F1 디버그 패널)에 한 번 더 알린다.
    eventBus.emit("boss:weights", { weights: runState.bossWeights });

    // 개발·시연 전용 보스 스킵.
    this.input.keyboard?.on(`keydown-${KEY_BINDINGS.DEBUG_SKIP_ROOM}`, () => this.finish(true));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  update(time: number, deltaMs: number): void {
    if (this.finished) return;
    this.player.update(time, deltaMs);
    this.boss.update(time, deltaMs);
  }

  private finish(cleared: boolean): void {
    if (this.finished) return;
    this.finished = true;

    this.telemetry.end(this.time.now, this.player.hp);
    runState.hp = this.player.hp;
    runState.setPhase(cleared ? "RESULT" : "GAME_OVER");

    eventBus.emit("run:result", { result: runState.buildResult(this.time.now, cleared) });

    this.once("run:restart", () => {
      runState.reset(this.time.now);
      this.scene.start("Ready");
    });
  }

  private once<K extends keyof GameEventMap>(
    event: K,
    handler: (payload: GameEventMap[K]) => void,
  ): void {
    const unsubscribe = eventBus.on(event, (payload) => {
      unsubscribe();
      handler(payload);
    });
    this.subscriptions.push(unsubscribe);
  }

  private cleanup(): void {
    for (const unsubscribe of this.subscriptions) unsubscribe();
    this.subscriptions = [];
    this.boss?.destroy();
    this.player?.destroy();
  }
}
