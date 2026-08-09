/**
 * 에셋 로딩과 초기화.
 *
 * OQ-024 미결정 — 아트 에셋이 아직 없다. 지금은 도형 플레이스홀더 텍스처만 만든다.
 * 에셋이 들어오면 `preload`에서 `assetPath()`로 경로를 만들어 로드한다.
 * GitHub Pages 하위 경로 때문에 상대 경로를 직접 쓰면 배포에서 깨진다. (DEC-005)
 */

import Phaser from "phaser";

import { eventBus } from "../EventBus";
import { assetPath } from "../config/gameConfig";
import { ROOM_ONE_DECOR } from "../data/roomOneDecor";
import { runState } from "../systems/RunState";
import {
  AUDIO,
  BOSS_ANIM,
  ENEMY_ANIM,
  PLAYER_INTRO_ANIM,
  PLAYER_SPRITE,
  SILHOUETTE,
  TEXTURE,
  playerAnimKey,
  type PlayerAnimState,
} from "../types/combat";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload(): void {
    // 보스는 아직 도형이다. 플레이어·근접형·원거리형은 스프라이트로 교체됐다. (OQ-024)
    this.load.spritesheet(PLAYER_SPRITE.key, assetPath(PLAYER_SPRITE.path), {
      frameWidth: PLAYER_SPRITE.frameWidth,
      frameHeight: PLAYER_SPRITE.frameHeight,
    });
    // 적1(원거리)·적2(근접) 시트를 원본 그대로 64px 정사각 그리드로 로드한다.
    this.load.spritesheet(TEXTURE.ranged, assetPath("sprites/enemies/ranged.png"), {
      frameWidth: 64,
      frameHeight: 64,
    });
    this.load.spritesheet(TEXTURE.chaser, assetPath("sprites/enemies/chaser.png"), {
      frameWidth: 64,
      frameHeight: 64,
    });
    // 보스 — 패턴별 예고/타격 포즈 10칸. 애니메이션이 아니라 프레임을 골라 쓴다.
    this.load.spritesheet(TEXTURE.boss, assetPath("sprites/boss/boss.png"), {
      frameWidth: 224,
      frameHeight: 224,
    });
    // 시작·부활 시 앉았다 일어나는 인트로 4프레임.
    this.load.spritesheet(TEXTURE.playerIntro, assetPath("sprites/player/player-intro.png"), {
      frameWidth: PLAYER_SPRITE.frameWidth,
      frameHeight: PLAYER_SPRITE.frameHeight,
    });
    // 보스 체력바 장식 프레임.
    this.load.image(TEXTURE.bossHpFrame, assetPath("ui/boss-hp-frame.png"));
    // (실험) 방 2·3 배경. 보스방은 아직 이 텍스처를 쓰지 않는다.
    this.load.image(TEXTURE.background, assetPath("backgrounds/ruins-dusk.png"));
    // (실험) 방 1~3 공용 — 돌바닥 띠, 전송 게이트, 방 1 전용 배경/장식들.
    this.load.image(TEXTURE.backgroundTutorial, assetPath("backgrounds/ruins-bloodmoon.png"));
    this.load.image(TEXTURE.floorTileStone, assetPath("decor/walls/wall-strip-floor.png"));
    this.load.image(TEXTURE.gate, assetPath("decor/gate/gate-full.png"));
    this.load.image(TEXTURE.clouds, assetPath("decor/clouds.png"));
    for (const decor of ROOM_ONE_DECOR) {
      this.load.image(decor.key, assetPath(decor.path));
    }
    // 전투 효과음·BGM. (OQ 없음 — 사용자가 제공한 파일을 그대로 매핑)
    this.load.audio(AUDIO.swordHit1, assetPath("audio/sword-hit-1.mp3"));
    this.load.audio(AUDIO.swordHit2, assetPath("audio/sword-hit-2.mp3"));
    this.load.audio(AUDIO.swordHit3, assetPath("audio/sword-hit-3.mp3"));
    this.load.audio(AUDIO.gunShot, assetPath("audio/gun-shot.mp3"));
    this.load.audio(AUDIO.shellDrop, assetPath("audio/shell-drop.mp3"));
    this.load.audio(AUDIO.hitEnemy, assetPath("audio/hit-enemy.mp3"));
    this.load.audio(AUDIO.parry, assetPath("audio/parry.mp3"));
    this.load.audio(AUDIO.footstepRun, assetPath("audio/footstep-run.mp3"));
    this.load.audio(AUDIO.dash, assetPath("audio/dash.mp3"));
    this.load.audio(AUDIO.portal, assetPath("audio/portal.mp3"));
    this.load.audio(AUDIO.bgmCombat, assetPath("audio/bgm-combat.mp3"));
    this.load.audio(AUDIO.bgmVillage, assetPath("audio/bgm-village.mp3"));
    this.createPlaceholderTextures();
  }

  create(): void {
    this.registerPlayerAnimations();
    this.registerIntroAnimation();
    this.registerFrameAnimations(ENEMY_ANIM);
    this.registerFrameAnimations(BOSS_ANIM);
    runState.reset(this.time.now);
    runState.setPhase("READY");
    this.scene.start("Ready");
  }

  /**
   * 플레이어 애니메이션 등록.
   *
   * 씬마다 다시 만들지 않고 부팅 때 한 번만 만든다. 전투방과 보스방이 같은 것을 쓴다.
   * 시트가 6열이므로 프레임 번호는 `행 * 6 + 열`로 계산한다.
   */
  private registerPlayerAnimations(): void {
    for (const [state, spec] of Object.entries(PLAYER_SPRITE.states)) {
      const key = playerAnimKey(state as PlayerAnimState);
      if (this.anims.exists(key)) continue;

      const start = spec.row * PLAYER_SPRITE.columns;
      const frames = this.anims.generateFrameNumbers(PLAYER_SPRITE.key, {
        start,
        end: start + spec.frames - 1,
      });

      // 프레임마다 머무는 시간이 다른 상태가 있다. 공격이 그렇다.
      // 전부 같은 길이로 넘기면 그림이 좋아도 기계적으로 보인다.
      const durations = "frameDurations" in spec ? spec.frameDurations : null;
      if (durations) {
        frames.forEach((frame, index) => {
          frame.duration = durations[index] ?? 0;
        });
      }

      this.anims.create({
        key,
        frames,
        frameRate: spec.fps,
        repeat: spec.loop ? -1 : 0,
      });
    }
  }

  /** 시작·부활 시 한 번 재생하는 기상 애니메이션. 마지막 프레임이 idle 0번과 같아 자연히 이어진다. */
  private registerIntroAnimation(): void {
    if (this.anims.exists(PLAYER_INTRO_ANIM)) return;
    this.anims.create({
      key: PLAYER_INTRO_ANIM,
      frames: this.anims.generateFrameNumbers(TEXTURE.playerIntro, { start: 0, end: 3 }),
      // 일어나는 동작이라 뒤로 갈수록 빨라지는 편이 자연스럽다.
      frameRate: 5,
      repeat: 0,
    });
  }

  /** {키: 프레임 구간} 형태의 애니메이션 테이블을 등록한다. 적·보스가 같은 셰이프를 쓴다. */
  private registerFrameAnimations(set: Record<string, { key: string; start: number; frames: number; fps: number; loop: boolean }>): void {
    for (const [key, spec] of Object.entries(set)) {
      if (this.anims.exists(key)) continue;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(spec.key, {
          start: spec.start,
          end: spec.start + spec.frames - 1,
        }),
        frameRate: spec.fps,
        repeat: spec.loop ? -1 : 0,
      });
    }
  }

  /**
   * 에셋 없이도 형태를 구분할 수 있게 단색 사각형 텍스처를 만든다. (OQ-024)
   * 색은 `types/combat.ts`의 팔레트를 따른다. 스프라이트가 들어오면 이 함수만 걷어내면 된다.
   * chaser·ranged는 이제 실제 시트를 쓰므로 여기서 만들지 않는다(이미 존재해 스킵됨).
   */
  private createPlaceholderTextures(): void {
    const swatches: Record<string, number> = {
      [TEXTURE.player]: SILHOUETTE.player,
      [TEXTURE.playerAttack]: SILHOUETTE.playerAttack,
      [TEXTURE.mobility]: SILHOUETTE.mobility,
      [TEXTURE.enemyAttack]: SILHOUETTE.enemyAttack,
      [TEXTURE.telegraph]: SILHOUETTE.telegraph,
      [TEXTURE.hazard]: SILHOUETTE.hazard,
      [TEXTURE.solid]: SILHOUETTE.solid,
    };

    for (const [key, color] of Object.entries(swatches)) {
      if (this.textures.exists(key)) continue;
      const graphics = this.make.graphics({ x: 0, y: 0 }, false);
      graphics.fillStyle(color, 1);
      graphics.fillRect(0, 0, 8, 8);
      graphics.generateTexture(key, 8, 8);
      graphics.destroy();
    }
  }

  /** 씬 정리 시 이벤트 버스 구독이 누적되지 않도록 한다. */
  shutdown(): void {
    eventBus.emit("phase:change", { phase: runState.phase });
  }
}
