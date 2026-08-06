"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";

import { assetPath } from "@/game/config/gameConfig";

/**
 * 시작 화면 배경음악. 로딩 화면에서 시작해 전투로 넘어갈 때 꺼진다.
 *
 * 브라우저는 사용자 입력 전 자동 재생을 막는다. (CLAUDE.md 배포 규칙)
 * 막히면 조용히 넘어가고 첫 입력 때 다시 시도한다. 재생 실패로 화면이 멈추면 안 된다.
 */

const SRC = assetPath("audio/the-weight-of-silence.mp3");

export default function TitleBgm({ playing, volume }: { playing: boolean; volume: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(SRC);
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
    audioRef.current = audio;

    return () => {
      gsap.killTweensOf(audio);
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    gsap.killTweensOf(audio);

    if (!playing) {
      gsap.to(audio, {
        volume: 0,
        duration: 0.6,
        ease: "power1.in",
        onComplete: () => audio.pause(),
      });
      return;
    }

    let retry: (() => void) | null = null;

    void audio.play().catch(() => {
      // 자동 재생이 막혔다. 첫 입력 때 한 번만 다시 시도한다.
      retry = () => void audio.play().catch(() => {});
      window.addEventListener("pointerdown", retry, { once: true });
      window.addEventListener("keydown", retry, { once: true });
    });

    gsap.to(audio, { volume, duration: 1.4, ease: "power1.out" });

    return () => {
      if (!retry) return;
      window.removeEventListener("pointerdown", retry);
      window.removeEventListener("keydown", retry);
    };
  }, [playing, volume]);

  return null;
}
