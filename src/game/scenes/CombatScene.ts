/**
 * 일반 전투방 1~3을 담당한다. (MVP_PLAN §9)
 *
 * 이 씬은 흐름만 관리한다. 전투 자체는 Player와 적 클래스가 담당한다.
 *
 *   방 시작 → 전투 → 클리어 → 분석 → (강화) → 다음 방
 *   방 3 클리어 후에는 역기만 판정을 거쳐 보스로 넘어간다.
 *
 * 분석 팝업과 강화 선택 UI는 React에 있다. (DEC-006)
 * 이 씬은 이벤트를 쏘고 `ui:continue` / `upgrade:select` 응답을 기다린다.
 * UI 응답 대기는 여기 두 지점뿐이며, 그 외에는 UI가 없어도 런이 성립한다.
 */

import Phaser from "phaser";

import { eventBus, type GameEventMap } from "../EventBus";
import { TUTORIAL_ROOM_WIDTH, VIEWPORT } from "../config/gameConfig";
import { KEY_BINDINGS } from "../config/inputConfig";
import { FIXED_ROOM_SEQUENCE } from "../data/rooms";
import { ROOM_ONE_DECOR } from "../data/roomOneDecor";
import { Player } from "../entities/Player";
import { BaseEnemy } from "../entities/enemies/BaseEnemy";
import { ChaserEnemy } from "../entities/enemies/ChaserEnemy";
import { MobilityCounterEnemy } from "../entities/enemies/MobilityCounterEnemy";
import { RangedEnemy } from "../entities/enemies/RangedEnemy";
import {
  attachAmbientLight,
  attachHitFx,
  portalWipeOut,
  startAmbientParticles,
  updateAmbientLightCenter,
} from "../systems/CombatVfx";
import { playSfx, startRoomBgm } from "../systems/audio";
import { CombatTelemetryRecorder } from "../systems/CombatTelemetry";
import { analyze, bossWeightsFor, classify, evaluateDeception } from "../systems/DirectorPolicy";
import { RoomController } from "../systems/RoomController";
import { rollUpgradeChoices } from "../systems/UpgradeSystem";
import { runState } from "../systems/RunState";
import { addDecor, AUDIO, createArena, TEXTURE, type CombatArena } from "../types/combat";
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
  /** 방 1(튜토리얼) 전용 — 전투 대신 이걸 앞에서 INTERACT를 눌러야 다음 방으로 넘어간다. */
  private portal: Phaser.Physics.Arcade.Sprite | null = null;
  /** 게이트 근처일 때만 보이는 안내 문구. */
  private portalPrompt: Phaser.GameObjects.Text | null = null;
  /** 게이트를 상호작용하면 실행할 다음 단계. `awaitPortal`이 채우고 상호작용 시 비운다. */
  private portalCallback: (() => void) | null = null;
  private interactKey?: Phaser.Input.Keyboard.Key;
  /** 우상단 미니맵. 매 프레임 다시 그린다 — 사각형 몇 개라 비용이 없다. */
  private minimap: Phaser.GameObjects.Graphics | null = null;

  constructor() {
    super("Combat");
  }

  init(data: CombatSceneData): void {
    this.roomId = data.roomId ?? FIXED_ROOM_SEQUENCE[0];
    this.enemies = [];
    this.subscriptions = [];
  }

  create(): void {
    // 게이트를 넘어온 직후라면(portalWipeOut이 이미 화면을 덮어 둔 상태) 여기서
    // 자연스럽게 밝아지며 드러난다. 방 1 최초 진입도 갑자기 뚝 뜨는 것보다 낫다.
    this.cameras.main.fadeIn(300);
    runState.setPhase("COMBAT");
    // 방 1(튜토리얼)은 아직 전투가 없는 마을 분위기라 다른 트랙을 쓴다.
    startRoomBgm(
      this,
      this.roomId === FIXED_ROOM_SEQUENCE[0] ? AUDIO.bgmVillage : AUDIO.bgmCombat,
    );

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

    this.player.spawn(this.arena.bounds.width * 0.15, this.arena.bounds.floorY - 80);
    // 충돌 연결은 플레이어 스프라이트가 생긴 뒤에 건다.
    this.wireCollisions();

    // 방이 화면보다 넓을 때 카메라가 플레이어를 따라간다. lerp가 낮아 스냅되지 않고 조금씩 붙는다.
    if (this.player.sprite) {
      this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);
    }

    runState.beginRoom(this.roomId);
    this.room.start(this.roomId);
    this.player.emitHud(this.room.enemiesRemaining, runState.roomIndex);

    // 개발·시연 전용 방 스킵. 전투가 완성되기 전에도 전체 흐름을 확인하기 위한 것이다.
    this.input.keyboard?.on(`keydown-${KEY_BINDINGS.DEBUG_SKIP_ROOM}`, () =>
      this.room.forceClear(),
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

    /**
     * 방 1은 첫 진입이다. 스스로 잠깐 멈춰 둔다.
     *
     * React가 대화창을 볼 차례인지(재방문 여부)를 판단하고, `game:resume`으로 풀어 준다.
     * 못 봤으면 대화창이 뜨는 동안, 봤으면 다음 프레임에 곧바로 풀린다 — 어느 쪽이든
     * 대화가 시작되기 전에 적이 움직이거나 공격하는 일은 없다.
     * create() 끝에서 자기 자신을 멈추는 건 안전하다. 아직 update()가 한 번도 돌지 않았다.
     */
    if (this.roomId === FIXED_ROOM_SEQUENCE[0] && !runState.skipTutorialIntro) {
      this.scene.pause();
    }

    // 일시정지 메뉴의 포기하기. 사망과 같은 흐름으로 튜토리얼 방에 되돌아간다.
    this.once("run:giveup", () => this.handlePlayerDeath());
  }

  update(time: number, deltaMs: number): void {
    this.player.update(time, deltaMs);
    for (const enemy of this.enemies) {
      if (!enemy.isDefeated) enemy.update(time, deltaMs);
    }
    if (this.portal) this.updatePortalPrompt();
    this.drawMinimap();

    // 배경/구름 흐름. 트윈으로 하면 반복마다 원위치로 튀어서(Phaser 상대값 트윈의 특성)
    // 매 프레임 직접 누적한다 — `combat.ts`의 `createArena` 주석 참고.
    // 구름을 배경보다 더 빠르게 흘려야 하늘에 깊이(원근)가 생긴다.
    if (this.arena.background) this.arena.background.tilePositionX += deltaMs * 0.001;
    if (this.arena.clouds) this.arena.clouds.tilePositionX += deltaMs * 0.004;

    const sprite = this.player.sprite;
    if (sprite?.body) {
      // 스프라이트 원점(프레임 중앙)이 아니라 충돌 박스 중심을 쓴다 — 프레임 위쪽에
      // 여백이 있어서 원점 기준으로 잡으면 빛이 캐릭터보다 위에 뜬다.
      const body = sprite.body as Phaser.Physics.Arcade.Body;
      updateAmbientLightCenter(this, body.center.x, body.center.y);
    }
  }

  /**
   * 게이트 근처 여부를 매 프레임 확인한다.
   * 가까울 때만 머리 위 안내를 보여 주고, 그 상태에서 INTERACT를 막 눌렀을 때만 반응한다.
   */
  private updatePortalPrompt(): void {
    const sprite = this.player.sprite;
    if (!sprite || !this.portal || !this.portalPrompt) return;

    // 클리어 전(콜백이 아직 안 채워짐)에는 가까이 가도 안내를 띄우지 않는다 —
    // 눌러도 반응 없는 버튼처럼 보이면 안 된다.
    const near = this.portalCallback !== null && Math.abs(sprite.x - this.portal.x) < 90;
    this.portalPrompt.setVisible(near);
    if (near) this.portalPrompt.setPosition(sprite.x, sprite.y - 70);

    if (near && this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.portalPrompt.setVisible(false);
      this.portalCallback?.();
      this.portalCallback = null;
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
    // (실험) 상시 조명 셰이더 — 캐릭터 주변만 밝고 나머지는 붉은 그림자로 가라앉는다.
    // 중심 좌표는 `update()`에서 매 프레임 캐릭터 화면 위치로 갱신한다.
    attachAmbientLight(this);

    // 방 1·2는 화면보다 넓게 잡는다. 전투가 있어도 없어도 끝까지 걸어가 게이트를 찾는 구성이라
    // 화면 하나보다는 길어야 진행하는 느낌이 산다. 무한 스크롤은 아니다 — 폭이 고정값이라 끝이 있다.
    // 방 3은 Director가 고른 카운터 방이라 구성이 매번 달라 넓히지 않는다.
    const isTutorialRoom = this.roomId === FIXED_ROOM_SEQUENCE[0];
    const isWideRoom = isTutorialRoom || this.roomId === FIXED_ROOM_SEQUENCE[1];
    const roomWidth = isWideRoom ? TUTORIAL_ROOM_WIDTH : VIEWPORT.width;
    // 바닥 타일은 이제 모든 방이 돌바닥 띠로 통일한다(우즈 타일은 더 안 쓴다).
    // 배경 그림 자체는 방 1만 전용(블러드문), 방 2·3은 기존 폐허 스카이라인을 그대로 쓴다.
    this.arena = createArena(
      this,
      { width: roomWidth, height: VIEWPORT.height },
      TEXTURE.floorTileStone,
      isTutorialRoom ? TEXTURE.backgroundTutorial : TEXTURE.background,
      87,
      // 바닥 틴트 — 튜토리얼(마을)은 어두운 자주, 전투방은 사용자 지정 색.
      isTutorialRoom ? 0x27141d : 0x472b38,
    );

    // 물리 월드 경계도 넓혀야 한다. 안 넓히면 카메라는 늘어나도 플레이어가 옛 경계(1280px)에 막힌다.
    this.physics.world.setBounds(0, 0, roomWidth, VIEWPORT.height);
    // 방이 화면보다 넓을 때만 실제로 스크롤한다 — 좁으면 경계가 뷰포트와 같아 움직일 곳이 없다.
    this.cameras.main.setBounds(0, 0, roomWidth, VIEWPORT.height);

    // (실험) 방 전체에 떠다니는 잔불 입자. 모든 일반 전투방에 건다.
    startAmbientParticles(this, roomWidth, this.arena.bounds.floorY);

    if (isTutorialRoom) {
      for (const decor of ROOM_ONE_DECOR) {
        addDecor(this, decor.key, decor.x, this.arena.bounds.floorY, decor.scale);
      }
    }

    // 전송 게이트. 모든 일반 전투방(1~3) 끝에 세운다. 방 2·3은 적을 다 처치해야
    // (`handleRoomClear`가 콜백을 채워야) 실제로 반응한다 — `updatePortalPrompt`가 안내를
    // 콜백이 있을 때만 보여준다. 가까이 가서 INTERACT를 눌러야 넘어간다.
    // 원본이 커서(426×542) 캐릭터 대비 지나치게 크지 않도록 축소한다.
    const gateX = roomWidth - (isWideRoom ? 260 : 120);
    const portal = this.physics.add.staticSprite(gateX, this.arena.bounds.floorY, TEXTURE.gate);
    portal.setOrigin(0.5, 1);
    portal.setScale(0.6);
    portal.setDepth(2);
    portal.refreshBody();
    // 은은하게 숨쉬듯 — 완전히 정적인 장식과 구분되어 상호작용 가능한 지점임을 알린다.
    this.tweens.add({
      targets: portal,
      alpha: 0.75,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
    });
    this.portal = portal;

    // 게이트 근처 + 실제로 반응할 준비가 됐을 때만 캐릭터 머리 위에 뜨는 안내. 기본은 숨김.
    this.portalPrompt = this.add.text(gateX, 0, `[${KEY_BINDINGS.INTERACT}] 진입`, {
      fontFamily: "monospace",
      fontSize: "16px",
      color: "#f5ece0",
      backgroundColor: "#241a1fcc",
      padding: { x: 6, y: 3 },
    });
    this.portalPrompt.setOrigin(0.5, 1);
    this.portalPrompt.setDepth(11);
    this.portalPrompt.setVisible(false);

    this.interactKey = this.input.keyboard?.addKey(KEY_BINDINGS.INTERACT);

    // 우상단 미니맵. 카메라에 고정하고(setScrollFactor 0) 매 프레임 다시 그린다.
    this.minimap = this.add.graphics();
    this.minimap.setScrollFactor(0);
    this.minimap.setDepth(900);
  }

  /**
   * 미니맵. 방 전체를 작은 사각형에 축소해 지형(검정 실루엣)·적(빨강)·플레이어(노랑)를 찍는다.
   */
  private drawMinimap(): void {
    const minimap = this.minimap;
    const player = this.player.sprite;
    if (!minimap || !player) return;

    const WIDTH = 180;
    const HEIGHT = 62;
    const PAD = 14;
    const x0 = VIEWPORT.width - WIDTH - PAD;
    const y0 = PAD;
    const scaleX = WIDTH / this.arena.bounds.width;
    const scaleY = HEIGHT / VIEWPORT.height;

    minimap.clear();
    minimap.fillStyle(0x060506, 0.55);
    minimap.fillRect(x0, y0, WIDTH, HEIGHT);
    minimap.lineStyle(1, 0xffffff, 0.18);
    minimap.strokeRect(x0, y0, WIDTH, HEIGHT);

    // 지형 — 바닥과 게이트를 검은 실루엣으로.
    const floorTop = y0 + this.arena.bounds.floorY * scaleY;
    minimap.fillStyle(0x000000, 0.9);
    minimap.fillRect(x0, floorTop, WIDTH, HEIGHT - this.arena.bounds.floorY * scaleY);
    if (this.portal) {
      minimap.fillRect(x0 + this.portal.x * scaleX - 2, floorTop - 7, 4, 7);
    }

    minimap.fillStyle(0xff2f36, 1);
    for (const enemy of this.enemies) {
      if (enemy.isDefeated || !enemy.sprite) continue;
      minimap.fillCircle(x0 + enemy.sprite.x * scaleX, y0 + enemy.sprite.y * scaleY, 2.5);
    }

    minimap.fillStyle(0xffd84a, 1);
    minimap.fillCircle(x0 + player.x * scaleX, y0 + player.y * scaleY, 3);
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
      // 매번 같은 피치면 단조롭다 — 살짝 흔들어 타격마다 다르게 들리게 한다.
      playSfx(this, AUDIO.hitEnemy, { detune: Phaser.Math.Between(-200, 200) });

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

    // 게이트는 충돌·오버랩이 아니라 `update()`의 거리 판정 + INTERACT 키로 반응한다
    // (`updatePortalPrompt` 참조) — 부딪히기만 해도 넘어가면 실수로 지나칠 수 있다는 피드백 반영.
  }

  private spawnEnemy(spawn: EnemySpawn, _preset: RoomPreset): void {
    const enemy = this.createEnemy(spawn.type);
    enemy.spawn(this.arena.bounds.width * spawn.xRatio, this.arena.bounds.floorY - 60);
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

    // 모든 일반 전투방(1~3)은 게이트를 밟아야 다음 단계로 넘어간다.
    // 방 1(적 없음)은 `RoomController`가 방 시작과 동시에 이미 클리어를 끝내 두므로
    // 콜백만 미리 채워 두는 셈이고, 방 2·3은 마지막 적을 잡는 순간 채워진다.
    this.awaitPortal(() => {
      if (runState.roomIndex >= LAST_COMBAT_ROOM_INDEX) {
        this.resolveDeception(telemetry);
        return;
      }

      if (this.roomId === FIXED_ROOM_SEQUENCE[0]) {
        // 튜토리얼은 전투 데이터가 없어 분석이 의미 없다(전부 0). 곧장 강화로 넘어간다.
        this.offerUpgrade();
        return;
      }

      runState.setPhase("ANALYSIS");
      runState.attachAnalysis(analyze(telemetry, runState.previousTelemetry));
      // 분석 팝업을 닫으면 강화 선택으로 넘어간다.
      this.once("ui:continue", () => this.offerUpgrade());
    });
  }

  /** 방 1 전용. 게이트에 닿으면 `onReached`를 한 번 실행한다. */
  private awaitPortal(onReached: () => void): void {
    this.portalCallback = onReached;
  }

  /** OQ-016 미결정 — 지금은 방 1·방 2 클리어 후 두 번만 지급한다. */
  private offerUpgrade(): void {
    runState.setPhase("UPGRADE");
    eventBus.emit("upgrade:offer", { choices: rollUpgradeChoices(runState.selectedUpgrades) });

    this.once("upgrade:select", ({ upgradeId }) => {
      runState.addUpgrade(upgradeId);
      this.goToNextRoom();
    });
  }

  private goToNextRoom(): void {
    const nextIndex = runState.roomIndex + 1;

    // 방 3은 Director가 고른 카운터 방이다. 그 외에는 고정 순서를 쓴다.
    const nextRoomId =
      nextIndex >= LAST_COMBAT_ROOM_INDEX
        ? (runState.counterRoomId ?? "counter_mixed")
        : FIXED_ROOM_SEQUENCE[nextIndex - 1];

    playSfx(this, AUDIO.portal);
    portalWipeOut(this, () => this.scene.restart({ roomId: nextRoomId }));
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

    this.once("ui:continue", () => {
      playSfx(this, AUDIO.portal);
      portalWipeOut(this, () => this.scene.start("Boss"));
    });
  }

  /** 사망해도 런이 끝나지 않는다 — 체력을 채워 튜토리얼 방으로 돌려보낸다. (사용자 확정) */
  private handlePlayerDeath(): void {
    runState.respawnAtTutorial();
    playSfx(this, AUDIO.portal);
    portalWipeOut(this, () => this.scene.restart({ roomId: FIXED_ROOM_SEQUENCE[0] }));
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
