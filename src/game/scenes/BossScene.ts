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

import { neoDunggeunmo } from "@/styles/fonts";

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
import { classify } from "../systems/DirectorPolicy";
import { runState } from "../systems/RunState";
import { AUDIO, createArena, DEPTH, TEXTURE, type CombatArena } from "../types/combat";
import type { AttackMode, UpgradeElement } from "../types/game";

export class BossScene extends Phaser.Scene {
  private telemetry = new CombatTelemetryRecorder();
  private player!: Player;
  private arena!: CombatArena;
  private boss!: Boss;
  private subscriptions: (() => void)[] = [];
  private finished = false;
  /** 그림자가 아직 깨어나지 않았다 — 상호작용 프롬프트를 보여주고 근접을 감시한다. */
  private awakened = false;
  private awakenPrompt: Phaser.GameObjects.Container | null = null;
  private interactKey?: Phaser.Input.Keyboard.Key;

  /** `?debug=1` 전용 플레이어 좌표 표시. */
  private debugPosText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super("Boss");
  }

  create(): void {
    this.finished = false;
    this.subscriptions = [];
    this.cameras.main.fadeIn(300);
    runState.setPhase("BOSS");
    startRoomBgm(this, AUDIO.bgmBoss);

    this.cameras.main.setBackgroundColor("#140b10");
    // 전투방과 같은 피격 셰이더. 보스전만 연출이 빠지면 격이 낮아 보인다.
    attachHitFx(this);
    attachGlitchFx(this);
    // 보스방 진입 — 세계가 한 번 크게 일그러지며 시작한다.
    pulseGlitchFx(this, 0.8, 650);
    this.telemetry.begin(this.time.now);

    // 보스방은 야외 폐허 스카이라인 대신 실내 고딕 성당 배경을 직접 깐다 — 구름 없이,
    // 방 크기(1280×720)와 그림 비율(1672×941)이 거의 같아 늘리지 않고 꽉 채운다.
    this.add
      .image(0, 0, TEXTURE.bossThrone)
      .setOrigin(0, 0)
      .setDisplaySize(VIEWPORT.width, VIEWPORT.height)
      .setDepth(DEPTH.background);
    this.arena = createArena(this, VIEWPORT, TEXTURE.bossFloorTile, undefined, 52, 0x3a1c28);
    // 전투방과 같은 핏빛 비 — 보스전만 하늘이 맑으면 톤이 끊긴다.
    startBloodRain(this, VIEWPORT.width, this.arena.bounds.floorY);
    startDreamMist(this, VIEWPORT.width, this.arena.bounds.floorY);

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
    this.boss.spawn(VIEWPORT.width * 0.55, this.arena.bounds.floorY - 90);

    // 상호작용 전까지는 방 가운데 그림자로 서 있을 뿐이다 — 다가가 말을 걸어야 깨어난다.
    // (사용자 요청: 보스룸 NPC형 그림자 → 상호작용 시 보스전 시작)
    this.awakenPrompt = this.buildInteractPrompt("깨운다");
    this.interactKey = this.input.keyboard?.addKey(KEY_BINDINGS.INTERACT);

    this.wireCollisions();

    // 확정된 가중치를 UI(F1 디버그 패널)에 한 번 더 알린다.
    eventBus.emit("boss:weights", { weights: runState.bossWeights });

    // 개발·시연 전용 보스 스킵. 배포본에서 실수로 눌리지 않도록 `?debug=1`일 때만 붙인다.
    if (debugFlag("debug")) {
      this.input.keyboard?.on(`keydown-${KEY_BINDINGS.DEBUG_SKIP_ROOM}`, () => this.finish(true));
      // 플레이어 월드 좌표. NPC·오브젝트 배치 좌표를 게임 안에서 바로 읽는 용도다.
      this.debugPosText = this.add
        .text(12, VIEWPORT.height - 28, "", {
          fontFamily: "'Pretendard', sans-serif",
          fontSize: "14px",
          color: "#7ee787",
          resolution: 2,
        })
        .setScrollFactor(0)
        .setDepth(950);
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

    // 일시정지 메뉴의 포기하기. 패배와 같은 흐름으로 튜토리얼 방에 되돌아간다.
    this.once("run:giveup", () => this.finish(false));
  }

  update(time: number, deltaMs: number): void {
    if (this.finished) return;
    this.player.update(time, deltaMs);
    this.boss.update(time, deltaMs);
    if (!this.awakened) this.updateAwakenPrompt();

    if (this.debugPosText && this.player.sprite) {
      this.debugPosText.setText(
        `x ${Math.round(this.player.sprite.x)}  y ${Math.round(this.player.sprite.y)}`,
      );
      // 인트로 줌·줌 펀치가 scrollFactor 0 텍스트까지 밀어내므로 역보정으로 고정.
      const cam = this.cameras.main;
      const inv = 1 / cam.zoom;
      this.debugPosText.setScale(inv);
      this.debugPosText.setPosition(
        cam.width / 2 + (12 - cam.width / 2) * inv,
        cam.height / 2 + (VIEWPORT.height - 28 - cam.height / 2) * inv,
      );
    }
  }

  /**
   * 그림자 근처에서만 뜨는 상호작용 프롬프트. 전투방 방랑자와 같은 규약 —
   * 가까이 가면 보이고, 그 자리에서 상호작용 키를 누르면 딱 한 번만 반응한다.
   */
  private updateAwakenPrompt(): void {
    const player = this.player.sprite;
    const boss = this.boss.sprite;
    if (!player || !boss || !this.awakenPrompt) return;

    const near = Math.abs(player.x - boss.x) < 140;
    this.awakenPrompt.setVisible(near);
    // 보스가 아니라 플레이어 머리 위에 띄운다 — 보스는 커서 시선이 위로 튄다.
    // 스프라이트 셀 위 여백을 피해 충돌 바디 상단을 머리 높이로 쓴다.
    if (near) {
      const body = player.body as Phaser.Physics.Arcade.Body;
      this.awakenPrompt.setPosition(player.x, body.top - 16);
    }

    if (near && this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.awakenBoss();
    }
  }

  /** 그림자가 깨어난다 — 프롬프트를 치우고 실체화 연출과 함께 진짜 보스전을 연다. */
  private awakenBoss(): void {
    this.awakened = true;
    this.awakenPrompt?.destroy();
    this.awakenPrompt = null;
    this.boss.awaken();
    this.runBossIntro();
  }

  /**
   * 상호작용 안내 프롬프트. [키캡] + 라벨을 어두운 알약 위에 얹는다.
   * `CombatScene.buildInteractPrompt`와 같은 문법 — 게임 전체가 상호작용을
   * 이 모양 하나로 알려 준다.
   */
  private buildInteractPrompt(labelText: string): Phaser.GameObjects.Container {
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

    const KEYCAP = 22;
    const pillWidth = 12 + KEYCAP + 8 + label.width + 12;
    const pillHeight = 34;

    const graphics = this.add.graphics();
    graphics.fillStyle(0x10150f, 0.88);
    graphics.fillRoundedRect(-pillWidth / 2, -pillHeight, pillWidth, pillHeight, pillHeight / 2);
    graphics.lineStyle(1, 0xffffff, 0.12);
    graphics.strokeRoundedRect(-pillWidth / 2, -pillHeight, pillWidth, pillHeight, pillHeight / 2);
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
   * 충돌 판정은 여기 한 곳에서만 건다. 전투방과 같은 규약이다. (types/combat.ts)
   * 보스는 접촉 피해를 주지 않는다. 패턴 공격체로만 때린다. (MVP_PLAN §8)
   */
  private wireCollisions(): void {
    const arena = this.arena;

    this.physics.add.overlap(arena.playerAttacks, arena.enemyBodies, (attackObj, bodyObj) => {
      // 그림자 상태에선 공격이 통하지 않는다. Boss.takeDamage도 스스로 막지만,
      // 여기서 안 끊으면 데미지 숫자·타격음·이펙트가 떠서 맞는 것처럼 보인다.
      if (!this.awakened) return;

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

      // 보스는 몸이 커서 스프라이트 원점(셀 중심)에 이펙트를 찍으면 어디를 베든
      // 같은 자리에 뜬다. 무기 판정체의 중심을 보스 몸 범위로 클램프한 실제
      // 접점에 데미지 숫자·피격 이펙트를 띄운다.
      const bossSprite = bodyObj as Phaser.GameObjects.Sprite;
      const bossBody = bossSprite.body as Phaser.Physics.Arcade.Body;
      const attackBody = (attack as { body?: Phaser.Physics.Arcade.Body }).body;
      const hitX = Phaser.Math.Clamp(
        attackBody?.center.x ?? bossSprite.x,
        bossBody.left,
        bossBody.right,
      );
      const hitY = Phaser.Math.Clamp(
        attackBody?.center.y ?? bossSprite.y,
        bossBody.top,
        bossBody.bottom,
      );
      damageNumber(this, hitX, hitY - 20, damage);
      this.applyElement(attack.getData("element") as UpgradeElement | undefined, target);

      // 보스전 텔레메트리도 같은 방식으로 기록한다. 결과 리포트에 쓰인다.
      const mode = attack.getData("mode") as AttackMode | undefined;
      if (mode) this.player.notifyHit(mode, { x: hitX, y: hitY });

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
      // 사슬 포획 — 패링으로 반사하지 않았을 때만 끌려간다. 반사면 이미 이겼다는 뜻이다.
      if (!result.perfect) this.applyChainPull(attack);
      if (attack.getData("consumeOnHit")) attack.destroy();
    });
  }

  /**
   * 사슬 포획 판정체(`Boss.executeChainPull`)가 실어 보낸 `pull` 데이터를 읽어
   * 플레이어를 보스 쪽으로 당긴다. 데이터가 없는 보통 공격체는 그대로 지나간다.
   */
  private applyChainPull(attack: Phaser.GameObjects.GameObject): void {
    const pull = attack.getData("pull") as
      | { towardX: number; distance: number; durationMs: number }
      | undefined;
    if (!pull) return;

    const sprite = this.player.sprite;
    if (!sprite) return;

    const dir = Math.sign(pull.towardX - sprite.x) || 1;
    const half = TUNING.body.width / 2;
    const targetX = Phaser.Math.Clamp(
      sprite.x + dir * pull.distance,
      half,
      this.arena.bounds.width - half,
    );
    this.tweens.add({ targets: sprite, x: targetX, duration: pull.durationMs, ease: "power2.out" });
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
    // 카메라는 실제 보스 자리로 다가간다 — 스폰 좌표가 바뀌면 같이 따라온다.
    const bossX = this.boss.sprite?.x ?? VIEWPORT.width * 0.55;

    this.boss.holdPatterns(4600);

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

    cam.pan(bossX, VIEWPORT.height * 0.55, 1100, "Sine.easeInOut");
    cam.zoomTo(1.28, 1100, "Sine.easeInOut");

    const name = this.add
      .text(VIEWPORT.width / 2, VIEWPORT.height * 0.24, "「 집 행 자 」", {
        fontFamily: `${neoDunggeunmo.style.fontFamily}, sans-serif`,
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
      delay: 800,
      duration: 600,
      ease: "power2.out",
    });

    // 이름 밑의 부제 — 세계관(그림자 침식)과 이 보스의 역할을 한 줄로 잇는다.
    const subtitle = this.add
      .text(VIEWPORT.width / 2, VIEWPORT.height * 0.315, "이름들을 거두는 자", {
        fontFamily: `${neoDunggeunmo.style.fontFamily}, sans-serif`,
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
      delay: 1300,
      duration: 500,
      ease: "power2.out",
    });

    this.time.delayedCall(3400, () => {
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

    const bossTelemetry = this.telemetry.end(this.time.now, this.player.hp);
    runState.hp = this.player.hp;
    // 보스전에서 실제로 어떻게 싸웠는지. 표시 전용이라 가중치는 건드리지 않는다 —
    // 보스전 중 재분석은 하지 않는다는 계약 그대로다. (MVP_PLAN §8)
    runState.setBossStyle(classify(bossTelemetry).style);

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
