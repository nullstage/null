import gsap from "gsap";

import { assetPath } from "@/game/config/gameConfig";

/**
 * React 레이어의 UI 효과음.
 *
 * 전투 효과음은 Phaser 내장 사운드를 쓴다. 여기는 캔버스 밖 UI 소리만 담당한다.
 * 0.3초 남짓한 소리라 매번 새 `Audio`를 만든다. 연달아 눌러도 앞 소리가 끊기지 않는다.
 */

export const SFX = {
  select: assetPath("audio/ui-select.mp3"),
  move: assetPath("audio/ui-move.mp3"),
} as const;

/** 겹쳐 울리던 소리가 사라지는 데 걸리는 시간. 길면 다음 소리와 뭉친다. */
const FADE_OUT_SEC = 0.12;

/**
 * `retrigger` 재생용 슬롯. 소리마다 인스턴스 몇 개를 돌려 쓴다.
 * 하나만 두면 되감을 때 울리던 소리가 뚝 끊긴다.
 */
const voices = new Map<string, { pool: HTMLAudioElement[]; index: number }>();

/** 설정에서 계산한 실제 음량(마스터 × 효과음). 0이면 재생하지 않는다. */
let volume = 0;

export const setSfxVolume = (next: number): void => {
  volume = Math.min(1, Math.max(0, next));
};

/**
 * 울리던 소리를 짧게 지우면서 새 소리를 얹는다.
 *
 * 되감기만 하면 앞 소리가 뚝 끊겨 귀에 걸린다. 페이드인은 넣지 않는다.
 * 이동음은 첫 순간이 또렷해야 반응이 붙는 느낌이 난다.
 */
const retrigger = (src: string): void => {
  let slot = voices.get(src);
  if (!slot) {
    // 셋이면 아주 빠르게 오가도 아직 사라지는 중인 소리를 다시 뺏지 않는다.
    slot = { pool: [new Audio(src), new Audio(src), new Audio(src)], index: 0 };
    voices.set(src, slot);
  }

  const previous = slot.pool[slot.index];
  slot.index = (slot.index + 1) % slot.pool.length;
  const next = slot.pool[slot.index];

  if (!previous.paused) {
    gsap.killTweensOf(previous);
    gsap.to(previous, {
      volume: 0,
      duration: FADE_OUT_SEC,
      ease: "power1.out",
      onComplete: () => previous.pause(),
    });
  }

  gsap.killTweensOf(next);
  next.volume = volume;
  next.currentTime = 0;
  void next.play().catch(() => {});
};

/**
 * `retrigger`를 켜면 같은 소리가 겹쳐 쌓이지 않는다.
 * 메뉴 이동처럼 빠르게 연달아 나는 소리에 쓴다.
 */
export const playSfx = (src: string, options?: { retrigger?: boolean }): void => {
  if (volume <= 0) return;

  if (options?.retrigger) {
    retrigger(src);
    return;
  }

  const audio = new Audio(src);
  audio.volume = volume;
  // 자동 재생이 막혀도 조용히 넘어간다. 소리 때문에 조작이 멈추면 안 된다.
  void audio.play().catch(() => {});
};
