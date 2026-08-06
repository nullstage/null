import { assetPath } from "@/game/config/gameConfig";

/**
 * React 레이어의 UI 효과음.
 *
 * 전투 효과음은 Phaser 내장 사운드를 쓴다. 여기는 캔버스 밖 UI 소리만 담당한다.
 * 0.3초 남짓한 소리라 매번 새 `Audio`를 만든다. 연달아 눌러도 앞 소리가 끊기지 않는다.
 */

export const SFX = {
  select: assetPath("audio/ui-select.mp3"),
} as const;

/** 설정에서 계산한 실제 음량(마스터 × 효과음). 0이면 재생하지 않는다. */
let volume = 0;

export const setSfxVolume = (next: number): void => {
  volume = Math.min(1, Math.max(0, next));
};

export const playSfx = (src: string): void => {
  if (volume <= 0) return;

  const audio = new Audio(src);
  audio.volume = volume;
  // 자동 재생이 막혀도 조용히 넘어간다. 소리 때문에 조작이 멈추면 안 된다.
  void audio.play().catch(() => {});
};
