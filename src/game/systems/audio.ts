/**
 * 전투 효과음·BGM 재생. Phaser 내장 사운드 시스템을 쓴다.
 *
 * UI 효과음(`components/ui/sfx.ts`)은 `HTMLAudioElement` 풀을 쓰는 별도 경로다 — 거긴
 * 메뉴 밖에서 재생될 일이 없어 굳이 Phaser 씬에 묶지 않았다. 전투 효과음은 씬 생명주기와
 * 얽혀 있어(피격, 발사 등) Phaser 사운드 매니저로 재생한다.
 *
 * 음량은 `settingsStore`(localStorage)를 그대로 읽는다. React 상태가 아니라 순수 함수라
 * Phaser 씬에서 곧장 불러도 안전하다.
 */

import type Phaser from "phaser";

import { loadAudioSettings } from "@/components/ui/settingsStore";

import { eventBus } from "../EventBus";
import { AUDIO } from "../types/combat";

/** 발소리는 원본 볼륨이 너무 커서 sfx 슬라이더 값 위에 한 번 더 깎는다. */
const FOOTSTEP_SCALE = 0.35;

const sfxVolume = (): number => {
  const s = loadAudioSettings();
  return s.master * s.sfx;
};

const bgmVolume = (): number => {
  const s = loadAudioSettings();
  return s.master * s.bgm;
};

type LoopKind = "bgm" | "footstep";

/**
 * BGM·발소리처럼 재생 중에 오래 살아있는 루프만 여기 등록한다.
 * 한 번 쏘고 끝나는 효과음(playSfx)은 재생 시점에 볼륨을 읽으므로 등록할 필요가 없다.
 */
const activeLoops = new Map<Phaser.Sound.BaseSound, LoopKind>();

const loopVolume = (kind: LoopKind): number =>
  kind === "bgm" ? bgmVolume() : sfxVolume() * FOOTSTEP_SCALE;

// 설정 패널에서 슬라이더를 바꾸는 순간, 지금 재생 중인 루프에 곧장 반영한다.
// 씬 모듈이 임포트될 때 한 번만 구독하면 되므로 모듈 최상단에 둔다.
// `scene.sound.add()`가 반환하는 BaseSound 타입엔 volume이 없다 — 실제 런타임은 항상
// WebAudioSound나 HTML5AudioSound라 volume이 있는데, 매니저가 공용 베이스 타입으로만
// 알려준다. 여기서만 좁혀 쓴다.
eventBus.on("audio:change", () => {
  for (const [sound, kind] of activeLoops) {
    (sound as unknown as { volume: number }).volume = loopVolume(kind);
  }
});

export const playSfx = (
  scene: Phaser.Scene,
  key: string,
  opts?: { detune?: number; delay?: number },
): void => {
  const volume = sfxVolume();
  if (volume <= 0) return;
  const play = () => scene.sound.play(key, { volume, detune: opts?.detune ?? 0 });
  if (opts?.delay) scene.time.delayedCall(opts.delay, play);
  else play();
};

/**
 * 이미 같은 트랙이 재생 중이면 다시 시작하지 않는다 — 방 전환마다 끊겼다 재생되면 거슬린다.
 * 방 1(마을)에서 방 2(전투)로 넘어가는 것처럼 트랙이 바뀌는 경우엔 이전 트랙을 먼저 끈다.
 */
export const startRoomBgm = (scene: Phaser.Scene, key: string): void => {
  // `.get()`은 멈춘 소리도 매니저에 남아있는 한 계속 돌려준다 — 재생 중인지는
  // `isPlaying`으로 따로 확인해야 한다. 여기서 존재만 보고 넘어가면, 한 번이라도
  // stopRoomBgm을 거친 뒤엔 이 트랙이 다시는 재생되지 않는다.
  const existing = scene.sound.get(key) as Phaser.Sound.BaseSound | undefined;
  if (existing?.isPlaying) return;
  stopRoomBgm(scene);
  const sound = scene.sound.add(key, { loop: true, volume: bgmVolume() });
  activeLoops.set(sound, "bgm");
  sound.play();
};

export const stopRoomBgm = (scene: Phaser.Scene): void => {
  for (const key of [AUDIO.bgmCombat, AUDIO.bgmVillage, AUDIO.bgmBoss]) {
    const sound = scene.sound.get(key);
    if (!sound) continue;
    activeLoops.delete(sound);
    // stop만 하면 매니저에 죽은 소리로 남아 다음 startRoomBgm의 "이미 있음" 판정을 속인다.
    sound.destroy();
  }
};

/** 달리는 동안만 도는 루프 발소리. Player가 직접 인스턴스를 들고 시작/정지를 관리한다. */
export const startFootsteps = (scene: Phaser.Scene): Phaser.Sound.BaseSound => {
  const sound = scene.sound.add(AUDIO.footstepRun, { loop: true, volume: loopVolume("footstep") });
  activeLoops.set(sound, "footstep");
  sound.play();
  return sound;
};

export const stopFootsteps = (sound: Phaser.Sound.BaseSound): void => {
  activeLoops.delete(sound);
  sound.stop();
  sound.destroy();
};
