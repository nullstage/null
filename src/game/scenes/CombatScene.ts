/**
 * 일반 전투방 1~3을 담당한다. (MVP_PLAN §9)
 *
 * 이 씬은 흐름만 관리한다. 전투 자체는 Player와 적 클래스가 담당한다.
 *
 *   방 시작 → 전투 → 클리어 → 분석 → 강화 → 다음 방
 *   방 3 클리어 후에는 역기만 판정 → 강화(3회차) → 보스로 넘어간다. (OQ-016 RESOLVED, DEC-013)
 *
 * 분석 팝업과 강화 선택 UI는 React에 있다. (DEC-006)
 * 이 씬은 이벤트를 쏘고 `ui:continue` / `upgrade:select` 응답을 기다린다.
 * UI 응답 대기는 여기 두 지점뿐이며, 그 외에는 UI가 없어도 런이 성립한다.
 */

import Phaser from "phaser";

import { eventBus, type GameEventMap } from "../EventBus";
import { VIEWPORT } from "../config/gameConfig";
import { KEY_BINDINGS } from "../config/inputConfig";
import { SOFT_COUNTER_ROOM_2_BY_STYLE } from "../data/directorRules";
import { FIXED_ROOM_SEQUENCE } from "../data/rooms";
import { Player } from "../entities/Player";
import { BaseEnemy } from "../entities/enemies/BaseEnemy";
import { ChaserEnemy } from "../entities/enemies/ChaserEnemy";
import { MobilityCounterEnemy } from "../entities/enemies/MobilityCounterEnemy";
import { RangedEnemy } from "../entities/enemies/RangedEnemy";
import { attachHitFx } from "../systems/CombatVfx";
import { CombatTelemetryRecorder } from "../systems/CombatTelemetry";
import { analyze, bossWeightsFor, classify, evaluateDeception } from "../systems/DirectorPolicy";
import { RoomController } from "../systems/RoomController";
import { rollUpgradeChoices } from "../systems/UpgradeSystem";
import { runState } from "../systems/RunState";
import { createArena, type CombatArena } from "../types/combat";
import type {
  AttackMode,
  CombatTelemetry,
  EnemySpawn,
  EnemyType,
  RoomId,
  RoomPreset,
} from "../types/game";

export interface CombatSceneData {
  roomId?: RoomId;
}

/** 방 3이 마지막 일반 방이다. 이후는 보스전이다. */
const LAST_COMBAT_ROOM_INDEX = 3;


export class CombatScene extends Phaser.Scene {
  private roomId: RoomId = FIXED_ROOM_SEQUENCE[0];
  private telemetry = new CombatTelemetryRecorder();
  private player!: Player;
  private arena!: CombatArena;
  private room!: RoomController;
  private enemies: BaseEnemy[] = [];
  private subscriptions: (() => void)[] = [];

  constructor() {
    super("Combat");
  }

  init(data: CombatSceneData): void {
    this.roomId = data.roomId ?? FIXED_ROOM_SEQUENCE[0];
    this.enemies = [];
    this.subscriptions = [];
  }

  create(): void {
    runState.setPhase("COMBAT");

    this.buildStage();

    this.player = new Player({
      scene: this,
      arena: this.arena,
      telemetry: this.telemetry,
      upgrades: runState.selectedUpgrades,
      onDamaged: (amount) => runState.damage(amount),
      onDeath: () => this.handlePlayerDeath(),
    });

    // 런 전체에서 체력이 이어지도록 이전 방에서 남은 값을 넘긴다. (OQ-008 미결정)
    this.player.hp = runState.hp;

    this.room = new RoomController({
      scene: this,
      telemetry: this.telemetry,
      spawnEnemy: (spawn, preset) => this.spawnEnemy(spawn, preset),
      enableHazards: (preset) => this.enableHazards(preset),
      getRemainingHp: () => this.player.hp,
      onRoomClear: (telemetry) => this.handleRoomClear(telemetry),
    });

    this.player.spawn(VIEWPORT.width * 0.15, this.arena.bounds.floorY - 80);
    // 충돌 연결은 플레이어 스프라이트가 생긴 뒤에 건다.
    this.wireCollisions();

    runState.beginRoom(this.roomId);
    this.room.start(this.roomId);
    this.player.emitHud(this.room.enemiesRemaining, runState.roomIndex);

    // 개발·시연 전용 방 스킵. 전투가 완성되기 전에도 전체 흐름을 확인하기 위한 것이다.
    this.input.keyboard?.on(`keydown-${KEY_BINDINGS.DEBUG_SKIP_ROOM}`, () =>
      this.room.forceClear(),
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
  }

  update(time: number, deltaMs: number): void {
    this.player.update(time, deltaMs);
    for (const enemy of this.enemies) {
      if (!enemy.isDefeated) enemy.update(time, deltaMs);
    }
  }

  // ────────────────────────────── 방 구성 ──────────────────────────────

  /**
   * 지형과 충돌 그룹을 만든다.
   *
   * 플레이어·적·보스를 각각 다른 사람이 만들기 때문에 서로를 직접 참조하지 않는다.
   * 각자 `arena`의 그룹에만 오브젝트를 넣고, 누가 누구를 때렸는지는 여기서만 판정한다.
   */
  private buildStage(): void {
    this.cameras.main.setBackgroundColor("#0a0709");
    // 피격 셰이더는 카메라에 한 번 붙여두고, 세기만 0에서 올렸다 내린다.
    attachHitFx(this);
    this.arena = createArena(this, VIEWPORT);
  }

  /** 충돌 판정은 이 한 곳에서만 건다. 엔티티가 서로를 알 필요가 없다. */
  private wireCollisions(): void {
    const arena = this.arena;

    this.physics.add.collider(arena.enemyBodies, arena.solids);

    // 플레이어 공격 → 적. 적중 기록이 분류의 유일한 근거다. (MVP_PLAN §4)
    this.physics.add.overlap(arena.playerAttacks, arena.enemyBodies, (attackObj, bodyObj) => {
      const attack = attackObj as Phaser.GameObjects.GameObject;
      const enemy = (bodyObj as Phaser.GameObjects.GameObject).getData("enemy") as
        | BaseEnemy
        | undefined;
      if (!enemy || enemy.isDefeated) return;

      // 한 번 휘두른 공격이 같은 적을 여러 프레임 때리지 않게 한다.
      const hitSet = (attack.getData("hitEnemies") as Set<BaseEnemy> | undefined) ?? new Set();
      if (hitSet.has(enemy)) return;
      hitSet.add(enemy);
      attack.setData("hitEnemies", hitSet);

      enemy.takeDamage((attack.getData("damage") as number) ?? 0);

      const mode = attack.getData("mode") as AttackMode | undefined;
      // 파편은 맞은 적 위에서 터져야 한다. 플레이어 위치에서 터지면 누굴 쳤는지 모른다.
      const target = bodyObj as Phaser.GameObjects.Sprite;
      if (mode) this.player.notifyHit(mode, { x: target.x, y: target.y });

      if (attack.getData("consumeOnHit")) attack.destroy();
    });

    const playerBody = this.player.sprite;
    if (!playerBody) return;

    // 적 공격체 → 플레이어
    this.physics.add.overlap(arena.enemyAttacks, playerBody, (attackObj) => {
      const attack = attackObj as Phaser.GameObjects.GameObject;
      this.player.takeDamage((attack.getData("damage") as number) ?? undefined);
      if (attack.getData("consumeOnHit")) attack.destroy();
    });

    // 적 본체 접촉 → 플레이어
    this.physics.add.overlap(arena.enemyBodies, playerBody, (bodyObj) => {
      const enemy = (bodyObj as Phaser.GameObjects.GameObject).getData("enemy") as
        | BaseEnemy
        | undefined;
      if (!enemy || enemy.isDefeated) return;
      this.player.takeDamage(enemy.definition.contactDamage);
    });
  }

  private spawnEnemy(spawn: EnemySpawn, _preset: RoomPreset): void {
    const enemy = this.createEnemy(spawn.type);
    enemy.spawn(VIEWPORT.width * spawn.xRatio, this.arena.bounds.floorY - 60);
    this.enemies.push(enemy);
    this.player.emitHud(this.room.enemiesRemaining, runState.roomIndex);
  }

  private createEnemy(type: EnemyType): BaseEnemy {
    const deps = {
      scene: this,
      arena: this.arena,
      getPlayerPosition: () => {
        const sprite = this.player.sprite as Phaser.GameObjects.Sprite | null;
        return { x: sprite?.x ?? 0, y: sprite?.y ?? 0 };
      },
      onDefeated: () => {
        this.room.onEnemyDefeated();
        this.player.emitHud(this.room.enemiesRemaining, runState.roomIndex);
      },
    };

    switch (type) {
      case "CHASER":
        return new ChaserEnemy(deps);
      case "RANGED":
        return new RangedEnemy(deps);
      case "MOBILITY_COUNTER":
        return new MobilityCounterEnemy(deps);
    }
  }

  /** 팀원 담당: 지연 폭발 장판 배치. 예고 없이 즉시 폭발시키지 않는다. (DEC-004) */
  private enableHazards(_preset: RoomPreset): void {
    // 팀원 담당
  }

  // ────────────────────────────── 흐름 제어 ──────────────────────────────

  private handleRoomClear(telemetry: CombatTelemetry): void {
    // completeRoom은 같은 방에 두 번 호출되면 false를 돌려준다.
    if (!runState.completeRoom(telemetry)) return;

    runState.hp = this.player.hp;

    if (runState.roomIndex >= LAST_COMBAT_ROOM_INDEX) {
      this.resolveDeception(telemetry);
      return;
    }

    runState.setPhase("ANALYSIS");
    runState.attachAnalysis(analyze(telemetry, runState.previousTelemetry));

    // 분석 팝업을 닫으면 강화 선택으로 넘어간다.
    this.once("ui:continue", () => this.offerUpgrade(() => this.goToNextRoom()));
  }

  /**
   * 강화 3회 지급(방 1·방 2·방 3 클리어 후). (OQ-016 RESOLVED, DEC-013)
   *
   * `onSelected`가 다음 단계를 결정한다 — 방 1·방 2 후에는 다음 방으로,
   * 방 3 후에는 보스로 넘어간다. 보스 진입은 `scene.restart`가 아니라 `scene.start`라
   * `room:start`가 발생하지 않는다 — React 쪽은 그 대신 `phase:change`(→"BOSS")로
   * 로딩 해제 신호를 받는다(HUDOverlay 참고). 여기서는 두 경로를 구분할 필요가 없다.
   */
  private offerUpgrade(onSelected: () => void): void {
    runState.setPhase("UPGRADE");
    eventBus.emit("upgrade:offer", { choices: rollUpgradeChoices(runState.selectedUpgrades) });

    this.once("upgrade:select", ({ upgradeId }) => {
      runState.addUpgrade(upgradeId);
      onSelected();
    });
  }

  /**
   * 방 1·방 2 클리어 후 다음 방으로 넘어간다. `goToNextRoom`은 이 두 경우에만
   * 호출된다(방 3 클리어는 `resolveDeception`이 별도 처리) — 즉 `nextIndex`는
   * 항상 2(→방 2) 또는 3(→방 3) 둘 중 하나이고, 그 외 값은 나오지 않는다.
   */
  private goToNextRoom(): void {
    const nextIndex = runState.roomIndex + 1;

    const nextRoomId =
      nextIndex >= LAST_COMBAT_ROOM_INDEX
        ? // 방 3 — Director가 고른 카운터 방(3기). (MVP_PLAN §5)
          (runState.counterRoomId ?? "counter_mixed")
        : // 방 2 — 방 1 텔레메트리만으로 분류한 스타일에 따른 축소판(2기) 소프트 카운터.
          // (OQ-010 RESOLVED, DEC-014) 이 시점의 `predictedStyle`은 방 1 클리어 직후
          // `analyze()`가 세팅한 값 그대로다 — 방 2가 아직 시작 전이라 65/35 가중
          // 평균에 쓰일 방 2 자신의 데이터가 없으므로 방 1 단독 분류가 곧 "방 1 결과"다.
          SOFT_COUNTER_ROOM_2_BY_STYLE[runState.predictedStyle ?? "MIXED"];

    this.scene.restart({ roomId: nextRoomId });
  }

  /**
   * MVP_PLAN §6 역기만 판정.
   *
   * 예측은 방 3 입장 전 값이고, 실제 스타일은 방 3 텔레메트리만으로 다시 계산한다.
   * OQ-014 미결정 — 보스 성향도 지금은 방 3만 사용한다.
   */
  private resolveDeception(roomThreeTelemetry: CombatTelemetry): void {
    const predictedStyle = runState.predictedStyle ?? "MIXED";
    const actualStyle = classify(roomThreeTelemetry).style;

    runState.setDeception(
      evaluateDeception(predictedStyle, actualStyle, true, runState.maxHp),
    );
    runState.setBossWeights(bossWeightsFor(actualStyle));

    // 역기만 결과를 닫으면 보스 진입 전 마지막 강화를 지급한다. (OQ-016 RESOLVED, DEC-013)
    this.once("ui:continue", () => this.offerUpgrade(() => this.scene.start("Boss")));
  }

  private handlePlayerDeath(): void {
    runState.hp = 0;
    runState.setPhase("GAME_OVER");
    eventBus.emit("run:result", { result: runState.buildResult(this.time.now, false) });

    this.once("run:restart", () => {
      runState.reset(this.time.now);
      this.scene.start("Ready");
    });
  }

  // ────────────────────────────── 유틸 ──────────────────────────────

  /** 한 번만 반응하는 구독. 씬이 내려가면 자동으로 해제된다. */
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
    this.room?.dispose();
    for (const enemy of this.enemies) enemy.destroy();
    this.enemies = [];
    this.player?.destroy();
  }
}
