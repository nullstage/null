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
import { debugFlag, VIEWPORT } from "../config/gameConfig";
import { KEY_BINDINGS } from "../config/inputConfig";
import { FIXED_ROOM_SEQUENCE } from "../data/rooms";
import { Boss } from "../entities/Boss";
import { Player, TUNING } from "../entities/Player";
import { playSfx, startRoomBgm, stopRoomBgm } from "../systems/audio";
import {
  attachGlitchFx,
  attachHitFx,
  damageNumber,
  portalWipeOut,
  pulseGlitchFx,
  startBloodRain,
  startDreamMist,
} from "../systems/CombatVfx";
import { CombatTelemetryRecorder } from "../systems/CombatTelemetry";
import { runState } from "../systems/RunState";
import { AUDIO, createArena, TEXTURE, type CombatArena } from "../types/combat";
import type { AttackMode, UpgradeElement } from "../types/game";

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
    attachGlitchFx(this);
    // 보스방 진입 — 세계가 한 번 크게 일그러지며 시작한다.
    pulseGlitchFx(this, 0.8, 650);
    this.telemetry.begin(this.time.now);

    // 보스방도 맨바닥 도형이 아니라 전투방과 같은 돌바닥·폐허 배경을 깐다.
    this.arena = createArena(this, VIEWPORT, TEXTURE.floorTileStone, TEXTURE.background, 87, 0x3a1c28);
    // 전투방과 같은 핏빛 비 — 보스전만 하늘이 맑으면 톤이 끊긴다.
    startBloodRain(this, VIEWPORT.width, this.arena.bounds.floorY);
    startDreamMist(this, VIEWPORT.width, this.arena.bounds.floorY);

    this.player = new Player({
      scene: this,
      arena: this.arena,
      telemetry: this.telemetry,
      upgrades: runState.selectedUpgrades,
      getShards: () => runState.shards,
      onDamaged: (amount) => runState.damage(amount),
      onDeath: () => this.finish(false),
    });
    this.player.maxHp = runState.maxHp;
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
    this.runBossIntro();

    this.wireCollisions();

    // 확정된 가중치를 UI(F1 디버그 패널)에 한 번 더 알린다.
    eventBus.emit("boss:weights", { weights: runState.bossWeights });

    // 개발·시연 전용 보스 스킵. 배포본에서 실수로 눌리지 않도록 `?debug=1`일 때만 붙인다.
    if (debugFlag("debug")) {
      this.input.keyboard?.on(`keydown-${KEY_BINDINGS.DEBUG_SKIP_ROOM}`, () => this.finish(true));
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

    // 일시정지 메뉴의 포기하기. 패배와 같은 흐름으로 튜토리얼 방에 되돌아간다.
    this.once("run:giveup", () => this.finish(false));
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

      const damage = (attack.getData("damage") as number) ?? 0;
      target.takeDamage(damage);
      playSfx(this, AUDIO.hitEnemy, { detune: Phaser.Math.Between(-200, 200) });
      const hitPoint = bodyObj as Phaser.GameObjects.Sprite;
      damageNumber(this, hitPoint.x, hitPoint.y - 30, damage);
      this.applyElement(attack.getData("element") as UpgradeElement | undefined, target);

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
      const damage = (attack.getData("damage") as number) ?? undefined;
      const result = this.player.takeDamage(damage);
      // 퍼펙트 패링 — 보스에게도 같은 방식으로 반사된다.
      if (result.perfect) this.boss.takeDamage(damage ?? 0);
      if (attack.getData("consumeOnHit")) attack.destroy();
    });
  }

  /** 속성 부가 효과. CombatScene.applyElement와 동일한 규칙이다. */
  private applyElement(element: UpgradeElement | undefined, target: Boss): void {
    if (!element) return;
    const { upgrade } = TUNING;

    if (element === "FIRE") {
      for (let i = 1; i <= upgrade.fireTickCount; i += 1) {
        this.time.delayedCall(i * upgrade.fireTickIntervalMs, () => {
          if (target.isDefeated || !target.sprite) return;
          // takeDamage가 이 틱으로 대상을 죽이면 그 안에서 sprite가 null이 된다.
          // 좌표는 죽기 전에 먼저 읽어 둔다.
          const { x, y } = target.sprite;
          target.takeDamage(upgrade.fireTickDamage);
          damageNumber(this, x, y - 30, upgrade.fireTickDamage);
        });
      }
    } else if (element === "FROST") {
      target.applySlow(upgrade.frostSlowFactor, upgrade.frostSlowMs);
    } else if (element === "POISON") {
      // 맹독 — 화상과 같은 틱 패턴이되 더 약하게, 더 오래. CombatScene과 동일 규칙.
      for (let i = 1; i <= upgrade.poisonTickCount; i += 1) {
        this.time.delayedCall(i * upgrade.poisonTickIntervalMs, () => {
          if (target.isDefeated || !target.sprite) return;
          const { x, y } = target.sprite;
          target.takeDamage(upgrade.poisonTickDamage);
          damageNumber(this, x, y - 30, upgrade.poisonTickDamage);
        });
      }
    }
  }

  /**
   * 등장 연출. 레터박스가 닫히고 카메라가 보스에게 다가가며 이름이 떠오른다.
   * 첫 패턴은 연출이 끝날 때까지 미루되, 조작은 막지 않는다 — 연출 중에도 거리를 벌릴 자유가 있다.
   */
  private runBossIntro(): void {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, VIEWPORT.width, VIEWPORT.height);
    const bossX = VIEWPORT.width * 0.8;

    this.boss.holdPatterns(2600);

    const barH = 64;
    const top = this.add
      .rectangle(0, 0, VIEWPORT.width, barH, 0x000000)
      .setOrigin(0, 1)
      .setScrollFactor(0)
      .setDepth(950);
    const bottom = this.add
      .rectangle(0, VIEWPORT.height, VIEWPORT.width, barH, 0x000000)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(950);
    this.tweens.add({ targets: top, y: barH, duration: 300, ease: "power2.out" });
    this.tweens.add({ targets: bottom, y: VIEWPORT.height - barH, duration: 300, ease: "power2.out" });

    cam.pan(bossX, VIEWPORT.height * 0.55, 700, "Sine.easeInOut");
    cam.zoomTo(1.28, 700, "Sine.easeInOut");

    const name = this.add
      .text(VIEWPORT.width / 2, VIEWPORT.height * 0.24, "「 집 행 자 」", {
        fontFamily: "'Pretendard', sans-serif",
        fontSize: "44px",
        fontStyle: "bold",
        color: "#f3dfe3",
        stroke: "#3d0a14",
        strokeThickness: 6,
        resolution: 2,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(951)
      .setAlpha(0);
    this.tweens.add({
      targets: name,
      alpha: 1,
      y: VIEWPORT.height * 0.26,
      delay: 500,
      duration: 420,
      ease: "power2.out",
    });

    // 이름 밑의 부제 — 세계관(그림자 침식)과 이 보스의 역할을 한 줄로 잇는다.
    const subtitle = this.add
      .text(VIEWPORT.width / 2, VIEWPORT.height * 0.315, "삼켜진 이름들을 거두는 자", {
        fontFamily: "'Pretendard', sans-serif",
        fontSize: "17px",
        color: "rgba(243, 223, 227, 0.75)",
        stroke: "#3d0a14",
        strokeThickness: 4,
        resolution: 2,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(951)
      .setAlpha(0);
    this.tweens.add({
      targets: subtitle,
      alpha: 1,
      delay: 780,
      duration: 380,
      ease: "power2.out",
    });

    this.time.delayedCall(1800, () => {
      cam.pan(VIEWPORT.width / 2, VIEWPORT.height / 2, 600, "Sine.easeInOut");
      cam.zoomTo(1, 600, "Sine.easeInOut");
      this.tweens.add({ targets: [name, subtitle], alpha: 0, duration: 300 });
      this.tweens.add({ targets: top, y: 0, duration: 400, ease: "power2.in" });
      this.tweens.add({
        targets: bottom,
        y: VIEWPORT.height,
        duration: 400,
        ease: "power2.in",
        onComplete: () => {
          top.destroy();
          bottom.destroy();
          name.destroy();
          subtitle.destroy();
        },
      });
    });
  }

  private finish(cleared: boolean): void {
    if (this.finished) return;
    this.finished = true;

    this.telemetry.end(this.time.now, this.player.hp);
    runState.hp = this.player.hp;

    if (!cleared) {
      // 보스전 사망도 런을 끝내지 않는다 — 결과창을 먼저 보여준 뒤 튜토리얼로 돌려보낸다.
      eventBus.emit("respawn:summary", {
        survivedMs: runState.attemptDurationMs(this.time.now),
        kills: runState.kills,
      });
      this.scene.pause();
      this.once("ui:continue", () => {
        this.scene.resume();
        runState.respawnAtTutorial(this.time.now);
        playSfx(this, AUDIO.portal);
        portalWipeOut(this, () => this.scene.start("Combat", { roomId: FIXED_ROOM_SEQUENCE[0] }));
      });
      return;
    }

    runState.setPhase("RESULT");
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
