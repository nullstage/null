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
import { playSfx, startRoomBgm, stopRoomBgm } from "../systems/audio";
import { attachHitFx } from "../systems/CombatVfx";
import { CombatTelemetryRecorder } from "../systems/CombatTelemetry";
import { runState } from "../systems/RunState";
import { AUDIO, createArena, type CombatArena } from "../types/combat";
import type { AttackMode } from "../types/game";

export class BossScene extends Phaser.Scene {
  private telemetry = new CombatTelemetryRecorder();
  private player!: Player;
  private arena!: CombatArena;
  private boss!: Boss;
  private subscriptions: (() => void)[] = [];
  private finished = false;

  constructor() {
    super("Boss");
  }

  create(): void {
    this.finished = false;
    this.subscriptions = [];
    this.cameras.main.fadeIn(300);
    runState.setPhase("BOSS");
    startRoomBgm(this, AUDIO.bgmCombat);

    this.cameras.main.setBackgroundColor("#140b10");
    // 전투방과 같은 피격 셰이더. 보스전만 연출이 빠지면 격이 낮아 보인다.
    attachHitFx(this);
    this.telemetry.begin(this.time.now);

    this.arena = createArena(this, VIEWPORT);

    this.player = new Player({
      scene: this,
      arena: this.arena,
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
      arena: this.arena,
      getPlayerPosition: () => {
        const sprite = this.player.sprite;
        return { x: sprite?.x ?? 0, y: sprite?.y ?? 0 };
      },
      weights: runState.bossWeights,
      onPatternSelected: (pattern) => runState.recordBossPattern(pattern),
      onDefeated: () => this.finish(true),
    });
    this.boss.spawn(VIEWPORT.width * 0.8, this.arena.bounds.floorY - 90);

    this.wireCollisions();

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

  /**
   * 충돌 판정은 여기 한 곳에서만 건다. 전투방과 같은 규약이다. (types/combat.ts)
   * 보스는 접촉 피해를 주지 않는다. 패턴 공격체로만 때린다. (MVP_PLAN §8)
   */
  private wireCollisions(): void {
    const arena = this.arena;

    this.physics.add.overlap(arena.playerAttacks, arena.enemyBodies, (attackObj, bodyObj) => {
      const attack = attackObj as Phaser.GameObjects.GameObject;
      const target = (bodyObj as Phaser.GameObjects.GameObject).getData("enemy") as Boss | undefined;
      if (!target || target.isDefeated) return;

      // 한 번 휘두른 공격이 같은 대상을 여러 프레임 때리지 않게 한다.
      const hitSet = (attack.getData("hitEnemies") as Set<unknown> | undefined) ?? new Set();
      if (hitSet.has(target)) return;
      hitSet.add(target);
      attack.setData("hitEnemies", hitSet);

      target.takeDamage((attack.getData("damage") as number) ?? 0);
      playSfx(this, AUDIO.hitEnemy, { detune: Phaser.Math.Between(-200, 200) });

      // 보스전 텔레메트리도 같은 방식으로 기록한다. 결과 리포트에 쓰인다.
      const mode = attack.getData("mode") as AttackMode | undefined;
      const point = bodyObj as Phaser.GameObjects.Sprite;
      if (mode) this.player.notifyHit(mode, { x: point.x, y: point.y });

      if (attack.getData("consumeOnHit")) attack.destroy();
    });

    const playerBody = this.player.sprite;
    if (!playerBody) return;

    this.physics.add.overlap(arena.enemyAttacks, playerBody, (attackObj) => {
      const attack = attackObj as Phaser.GameObjects.GameObject;
      this.player.takeDamage((attack.getData("damage") as number) ?? undefined);
      if (attack.getData("consumeOnHit")) attack.destroy();
    });
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
      stopRoomBgm(this);
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
