/**
 * 일반 전투방 1~3을 담당한다. (MVP_PLAN §9)
 *
 * 이 씬은 흐름만 관리한다. 전투 자체는 Player와 적 클래스가 담당한다.
 *
 *   방 시작 → 전투 → 클리어 → 분석 → 강화 → 다음 방
 *   방 3 클리어 후에는 역기만 판정 → 강화(3회차) → 보스로 넘어간다. (OQ-016 RESOLVED, DEC-015)
 *
 * 분석 팝업과 강화 선택 UI는 React에 있다. (DEC-006)
 * 이 씬은 이벤트를 쏘고 `ui:continue` / `upgrade:select` 응답을 기다린다.
 * UI 응답 대기는 여기 두 지점뿐이며, 그 외에는 UI가 없어도 런이 성립한다.
 */

import Phaser from "phaser";

import { eventBus, type GameEventMap } from "../EventBus";
import { debugFlag, TUTORIAL_ROOM_WIDTH, VIEWPORT } from "../config/gameConfig";
import { KEY_BINDINGS } from "../config/inputConfig";
import { SOFT_COUNTER_ROOM_2_BY_STYLE } from "../data/directorRules";
import { FIXED_ROOM_SEQUENCE, getRoomPreset } from "../data/rooms";
import { ROOM_ONE_DECOR } from "../data/roomOneDecor";
import type { EngravingId } from "../data/engravings";
import { NPC_EVENT } from "../data/npcEvents";
import { SHOP } from "../data/shop";
import { UPGRADES, UPGRADE_IDS } from "../data/upgrades";
import { Player, TUNING, type ItemProc } from "../entities/Player";
import { BaseEnemy } from "../entities/enemies/BaseEnemy";
import { ChaserEnemy } from "../entities/enemies/ChaserEnemy";
import { MobilityCounterEnemy } from "../entities/enemies/MobilityCounterEnemy";
import { RangedEnemy } from "../entities/enemies/RangedEnemy";
import {
  ashRise,
  attachAmbientLight,
  attachGlitchFx,
  attachHitFx,
  castPlatformShadows,
  damageNumber,
  portalWipeOut,
  pulseGlitchFx,
  shardDrop,
  startAmbientParticles,
  startBloodRain,
  startDreamMist,
  updateAmbientLightCenter,
} from "../systems/CombatVfx";
import { playSfx, startRoomBgm } from "../systems/audio";
import { CombatTelemetryRecorder } from "../systems/CombatTelemetry";
import { analyze, bossWeightsFor, classify, evaluateDeception } from "../systems/DirectorPolicy";
import { RoomController } from "../systems/RoomController";
import { engravingSnapshot, unlockEngraving } from "../systems/Engravings";
import { rollUpgradeChoices } from "../systems/UpgradeSystem";
import { runState } from "../systems/RunState";
import {
  addDecor,
  AUDIO,
  createArena,
  PLAYER_SPRITE,
  playerAnimKey,
  TEXTURE,
  type CombatArena,
} from "../types/combat";
import type {
  AttackMode,
  CombatTelemetry,
  EnemySpawn,
  EnemyType,
  RoomId,
  RoomPreset,
  UpgradeElement,
  UpgradeId,
} from "../types/game";

export interface CombatSceneData {
  roomId?: RoomId;
}

/** 방 3이 마지막 일반 방이다. 이후는 보스전이다. */
const LAST_COMBAT_ROOM_INDEX = 3;

/** 낭떠러지에 떨어졌을 때 깎이는 체력. */
const FALL_DAMAGE = 15;

/**
 * 기본 줌. 서 있는 상태가 기본값이라 화면이 늘 이 배율로 다가와 있다 —
 * 움직이거나 적이 살아 있으면 즉시 시야를 넓혀 되돌린다(전투 중 좁은 시야는 억울한 피격을 만든다).
 */
const IDLE_ZOOM = { zoom: 1.22, inMs: 2600, outMs: 420 } as const;


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
  private portalPrompt: Phaser.GameObjects.Container | null = null;
  /** 게이트를 상호작용하면 실행할 다음 단계. `awaitPortal`이 채우고 상호작용 시 비운다. */
  private portalCallback: (() => void) | null = null;
  private interactKey?: Phaser.Input.Keyboard.Key;
  /** 우상단 미니맵. 매 프레임 다시 그린다 — 사각형 몇 개라 비용이 없다. */
  private minimap: Phaser.GameObjects.Graphics | null = null;
  /** 마을 그림자 상인. 조각을 받고 강화를 판다 — 마을(방 1)에만 선다. */
  private merchant: Phaser.GameObjects.Sprite | null = null;
  private merchantPrompt: Phaser.GameObjects.Container | null = null;
  /** 이번 방문에 상인이 파는 강화. 방 진입 시 한 번 굴린다 — 열 때마다 바뀌면 고민할 이유가 없다. */
  private shopChoices: UpgradeId[] = [];
  /** 전투방의 방랑자 NPC. 말을 걸면 우호/적대로 갈리고, 한 번 반응하면 끝이다. */
  private wanderer: Phaser.GameObjects.Sprite | null = null;
  private wandererPrompt: Phaser.GameObjects.Container | null = null;
  /** 마을 기록 제단(각인). 조각으로 영구 해금을 새긴다. */
  private altar: Phaser.GameObjects.Container | null = null;
  private altarPrompt: Phaser.GameObjects.Container | null = null;
  /** 방랑자가 돌변한 매복. 클리어 카운트와는 분리하되(DEC-014 #4), 잔적 표시와 방 종료 정리에는 포함한다. */
  private ambushes: BaseEnemy[] = [];
  /** 기본 줌이 걸려 있는지. false면 움직이거나 적이 있어 시야를 넓혀 둔 상태다. */
  private idleZoomed = false;

  constructor() {
    super("Combat");
  }

  init(data: CombatSceneData): void {
    this.roomId = data.roomId ?? FIXED_ROOM_SEQUENCE[0];
    this.enemies = [];
    this.ambushes = [];
    this.subscriptions = [];
    // scene.restart는 인스턴스를 재사용한다 — 이전 방의 상인·방랑자 참조가 남으면
    // 파괴된 스프라이트의 잔존 좌표에 대고 상호작용이 열린다(실제로 방 2에서 상점이 열렸다).
    this.merchant = null;
    this.merchantPrompt = null;
    this.wanderer = null;
    this.wandererPrompt = null;
    this.altar = null;
    this.altarPrompt = null;
    this.shopChoices = [];
    this.portal = null;
    this.portalPrompt = null;
    this.portalCallback = null;
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
      getShards: () => runState.shards,
      gainShards: (amount) => {
        runState.addShards(amount);
        this.player.emitHud();
      },
      consumeRoomShield: () => runState.consumeRoomShield(),
      roomMeleeDamageBuffActive: () => runState.roomMeleeDamageBuffActive,
      onDamaged: (amount) => runState.damage(amount),
      onDeath: () => this.handlePlayerDeath(),
    });

    // 런 전체에서 체력이 이어지도록 이전 방에서 남은 값을 넘긴다. (OQ-008 미결정)
    this.player.maxHp = runState.maxHp;
    this.player.hp = runState.hp;

    this.room = new RoomController({
      scene: this,
      telemetry: this.telemetry,
      spawnEnemy: (spawn, preset) => this.spawnEnemy(spawn, preset),
      getRemainingHp: () => this.player.hp,
      onRoomClear: (telemetry) => this.handleRoomClear(telemetry),
      resolveWaveOverride: (telemetrySoFar, waveIndex) =>
        this.resolveWaveOverride(telemetrySoFar, waveIndex),
    });

    this.player.spawn(this.arena.bounds.width * 0.15, this.arena.bounds.floorY - 80);
    // 마을(방 1)에 들어설 때만 기상 연출 — 처음 시작이든 부활이든 "깨어난다"로 시작한다.
    if (this.roomId === FIXED_ROOM_SEQUENCE[0]) this.player.playIntro();
    // 충돌 연결은 플레이어 스프라이트가 생긴 뒤에 건다.
    this.wireCollisions();

    // 방이 화면보다 넓을 때 카메라가 플레이어를 따라간다. lerp가 낮아 스냅되지 않고 조금씩 붙는다.
    if (this.player.sprite) {
      this.cameras.main.startFollow(this.player.sprite, true, 0.08, 0.08);
    }

    runState.beginRoom(this.roomId);
    this.room.start(this.roomId);
    this.player.emitHud(this.liveEnemyCount, runState.roomIndex);

    // 개발·시연 전용 방 스킵. 배포본에서 실수로 눌려 방이 통째로 넘어가지 않게
    // `?debug=1`일 때만 붙인다. 남은 적도 함께 정리한다 — 안 그러면 클리어된 방에서
    // 적만 계속 공격한다.
    if (debugFlag("debug")) {
      this.input.keyboard?.on(`keydown-${KEY_BINDINGS.DEBUG_SKIP_ROOM}`, () => {
        for (const enemy of this.enemies) {
          if (!enemy.isDefeated) enemy.takeDamage(9999);
        }
        this.room.forceClear();
      });
    }

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

    // 상점 구매. 검증(잔액·품목)은 여기서만 한다 — React는 표시와 입력만 담당한다.
    this.subscriptions.push(
      eventBus.on("shop:buy", ({ upgradeId }) => this.handleShopBuy(upgradeId)),
    );

    // 각인 새기기. 성공하면 갱신 스냅샷을 다시 쏴 패널이 열린 채로 갱신되게 한다.
    this.subscriptions.push(eventBus.on("engrave:buy", ({ id }) => this.handleEngraveBuy(id)));
  }

  update(time: number, deltaMs: number): void {
    this.player.update(time, deltaMs);
    for (const enemy of this.enemies) {
      if (!enemy.isDefeated) enemy.update(time, deltaMs);
      // 낭떠러지에 떨어진 적은 낙사 처리한다. 안 하면 화면 밖에 산 채로 남아 방이 안 끝난다.
      if (!enemy.isDefeated && enemy.sprite && enemy.sprite.y > VIEWPORT.height + 40) {
        enemy.takeDamage(9999);
      }
    }
    this.checkPlayerFall();
    if (this.portal) this.updatePortalPrompt();
    if (this.merchant) this.updateMerchantPrompt();
    if (this.wanderer) this.updateWandererPrompt();
    if (this.altar) this.updateAltarPrompt();
    this.updateIdleZoom(time);
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
    // 상시 글리치 — 마지막에 붙여 화면 전체 위에 얹는다. 방 진입 순간 한 번 크게 튄다.
    attachGlitchFx(this);
    pulseGlitchFx(this, 0.55, 500);

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
      // 튜토리얼은 장식 배치가 고정이라 평평하게 둔다. 전투방만 랜덤 지형.
      isTutorialRoom ? undefined : this.rollLayout(roomWidth),
    );

    // 물리 월드 경계. 아래로 여유를 둬야 낭떠러지에서 화면 밖까지 떨어지는 게 보인다 —
    // 딱 화면 높이면 collideWorldBounds가 틈 바닥에서 캐릭터를 받쳐 얕은 웅덩이가 된다.
    this.physics.world.setBounds(0, 0, roomWidth, VIEWPORT.height + 300);
    // 방이 화면보다 넓을 때만 실제로 스크롤한다 — 좁으면 경계가 뷰포트와 같아 움직일 곳이 없다.
    this.cameras.main.setBounds(0, 0, roomWidth, VIEWPORT.height);

    // (실험) 방 전체에 떠다니는 잔불 입자. 모든 일반 전투방에 건다.
    startAmbientParticles(this, roomWidth, this.arena.bounds.floorY);
    startBloodRain(this, roomWidth, this.arena.bounds.floorY);
    // 몽환 안개 3겹 + 달빛 사광 그림자 — 화면의 공기 밀도를 만든다.
    startDreamMist(this, roomWidth, this.arena.bounds.floorY);
    castPlatformShadows(this, this.arena.platforms, this.arena.bounds.floorY);

    if (isTutorialRoom) {
      for (const decor of ROOM_ONE_DECOR) {
        addDecor(this, decor.key, decor.x, this.arena.bounds.floorY, decor.scale);
      }
      this.spawnMerchant();
      this.spawnAltar();
    } else {
      // 전투방에도 폐허 장식을 몇 개 흩뿌린다. 지형과 함께 매 방 랜덤이라 방마다 표정이 다르다.
      // 낭떠러지 위에 뜨지 않게 바닥 조각 위로만 보정한다.
      const decorCount = Phaser.Math.Between(3, 4);
      for (let i = 0; i < decorCount; i += 1) {
        const decor = Phaser.Utils.Array.GetRandom([...ROOM_ONE_DECOR]);
        const x = this.groundedSpawnX(Phaser.Math.Between(90, roomWidth - 90));
        // recede=true — 전투방에서는 구조물이 적보다 눈에 띄면 안 된다.
        addDecor(this, decor.key, x, this.arena.bounds.floorY, decor.scale, true);
      }

    }

    // 전송 게이트. 방 2·3은 적을 다 처치해야(`handleRoomClear`가 콜백을 채워야) 반응한다.
    // 가까이 가서 INTERACT를 눌러야 넘어간다. 원본이 커서(426×542) 축소해 세운다.
    // 위치도 지형처럼 랜덤 — 단 시작 지점 근처는 피하고, 낭떠러지 위로는 못 가게 보정한다.
    const gateX = isTutorialRoom
      ? roomWidth - 260
      : this.groundedSpawnX(
          Phaser.Math.Between(Math.round(roomWidth * 0.4), Math.round(roomWidth * 0.92)),
        );
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
    // 어두운 알약형 배경 + 주황 키캡 + 라벨 — 참고 스크린샷의 콘솔 게임식 프롬프트 문법.
    this.portalPrompt = this.buildInteractPrompt();

    this.interactKey = this.input.keyboard?.addKey(KEY_BINDINGS.INTERACT);

    // 방랑자 — 게이트 위치가 정해진 뒤에 세운다. 게이트 옆에 서면 W 프롬프트가
    // 겹쳐 "들어가기"와 "말 걸기"가 한 자리에서 다투기 때문이다(spawnWanderer가 거리를 벌린다).
    if (!isTutorialRoom && Phaser.Math.FloatBetween(0, 1) < NPC_EVENT.spawnChance) {
      this.spawnWanderer(roomWidth);
    }

    // 우상단 미니맵. 카메라에 고정하고(setScrollFactor 0) 매 프레임 다시 그린다.
    this.minimap = this.add.graphics();
    this.minimap.setScrollFactor(0);
    this.minimap.setDepth(900);
  }

  /**
   * 상호작용 안내 프롬프트. [키캡] + "들어가기"를 어두운 알약 위에 얹는다.
   * 컨테이너 원점은 알약의 가운데 아래 — 캐릭터 머리 위에 세울 때의 기준점이다.
   */
  private buildInteractPrompt(labelText = "문 열기"): Phaser.GameObjects.Container {
    const label = this.add.text(0, 0, labelText, {
      fontFamily: "'Pretendard', sans-serif",
      fontSize: "16px",
      fontStyle: "bold",
      color: "#f5ece0",
      resolution: 2,
    });
    label.setOrigin(0, 0.5);

    const keyLabel = this.add.text(0, 0, KEY_BINDINGS.INTERACT, {
      fontFamily: "'Pretendard', sans-serif",
      fontSize: "13px",
      fontStyle: "bold",
      color: "#4a2408",
      resolution: 2,
    });
    keyLabel.setOrigin(0.5, 0.5);

    // 배치 계산: [키캡 22px] [간격 8px] [라벨] 좌우 여백 12px.
    const KEYCAP = 22;
    const pillWidth = 12 + KEYCAP + 8 + label.width + 12;
    const pillHeight = 34;

    const graphics = this.add.graphics();
    // 알약 배경 — 짙은 바탕에 옅은 테두리.
    graphics.fillStyle(0x10150f, 0.88);
    graphics.fillRoundedRect(-pillWidth / 2, -pillHeight, pillWidth, pillHeight, pillHeight / 2);
    graphics.lineStyle(1, 0xffffff, 0.12);
    graphics.strokeRoundedRect(-pillWidth / 2, -pillHeight, pillWidth, pillHeight, pillHeight / 2);
    // 주황 키캡 — 아래로 살짝 어두운 두 겹으로 눌린 입체감.
    const keyX = -pillWidth / 2 + 12;
    const keyY = -pillHeight / 2 - KEYCAP / 2;
    graphics.fillStyle(0xa85511, 1);
    graphics.fillRoundedRect(keyX, keyY + 2, KEYCAP, KEYCAP, 6);
    graphics.fillStyle(0xe8912c, 1);
    graphics.fillRoundedRect(keyX, keyY, KEYCAP, KEYCAP, 6);

    keyLabel.setPosition(keyX + KEYCAP / 2, keyY + KEYCAP / 2);
    label.setPosition(keyX + KEYCAP + 8, -pillHeight / 2);

    const container = this.add.container(0, 0, [graphics, keyLabel, label]);
    container.setDepth(11);
    container.setVisible(false);
    return container;
  }

  /**
   * 낭떠러지 낙사. 화면 아래로 떨어지면 체력을 깎고 방 시작 지점에 다시 세운다.
   * 낙사로 체력이 0이 되면 takeDamage 안에서 사망 흐름(튜토리얼 복귀)이 그대로 이어진다.
   */
  private checkPlayerFall(): void {
    const sprite = this.player.sprite;
    if (!sprite?.body || this.player.isDead) return;
    if (sprite.y <= VIEWPORT.height + 40) return;

    // 떨어지지 않는 깃털 — 낙사 자리는 그대로 되돌리되 피해만 면한다.
    if (!runState.selectedUpgrades.includes("MOBILITY_FEATHER")) {
      this.player.takeDamage(FALL_DAMAGE);
      if (this.player.isDead) return;
    }

    sprite.setPosition(this.arena.bounds.width * 0.15, this.arena.bounds.floorY - 80);
    (sprite.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.cameras.main.flash(180, 20, 0, 0);
  }

  /**
   * 절차적 지형 생성. (DEC-014 #5)
   *
   * 로그라이크답게 들어갈 때마다 다른 방 — 바닥 틈과 3층 발판을 열(column) 단위로
   * 굴려 수직으로 얽힌 미로형 경로를 만든다. 규칙으로 도달 가능성을 보장한다:
   * - 좁은 틈(110~150px)은 점프(약 190px)로 건넌다.
   * - 넓은 틈(170~230px)은 점프로 못 건넌다 — 반드시 그 위에 다리 발판을 놓는다.
   * - 2·3층은 바로 아래층 발판 위에서 점프로 닿는 수평 거리 안에만 세운다.
   *   닿을 수 없는 장식 발판을 만들지 않기 위한 규칙이다.
   *
   * ponytail: 아레나가 바닥+원웨이 발판만 지원해 "벽이 있는 진짜 미로"는 아직 못
   * 만든다 — createArena에 벽 지원을 넣은 뒤의 일이다. (OpenQuestions 등록)
   */
  private rollLayout(roomWidth: number): {
    gaps: { x: number; width: number }[];
    platforms: { x: number; y: number; width: number }[];
  } {
    const floorY = VIEWPORT.height - 48;
    // 1층은 점프 한 번(최대 도약 약 97px), 2·3층은 아래층에서 다시 점프.
    const TIER_Y = [floorY - 80, floorY - 160, floorY - 235] as const;

    const gaps: { x: number; width: number }[] = [];
    const platforms: { x: number; y: number; width: number }[] = [];

    // 1) 바닥 틈 — 시작 지점(왼쪽 20%)과 게이트 앞(오른쪽 20%)은 피한다.
    const gapCount = Phaser.Math.Between(2, 3);
    const zoneStart = roomWidth * 0.2;
    const zoneEnd = roomWidth * 0.8;
    const zoneWidth = (zoneEnd - zoneStart) / gapCount;
    for (let i = 0; i < gapCount; i += 1) {
      const wide = Phaser.Math.FloatBetween(0, 1) < 0.4;
      const gapWidth = wide ? Phaser.Math.Between(170, 230) : Phaser.Math.Between(110, 150);
      // 각 구획 안에서만 굴려 틈끼리 붙지 않게 한다.
      const x = Phaser.Math.Between(
        Math.round(zoneStart + i * zoneWidth),
        Math.round(zoneStart + (i + 1) * zoneWidth - gapWidth - 60),
      );
      gaps.push({ x, width: gapWidth });

      if (wide) {
        const bridgeWidth = Phaser.Math.Between(120, 170);
        platforms.push({
          x: Math.round(x + gapWidth / 2 - bridgeWidth / 2),
          y: TIER_Y[0],
          width: bridgeWidth,
        });
      }
    }

    // 2) 층층 발판 — 열마다 1층을 굴리고, 선 자리 위로만 2·3층을 계단처럼 쌓는다.
    const COLUMN = 260;
    const columns = Math.max(1, Math.floor((roomWidth * 0.72) / COLUMN));
    for (let c = 0; c < columns; c += 1) {
      if (Phaser.Math.FloatBetween(0, 1) >= 0.65) continue;

      const baseX = roomWidth * 0.14 + c * COLUMN;
      const width = Phaser.Math.Between(130, 210);
      const x = Math.round(baseX + Phaser.Math.Between(0, Math.max(0, COLUMN - width)));
      platforms.push({ x, y: TIER_Y[0], width });

      if (Phaser.Math.FloatBetween(0, 1) < 0.5) {
        const upperWidth = Phaser.Math.Between(110, 170);
        const upperX = Phaser.Math.Clamp(
          x + Phaser.Math.Between(-70, 70),
          40,
          roomWidth - upperWidth - 40,
        );
        platforms.push({ x: upperX, y: TIER_Y[1], width: upperWidth });

        // 드물게 3층 — 방의 꼭대기. 올라가 보는 재미와 원거리 견제 위치를 만든다.
        if (Phaser.Math.FloatBetween(0, 1) < 0.35) {
          const topWidth = Phaser.Math.Between(100, 140);
          const topX = Phaser.Math.Clamp(
            upperX + Phaser.Math.Between(-60, 60),
            40,
            roomWidth - topWidth - 40,
          );
          platforms.push({ x: topX, y: TIER_Y[2], width: topWidth });
        }
      }
    }

    return { gaps, platforms };
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

    // 지형 — 바닥 조각·발판·게이트를 검은 실루엣으로. 틈이 있으면 그대로 끊겨 보인다.
    const floorTop = y0 + this.arena.bounds.floorY * scaleY;
    minimap.fillStyle(0x000000, 0.9);
    for (const segment of this.arena.floorSegments) {
      minimap.fillRect(
        x0 + segment.x * scaleX,
        floorTop,
        segment.width * scaleX,
        HEIGHT - this.arena.bounds.floorY * scaleY,
      );
    }
    for (const platform of this.arena.platforms) {
      minimap.fillRect(x0 + platform.x * scaleX, y0 + platform.y * scaleY, platform.width * scaleX, 2);
    }
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

      const damage = (attack.getData("damage") as number) ?? 0;
      enemy.takeDamage(damage);
      // 매번 같은 피치면 단조롭다 — 살짝 흔들어 타격마다 다르게 들리게 한다.
      playSfx(this, AUDIO.hitEnemy, { detune: Phaser.Math.Between(-200, 200) });
      const hitTarget = bodyObj as Phaser.GameObjects.Sprite;
      damageNumber(this, hitTarget.x, hitTarget.y - 20, damage);
      this.applyElement(attack.getData("element") as UpgradeElement | undefined, enemy);

      // 적중 시 속성 부여 아이템 14종 — 각자 독립된 확률로 굴린다(한 타에 여럿 붙을 수 있다).
      const itemProcs = attack.getData("itemProcs") as ItemProc[] | undefined;
      if (itemProcs) {
        for (const proc of itemProcs) {
          if (Math.random() < proc.chance) {
            this.applyItemProcElement(proc.element, enemy, hitTarget.x, hitTarget.y);
          }
        }
      }

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
      const damage = (attack.getData("damage") as number) ?? undefined;
      const result = this.player.takeDamage(damage);
      // 퍼펙트 패링 — 공격을 낸 쪽에게 같은 피해를 그대로 되돌린다.
      if (result.perfect) {
        const source = attack.getData("source") as { takeDamage: (amount: number) => void } | undefined;
        source?.takeDamage(damage ?? 0);
        // 붉은 파편 — 반사할 때 상대에게 출혈(추가 피해)을 더 얹는다.
        if (source && runState.selectedUpgrades.includes("ITEM_RED_SHARD")) {
          source.takeDamage(TUNING.upgrade.itemParryReflectBonusDamage);
        }
      }
      if (attack.getData("consumeOnHit")) attack.destroy();
    });

    // 적 본체 접촉 → 플레이어
    this.physics.add.overlap(arena.enemyBodies, playerBody, (bodyObj) => {
      const enemy = (bodyObj as Phaser.GameObjects.GameObject).getData("enemy") as
        | BaseEnemy
        | undefined;
      if (!enemy || enemy.isDefeated) return;
      const result = this.player.takeDamage(enemy.definition.contactDamage);
      if (result.perfect) enemy.takeDamage(enemy.definition.contactDamage);
      // 가시 왕관 — 접촉 피해를 받을 때마다 그 적도 피해를 입는다.
      if (runState.selectedUpgrades.includes("ITEM_THORN_CROWN")) {
        enemy.takeDamage(TUNING.upgrade.itemThornReflectDamage);
      }
    });

    // 게이트는 충돌·오버랩이 아니라 `update()`의 거리 판정 + INTERACT 키로 반응한다
    // (`updatePortalPrompt` 참조) — 부딪히기만 해도 넘어가면 실수로 지나칠 수 있다는 피드백 반영.
  }

  /**
   * 속성 부가 효과. 화염은 시간차 화상 틱(추가 타격 판정을 새로 만들지 않고 직접
   * takeDamage를 부른다), 냉기는 적의 speedMultiplier를 잠깐 낮춘다.
   */
  private applyElement(element: UpgradeElement | undefined, enemy: BaseEnemy): void {
    if (!element) return;
    const { upgrade } = TUNING;

    if (element === "FIRE") {
      for (let i = 1; i <= upgrade.fireTickCount; i += 1) {
        this.time.delayedCall(i * upgrade.fireTickIntervalMs, () => {
          if (enemy.isDefeated || !enemy.sprite) return;
          // takeDamage가 이 틱으로 적을 죽이면 그 안에서 sprite가 null이 된다.
          // 좌표는 죽기 전에 먼저 읽어 둔다.
          const { x, y } = enemy.sprite;
          enemy.takeDamage(upgrade.fireTickDamage);
          damageNumber(this, x, y - 30, upgrade.fireTickDamage);
        });
      }
    } else if (element === "FROST") {
      enemy.applySlow(upgrade.frostSlowFactor, upgrade.frostSlowMs);
    } else if (element === "POISON") {
      // 맹독 — 화상과 같은 틱 패턴이되 더 약하게, 더 오래.
      for (let i = 1; i <= upgrade.poisonTickCount; i += 1) {
        this.time.delayedCall(i * upgrade.poisonTickIntervalMs, () => {
          if (enemy.isDefeated || !enemy.sprite) return;
          const { x, y } = enemy.sprite;
          enemy.takeDamage(upgrade.poisonTickDamage);
          damageNumber(this, x, y - 30, upgrade.poisonTickDamage);
        });
      }
    }
  }

  /**
   * 적중 시 속성 부여 아이템 14종의 실제 효과. 불·냉기·독은 applyElement의 로직을 그대로
   * 재사용하고, 나머지 4속성만 여기서 새로 정의한다 — 홀리는 적이 아니라 플레이어를 치료한다.
   */
  private applyItemProcElement(
    element: UpgradeElement,
    enemy: BaseEnemy,
    x: number,
    y: number,
  ): void {
    const { upgrade } = TUNING;

    if (element === "FIRE" || element === "FROST" || element === "POISON") {
      this.applyElement(element, enemy);
      return;
    }

    if (element === "BLEED") {
      for (let i = 1; i <= upgrade.itemBleedTickCount; i += 1) {
        this.time.delayedCall(i * upgrade.itemBleedTickIntervalMs, () => {
          if (enemy.isDefeated || !enemy.sprite) return;
          const { x: ex, y: ey } = enemy.sprite;
          enemy.takeDamage(upgrade.itemBleedTickDamage);
          damageNumber(this, ex, ey - 30, upgrade.itemBleedTickDamage);
        });
      }
    } else if (element === "DARK") {
      if (enemy.isDefeated) return;
      enemy.takeDamage(upgrade.itemDarkBonusDamage);
      damageNumber(this, x, y - 30, upgrade.itemDarkBonusDamage);
    } else if (element === "SHOCK") {
      for (const other of this.enemies) {
        if (other.isDefeated || !other.sprite) continue;
        if (Phaser.Math.Distance.Between(x, y, other.sprite.x, other.sprite.y) > upgrade.itemShockRadiusPx) continue;
        other.takeDamage(upgrade.itemShockDamage);
        damageNumber(this, other.sprite.x, other.sprite.y - 30, upgrade.itemShockDamage);
      }
    } else if (element === "HOLY") {
      this.player.heal(upgrade.itemHolyProcHeal);
    }
  }

  private spawnEnemy(spawn: EnemySpawn, _preset: RoomPreset): void {
    const enemy = this.createEnemy(spawn.type);
    enemy.spawn(this.groundedSpawnX(this.arena.bounds.width * spawn.xRatio), this.arena.bounds.floorY - 60);
    this.enemies.push(enemy);
    this.player.emitHud(this.liveEnemyCount, runState.roomIndex);
  }

  /** 스폰 지점이 낭떠러지 위면 가장 가까운 바닥 조각 위로 옮긴다. 나오자마자 낙사하면 안 된다. */
  private groundedSpawnX(x: number): number {
    const MARGIN = 40;
    let best = x;
    let bestDistance = Infinity;
    for (const segment of this.arena.floorSegments) {
      if (segment.width < MARGIN * 2) continue;
      const clamped = Phaser.Math.Clamp(x, segment.x + MARGIN, segment.x + segment.width - MARGIN);
      const distance = Math.abs(clamped - x);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = clamped;
      }
    }
    return best;
  }

  private createEnemy(type: EnemyType): BaseEnemy {
    const deps = {
      scene: this,
      arena: this.arena,
      getPlayerPosition: () => {
        const sprite = this.player.sprite as Phaser.GameObjects.Sprite | null;
        return { x: sprite?.x ?? 0, y: sprite?.y ?? 0 };
      },
      onDefeated: (x: number, y: number) => {
        // 처치 집계의 유일한 관문 — 직격이든 화상·독 틱이든 낙사든 여길 지난다.
        // (예전엔 공격 오버랩에서만 세서 틱·낙사 킬이 빠졌다.)
        runState.recordKill();
        this.player.notifyKill(x, y);
        this.dropShards(x, y);
        this.room.onEnemyDefeated();
        this.player.emitHud(this.liveEnemyCount, runState.roomIndex);
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

  // ────────────────────────────── 방랑자 NPC ──────────────────────────────

  /**
   * 방랑자 스폰. 상인과 같은 실루엣 기법이되 푸른빛 — 정체를 알 수 없는 존재라는 신호다.
   * 시작 지점과 게이트 근처는 피해 방 가운데쯤에 세운다.
   */
  private spawnWanderer(roomWidth: number): void {
    let x = this.groundedSpawnX(
      Phaser.Math.Between(Math.round(roomWidth * 0.3), Math.round(roomWidth * 0.7)),
    );
    // 게이트와 최소 거리를 벌린다 — 겹치면 W 한 번에 "들어가기"와 "말 걸기"가 다툰다.
    for (
      let attempt = 0;
      attempt < 5 && this.portal && Math.abs(x - this.portal.x) < 180;
      attempt += 1
    ) {
      x = this.groundedSpawnX(
        Phaser.Math.Between(Math.round(roomWidth * 0.3), Math.round(roomWidth * 0.7)),
      );
    }
    const floorY = this.arena.bounds.floorY;

    const wanderer = this.add.sprite(x, floorY, PLAYER_SPRITE.key);
    wanderer.setOrigin(0.5, PLAYER_SPRITE.footY / PLAYER_SPRITE.frameHeight);
    wanderer.setScale(1.2);
    wanderer.setDepth(9);
    wanderer.setTintFill(0x141d2e);
    wanderer.setAlpha(0.85);
    wanderer.play(playerAnimKey("idle"));
    if (this.game.renderer.type === Phaser.WEBGL) {
      wanderer.postFX.addGlow(0x5f8cff, 2, 0);
    }
    // 이따금 흐려졌다 돌아온다 — 이 세계의 존재가 아니라는 낌새.
    this.tweens.add({
      targets: wanderer,
      alpha: 0.55,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
    });

    this.wanderer = wanderer;
    this.wandererPrompt = this.buildInteractPrompt("말을 건다");
  }

  private updateWandererPrompt(): void {
    const sprite = this.player.sprite;
    if (!sprite || !this.wanderer || !this.wandererPrompt) return;

    const near = Math.abs(sprite.x - this.wanderer.x) < 80;
    this.wandererPrompt.setVisible(near);
    if (near) this.wandererPrompt.setPosition(sprite.x, sprite.y - 70);

    if (near && this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.wandererPrompt.destroy();
      this.wandererPrompt = null;
      this.resolveWandererEvent();
    }
  }

  /** 말을 건 순간 운명이 갈린다. 우호든 적대든 방랑자는 이 방에서 사라진다. */
  private resolveWandererEvent(): void {
    const wanderer = this.wanderer;
    if (!wanderer) return;
    this.wanderer = null;

    const friendly = Phaser.Math.FloatBetween(0, 1) < NPC_EVENT.friendlyChance;
    const lines = friendly ? NPC_EVENT.lines.friendly : NPC_EVENT.lines.hostile;
    this.speak(wanderer.x, wanderer.y - 96, Phaser.Utils.Array.GetRandom([...lines]));

    if (friendly) {
      // 선물 — 회복 또는 조각, 반반. 준 뒤엔 푸른 재가 되어 흩어진다.
      const givesHeal = Phaser.Math.FloatBetween(0, 1) < 0.5;
      this.time.delayedCall(700, () => {
        if (givesHeal) {
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + NPC_EVENT.healAmount);
          runState.hp = this.player.hp;
          this.player.emitHud();
          damageNumber(this, wanderer.x, wanderer.y - 60, NPC_EVENT.healAmount);
        } else {
          this.dropShardsAt(wanderer.x, wanderer.y - 40, NPC_EVENT.shardGift);
        }
        ashRise(this, wanderer.x, wanderer.y - 40, 0x9db8ff);
        this.tweens.add({
          targets: wanderer,
          alpha: 0,
          duration: 600,
          ease: "power2.in",
          onComplete: () => wanderer.destroy(),
        });
      });
      return;
    }

    // 적대 — 붉게 물드는 예고 후 추격자로 돌변한다. 예고 없이 즉시 덮치지 않는다. (DEC-004)
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: NPC_EVENT.turnDelayMs,
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        wanderer.setTintFill(Phaser.Display.Color.GetColor(20 + t * 160, 29 - t * 20, 46 - t * 30));
      },
      onComplete: () => {
        const { x, y } = wanderer;
        wanderer.destroy();
        this.cameras.main.shake(140, 0.008);
        pulseGlitchFx(this, 0.6, 450);
        ashRise(this, x, y - 40, 0xff2a3a);

        // 방 클리어 카운트와 분리된 매복 — RoomController를 거치지 않는 전용 콜백을 쓴다.
        const ambush = new ChaserEnemy({
          scene: this,
          arena: this.arena,
          getPlayerPosition: () => {
            const sprite = this.player.sprite;
            return { x: sprite?.x ?? 0, y: sprite?.y ?? 0 };
          },
          onDefeated: (dx: number, dy: number) => {
            runState.recordKill();
            this.player.notifyKill(dx, dy);
            this.dropShards(dx, dy);
            this.player.emitHud(this.liveEnemyCount, runState.roomIndex);
          },
        });
        ambush.spawn(x, y - 60);
        this.enemies.push(ambush);
        this.ambushes.push(ambush);
      },
    });
  }

  /** NPC 대사. 머리 위에서 떠올랐다 사라지는 짧은 한 줄 — 패널을 열 만큼의 대화는 아니다. */
  private speak(x: number, y: number, line: string): void {
    const text = this.add.text(x, y, line, {
      fontFamily: "'Pretendard', sans-serif",
      fontSize: "15px",
      color: "#dce6ff",
      stroke: "#0a0d18",
      strokeThickness: 4,
      resolution: 2,
    });
    text.setOrigin(0.5, 1);
    text.setDepth(11);
    text.setAlpha(0);
    this.tweens.add({
      targets: text,
      alpha: 1,
      y: y - 8,
      duration: 220,
      ease: "power2.out",
      onComplete: () => {
        this.tweens.add({
          targets: text,
          alpha: 0,
          y: y - 22,
          delay: 1400,
          duration: 420,
          ease: "power1.in",
          onComplete: () => text.destroy(),
        });
      },
    });
  }

  // ────────────────────────────── 그림자 조각·상인 ──────────────────────────────

  /** 처치 보상 — 그림자 조각. 연출이 끝나 몸에 닿는 순간에 실제로 적립된다. */
  private dropShards(x: number, y: number): void {
    this.dropShardsAt(x, y, Phaser.Math.Between(SHOP.dropPerKill.min, SHOP.dropPerKill.max));
  }

  /** 개수를 지정하는 드랍. 방랑자의 선물처럼 정해진 양을 줄 때 쓴다. */
  private dropShardsAt(x: number, y: number, amount: number): void {
    for (let i = 0; i < amount; i += 1) {
      shardDrop(
        this,
        x,
        y,
        () => {
          const sprite = this.player.sprite;
          return sprite ? { x: sprite.x, y: sprite.y } : null;
        },
        () => {
          runState.addShards(1);
          this.player.emitHud();
        },
      );
    }
  }

  /**
   * 마을 그림자 상인. 플레이어와 같은 시트를 어둠으로 채워 "그림자"로 세운다 —
   * 전용 그림 없이도 인간형 실루엣이 나오고, 조각을 먹는 존재라는 톤과도 맞는다.
   */
  private spawnMerchant(): void {
    const x = SHOP.merchantX;
    const floorY = this.arena.bounds.floorY;

    const merchant = this.add.sprite(x, floorY, PLAYER_SPRITE.key);
    // 발끝(footY)이 바닥선에 닿게 원점을 잡는다 — 프레임 아래 여백만큼 뜨는 것을 막는다.
    merchant.setOrigin(0.5, PLAYER_SPRITE.footY / PLAYER_SPRITE.frameHeight);
    merchant.setScale(1.2);
    // 입구(왼쪽)에서 걸어오는 플레이어를 바라본다.
    merchant.setFlipX(true);
    merchant.setDepth(9);
    merchant.setTintFill(0x241430);
    merchant.setAlpha(0.92);
    merchant.play(playerAnimKey("idle"));
    if (this.game.renderer.type === Phaser.WEBGL) {
      merchant.postFX.addGlow(0x8a5cff, 2.5, 0);
    }

    // 머리 위를 맴도는 보랏빛 결정 — 거래 대상이 조각이라는 말 없는 간판이다.
    const gemY = floorY - 110;
    const gem = this.add.graphics({ x, y: gemY });
    gem.setDepth(9);
    gem.setBlendMode(Phaser.BlendModes.ADD);
    gem.fillStyle(0x6a3bd8, 0.9);
    gem.fillPoints(
      [
        { x: 0, y: -7 },
        { x: 5, y: 0 },
        { x: 0, y: 7 },
        { x: -5, y: 0 },
      ],
      true,
    );
    gem.fillStyle(0xd8c2ff, 0.95);
    gem.fillPoints(
      [
        { x: 0, y: -3.5 },
        { x: 2.5, y: 0 },
        { x: 0, y: 3.5 },
        { x: -2.5, y: 0 },
      ],
      true,
    );
    this.tweens.add({
      targets: gem,
      y: gemY - 9,
      rotation: 0.35,
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
    });

    this.merchant = merchant;
    this.merchantPrompt = this.buildInteractPrompt("거래한다");

    const pool = UPGRADE_IDS.filter((id) => !runState.selectedUpgrades.includes(id));
    Phaser.Utils.Array.Shuffle(pool);
    this.shopChoices = pool.slice(0, SHOP.choiceCount);
  }

  /** 기본 줌. 서 있으면 곧바로 다가가 있고, 움직이거나 적이 나타나면 즉시 물러난다. */
  private updateIdleZoom(_time: number): void {
    const body = this.player.sprite?.body as Phaser.Physics.Arcade.Body | undefined;
    if (!body || this.player.isDead) return;

    const busy =
      this.room.enemiesRemaining > 0 ||
      Math.abs(body.velocity.x) > 4 ||
      Math.abs(body.velocity.y) > 4;

    if (busy) {
      if (this.idleZoomed) {
        this.idleZoomed = false;
        this.cameras.main.zoomTo(1, IDLE_ZOOM.outMs, "Sine.easeOut");
      }
      return;
    }

    if (!this.idleZoomed) {
      this.idleZoomed = true;
      this.cameras.main.zoomTo(IDLE_ZOOM.zoom, IDLE_ZOOM.inMs, "Sine.easeInOut");
    }
  }

  /**
   * 기록 제단. 떠 있는 금빛 육각 각인석 — 조각으로 영구 해금(각인)을 새기는 곳이다.
   * 마을 초입(시작 지점과 상인 사이)에 세워, 부활 직후 자연스럽게 마주친다.
   */
  private spawnAltar(): void {
    const x = 760;
    const floorY = this.arena.bounds.floorY;

    const stone = this.add.graphics();
    stone.setBlendMode(Phaser.BlendModes.ADD);
    // 육각 각인석 — 겹친 두 테두리 + 중심 결정.
    const hex = (radius: number): { x: number; y: number }[] =>
      [0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
        return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
      });
    stone.lineStyle(2.5, 0xd9b24a, 0.9);
    stone.strokePoints([...hex(30), hex(30)[0]], false);
    stone.lineStyle(1.2, 0xf5e2a8, 0.5);
    stone.strokePoints([...hex(23), hex(23)[0]], false);
    stone.fillStyle(0xf5e2a8, 0.95);
    stone.fillPoints(
      [
        { x: 0, y: -9 },
        { x: 7, y: 0 },
        { x: 0, y: 9 },
        { x: -7, y: 0 },
      ],
      true,
    );

    const container = this.add.container(x, floorY - 78, [stone]);
    container.setDepth(9);
    this.tweens.add({
      targets: container,
      y: floorY - 88,
      angle: 4,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
    });

    // 받침돌 — 떠 있는 돌만 있으면 어디 세워진 건지 모른다.
    const base = this.add.graphics({ x, y: floorY });
    base.fillStyle(0x241a10, 0.9);
    base.fillRect(-26, -14, 52, 14);
    base.fillStyle(0x3a2c1a, 0.9);
    base.fillRect(-18, -22, 36, 8);
    base.setDepth(3);

    this.altar = container;
    this.altarPrompt = this.buildInteractPrompt("기록을 새긴다");
  }

  private updateAltarPrompt(): void {
    const sprite = this.player.sprite;
    if (!sprite || !this.altar || !this.altarPrompt) return;

    const near = Math.abs(sprite.x - this.altar.x) < 80;
    this.altarPrompt.setVisible(near);
    if (near) this.altarPrompt.setPosition(sprite.x, sprite.y - 70);

    if (near && this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.altarPrompt.setVisible(false);
      this.openEngrave();
    }
  }

  /** 제단 열기. 상점과 같은 문법 — 이벤트를 쏘고 스스로 멈춘다. */
  private openEngrave(): void {
    eventBus.emit("engrave:open", { nodes: engravingSnapshot(), shards: runState.shards });
    this.scene.pause();
  }

  /** 각인 확정. 성공하면 갱신 스냅샷을 다시 쏜다 — 패널은 열려 있는 채로 갱신된다. */
  private handleEngraveBuy(id: EngravingId): void {
    if (!unlockEngraving(id, (cost) => runState.spendShards(cost))) return;
    this.player.emitHud();
    eventBus.emit("engrave:open", { nodes: engravingSnapshot(), shards: runState.shards });
  }

  /** 상인 근처 안내와 상호작용. 게이트 프롬프트와 같은 문법이다. */
  private updateMerchantPrompt(): void {
    const sprite = this.player.sprite;
    if (!sprite || !this.merchant || !this.merchantPrompt) return;

    const near = Math.abs(sprite.x - this.merchant.x) < 80;
    this.merchantPrompt.setVisible(near);
    if (near) this.merchantPrompt.setPosition(sprite.x, sprite.y - 70);

    if (near && this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.merchantPrompt.setVisible(false);
      this.openShop();
    }
  }

  /** 상점 열기. 대화창과 같은 문법 — 이벤트를 쏘고 스스로 멈춘다. React가 `game:resume`으로 풀어 준다. */
  private openShop(): void {
    eventBus.emit("shop:open", {
      choices: this.shopChoices.map((id) => UPGRADES[id]),
      shards: runState.shards,
      price: SHOP.price,
    });
    this.scene.pause();
  }

  /** 구매 확정. 잔액·품목 검증에 실패하면 조용히 무시한다 — React가 이미 버튼을 잠근다. */
  private handleShopBuy(upgradeId: UpgradeId): void {
    if (!this.shopChoices.includes(upgradeId)) return;
    // 이미 가진 것에 조각을 쓰면 addUpgrade가 조용히 무시해 조각만 사라진다.
    if (runState.selectedUpgrades.includes(upgradeId)) return;
    if (!runState.spendShards(SHOP.price)) return;
    runState.addUpgrade(upgradeId);
    // HEALTH_MAX_UP은 RunState 쪽 maxHp·hp만 올린다. 즉시 내려주지 않으면 이번 방에서는
    // 아무 일도 일어나지 않고, 방 클리어 때 runState.hp가 덮여 회복분까지 사라진다.
    this.player.maxHp = runState.maxHp;
    this.player.hp = runState.hp;
    this.shopChoices = this.shopChoices.filter((id) => id !== upgradeId);
    this.player.emitHud();

    // 거래 성사의 마침표 — 상인 위에서 결정이 터진다. 씬이 멈춰 있어 재개 직후 보인다.
    if (this.merchant) {
      const flash = this.add.circle(this.merchant.x, this.merchant.y - 50, 8, 0xd8c2ff, 0.9);
      flash.setDepth(10);
      flash.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: flash,
        scale: 4,
        alpha: 0,
        duration: 300,
        ease: "power2.out",
        onComplete: () => flash.destroy(),
      });
    }
  }

  // ────────────────────────────── 흐름 제어 ──────────────────────────────

  private handleRoomClear(telemetry: CombatTelemetry): void {
    // completeRoom은 같은 방에 두 번 호출되면 false를 돌려준다.
    // completeRoom 안에서 HEALTH_REGEN 회복이 일어난다. 씬의 체력을 먼저 올려보내고
    // 회복 결과를 다시 내려받아야 회복분이 덮이지 않는다. 순서를 바꾸면 무효가 된다.
    runState.hp = this.player.hp;
    if (!runState.completeRoom(telemetry)) return;
    this.player.hp = runState.hp;
    this.player.emitHud();

    // 방이 끝났는데 매복만 살아서 계속 때리면 "클리어"가 거짓말이 된다.
    // 처치가 아니라 물러남이다 — defeat()를 거치지 않으므로 킬·조각이 들어가지 않는다.
    for (const ambush of this.ambushes) {
      if (ambush.isDefeated || !ambush.sprite) continue;
      ashRise(this, ambush.sprite.x, ambush.sprite.y, 0xff2a3a);
      ambush.destroy();
    }
    this.ambushes = [];

    // 모든 일반 전투방(1~3)은 게이트를 밟아야 다음 단계로 넘어간다.
    // 방 1(적 없음)은 `RoomController`가 방 시작과 동시에 이미 클리어를 끝내 두므로
    // 콜백만 미리 채워 두는 셈이고, 방 2·3은 마지막 적을 잡는 순간 채워진다.
    this.awaitPortal(() => {
      this.pauseForPanel();
      if (runState.roomIndex >= LAST_COMBAT_ROOM_INDEX) {
        this.resolveDeception(telemetry);
        return;
      }

      if (this.roomId === FIXED_ROOM_SEQUENCE[0]) {
        // 튜토리얼은 전투 데이터가 없어 분석이 의미 없다(전부 0). 곧장 강화로 넘어간다.
        this.offerUpgrade(() => this.goToNextRoom());
        return;
      }

      runState.setPhase("ANALYSIS");
      runState.attachAnalysis(analyze(telemetry, runState.previousTelemetry));
      // 분석 팝업을 닫으면 강화 선택으로 넘어간다.
      this.once("ui:continue", () => this.offerUpgrade(() => this.goToNextRoom()));
    });
  }

  /** 방 1 전용. 게이트에 닿으면 `onReached`를 한 번 실행한다. */
  private awaitPortal(onReached: () => void): void {
    this.portalCallback = onReached;
  }

  /**
   * 방 2의 2·3웨이브 구성을 1웨이브 텔레메트리로 정한다. (OQ-010 RESOLVED, DEC-016)
   *
   * 방 1이 무전투로 바뀌면서(팀원 리디자인) "방 1 분석 → 방 2 반영"이라는 원래 설계의
   * 전제가 사라졌다. 방 2 자체가 이제 3웨이브라, 1웨이브를 관찰용으로 쓰고 2·3웨이브를
   * 그 결과로 조정하는 것으로 개념을 옮겼다. 방 2 외 다른 방(카운터 방 등)은 건드리지 않는다
   * — `RoomController`가 `waveIndex`를 캐시해 두므로 여기서는 2웨이브 진입 시 한 번만
   * 계산하면 3웨이브에도 그대로 재사용된다.
   */
  private resolveWaveOverride(
    telemetrySoFar: CombatTelemetry,
    waveIndex: number,
  ): RoomPreset | undefined {
    if (this.roomId !== FIXED_ROOM_SEQUENCE[1] || waveIndex !== 2) return undefined;
    const style = classify(telemetrySoFar).style;
    return getRoomPreset(SOFT_COUNTER_ROOM_2_BY_STYLE[style]);
  }

  /**
   * 강화 3회 지급(방 1·방 2·방 3 클리어 후). (OQ-016 RESOLVED, DEC-015)
   *
   * `onSelected`가 다음 단계를 결정한다 — 방 1·방 2 후에는 다음 방으로,
   * 방 3 후에는 보스로 넘어간다. 보스 진입은 `scene.restart`가 아니라 `scene.start`라
   * `room:start`가 발생하지 않는다 — React 쪽은 그 대신 `phase:change`(→"BOSS")로
   * 로딩 해제 신호를 받는다(HUDOverlay 참고). 로딩 처리는 두 경로가 같아 여기서
   * 구분할 필요가 없다. `final`은 오직 UI 표시 문구("마지막으로 주어진 것")를 위한 신호다.
   */
  private offerUpgrade(onSelected: () => void, final = false): void {
    runState.setPhase("UPGRADE");
    eventBus.emit("upgrade:offer", {
      choices: rollUpgradeChoices(runState.selectedUpgrades),
      final,
    });

    this.once("upgrade:select", ({ upgradeId }) => {
      runState.addUpgrade(upgradeId);
      onSelected();
    });
  }

  /**
   * 방 1·방 2 클리어 후 다음 방으로 넘어간다. `goToNextRoom`은 이 두 경우에만
   * 호출된다(방 3 클리어는 `resolveDeception`이 별도 처리) — 즉 `nextIndex`는
   * 항상 2(→방 2) 또는 3(→방 3) 둘 중 하나이고, 그 외 값은 나오지 않는다.
   *
   * 방 2는 항상 `room_2`(1웨이브 고정 구성)로 들어간다 — 방 1이 무전투로 바뀌면서
   * "방 1 분석으로 방 2 자체를 고른다"는 원래 방식(OQ-010 RESOLVED, DEC-016)의 전제가
   * 사라졌다. 소프트 카운터는 이제 방 2 안에서 1웨이브 텔레메트리로 2·3웨이브 구성을
   * 바꾸는 방식으로 옮겨졌다 — `resolveWaveOverride` 참고.
   */
  private goToNextRoom(): void {
    this.resumeFromPanel();
    const nextIndex = runState.roomIndex + 1;

    // 방 3 — Director가 고른 카운터 방(3기). 그 외(방 2)는 고정 순서를 쓴다. (MVP_PLAN §5)
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

    // 역기만 결과를 닫으면 보스 진입 전 마지막 강화를 지급한다. (OQ-016 RESOLVED, DEC-015)
    this.once("ui:continue", () =>
      this.offerUpgrade(() => {
        this.resumeFromPanel();
        playSfx(this, AUDIO.portal);
        portalWipeOut(this, () => this.scene.start("Boss"));
      }, true),
    );
  }

  /**
   * 사망해도 런이 끝나지 않는다 — 검은 결과창(생존 시간·처치 수)을 먼저 보여주고,
   * 닫으면 체력을 채워 튜토리얼 방으로 돌려보낸다. (사용자 확정)
   */
  private handlePlayerDeath(): void {
    // 세계가 크게 일그러진다 — 침식에 삼켜지는 순간의 글리치.
    pulseGlitchFx(this, 1, 700);
    eventBus.emit("respawn:summary", {
      survivedMs: runState.attemptDurationMs(this.time.now),
      kills: runState.kills,
    });
    // 결과창이 떠 있는 동안 적이 시체를 계속 때리지 않게 씬을 멈춘다.
    this.scene.pause();
    this.once("ui:continue", () => {
      this.scene.resume();
      runState.respawnAtTutorial(this.time.now);
      playSfx(this, AUDIO.portal);
      portalWipeOut(this, () => this.scene.restart({ roomId: FIXED_ROOM_SEQUENCE[0] }));
    });
  }

  // ────────────────────────────── 유틸 ──────────────────────────────

  /** 패널이 떠 있는 동안 씬을 멈춘다. 상점·대화창과 같은 문법이다. */
  private pauseForPanel(): void {
    if (!this.scene.isPaused()) this.scene.pause();
  }

  /**
   * 패널을 닫고 씬을 되돌린다.
   * 전환 연출(`portalWipeOut`)은 트윈이라, 멈춘 채로 부르면 영원히 끝나지 않는다.
   * 화면을 넘기기 전에 반드시 먼저 부른다.
   */
  private resumeFromPanel(): void {
    if (this.scene.isPaused()) this.scene.resume();
  }

  /** HUD에 찍히는 잔적 수. 매복은 클리어를 막지 않지만, 살아 있는데 0으로 보이면 거짓말이다. */
  private get liveEnemyCount(): number {
    return (
      this.room.enemiesRemaining +
      this.ambushes.filter((enemy) => !enemy.isDefeated && enemy.sprite).length
    );
  }

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
