"use client";

import styled from "@emotion/styled";
import gsap from "gsap";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { theme } from "@/styles/theme";

import { glitchBolt } from "./glitch";

import { TITLE_ASSETS, TITLE_ASSET_LIST } from "./titleAssets";

/**
 * 로딩 화면. 시작 화면 에셋을 미리 받아 둔다.
 *
 * 배경 이미지가 1MB를 넘어서, 미리 받지 않으면 시작 화면에서 배경이 나중에 튀어나온다.
 * 로드가 순식간에 끝나도 최소 시간은 보여 준다. 한 프레임 깜빡이는 것이 더 어색하다.
 *
 * 진행률은 표시하지 않는다. 받을 것이 네 장뿐이라 숫자가 의미를 갖기 전에 끝난다.
 */

/** 로드가 빨라도 이 시간만큼은 유지한다. */
const MIN_VISIBLE_MS = 900;

/** 동시에 돌아다니는 글리치 줄기 수. 늘릴수록 노이즈가 심해진다. */
const GLITCH_BOLTS = 5;

const prefersReducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const Screen = styled.div`
  position: absolute;
  inset: 0;
  z-index: ${theme.z.loading};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
  background: #fff;
  overflow: hidden;
  pointer-events: none;
`;

/**
 * 번개처럼 순간적으로 내리꽂히는 세로 픽셀 줄기.
 * 위치·길이·굵기·색은 GSAP이 매 반복마다 다시 뽑는다.
 */
const Bolt = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 2px;
  height: 120px;
  opacity: 0;
  transform-origin: 50% 0%;
  mix-blend-mode: multiply;
  will-change: transform, opacity;
`;

/** 에셋은 시작 화면 방향(첨탑이 위)으로 저장돼 있다. 로딩에서는 뒤집어 쓴다. */
const Mark = styled.img`
  width: 68px;
  height: 120px;
  transform: scaleY(-1);
`;

const Caption = styled.p`
  margin: 0;
  font-family: ${theme.font.mono};
  font-size: 12px;
  letter-spacing: 0.32em;
  color: #000;
`;

/**
 * LOADING 아래 한 줄. 방 사이 로딩에서 직전 판정을 다시 못 박는 자리다.
 * 로딩은 어차피 멍하니 보는 시간이라, 여기서 읽은 한 줄이 가장 오래 남는다.
 */
const Verdict = styled.p`
  margin: -14px 0 0;
  font-family: ${theme.font.ui};
  font-weight: 300;
  font-size: 19px;
  letter-spacing: 0.06em;
  color: #000;
`;

export default function LoadingScreen({
  ready,
  verdict,
  onReveal,
  onDone,
}: {
  /** 게임 쪽 준비 여부. 에셋이 다 받아져도 이게 false면 계속 기다린다. */
  ready: boolean;
  /** LOADING 아래에 덧붙일 한 줄. 없으면 표시하지 않는다. */
  verdict?: string;
  /** 걷히기 시작하는 순간. 다음 화면을 여기서 미리 붙여야 흰 화면 밑이 비지 않는다. */
  onReveal: () => void;
  /** 다 걷힌 순간. 부모가 이 컴포넌트를 내리면 된다. */
  onDone: () => void;
}) {
  const screenRef = useRef<HTMLDivElement>(null);
  const boltsRef = useRef<(HTMLDivElement | null)[]>([]);

  const [loaded, setLoaded] = useState(0);
  const [minTimePassed, setMinTimePassed] = useState(false);

  const total = TITLE_ASSET_LIST.length;

  // 에셋 프리로드. 실패해도 진행을 막지 않는다. 로딩 화면에 갇히는 편이 더 나쁘다.
  useEffect(() => {
    let cancelled = false;
    const count = () => {
      if (!cancelled) setLoaded((n) => n + 1);
    };

    const images = TITLE_ASSET_LIST.map((src) => {
      const image = new Image();
      image.onload = count;
      image.onerror = count;
      image.src = src;
      return image;
    });

    const timer = window.setTimeout(() => setMinTimePassed(true), MIN_VISIBLE_MS);

    return () => {
      cancelled = true;
      for (const image of images) {
        image.onload = null;
        image.onerror = null;
      }
      window.clearTimeout(timer);
    };
  }, []);

  useLayoutEffect(() => {
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      for (const bolt of boltsRef.current) {
        if (!bolt) continue;
        // 흰 배경이라 어두운 색을 얹는다.
        glitchBolt(bolt, {
          tints: ["rgba(0, 0, 0, 0.55)", "rgba(200, 56, 60, 0.75)", "rgba(60, 170, 190, 0.6)"],
          restMin: 0.5,
          restMax: 2.6,
          lengthMin: 50,
          lengthMax: 300,
        });
      }

      // 아주 가끔 화면 전체가 한 프레임 어긋난다.
      gsap
        .timeline({ repeat: -1, repeatRefresh: true, delay: 1.2 })
        .to(screenRef.current, { x: () => gsap.utils.random(-6, 6), duration: 0.04 })
        .to(screenRef.current, { x: 0, duration: 0.04 })
        .to({}, { duration: () => gsap.utils.random(1.5, 4) });
    });

    return () => mm.revert();
  }, []);

  const finished = loaded >= total && ready && minTimePassed;

  useEffect(() => {
    if (!finished) return;

    onReveal();

    const tween = gsap.to(screenRef.current, {
      autoAlpha: 0,
      duration: prefersReducedMotion() ? 0 : 0.6,
      ease: "power2.out",
      onComplete: onDone,
    });

    return () => {
      tween.kill();
    };
    // onReveal·onDone은 부모에서 안정적으로 유지한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  return (
    <Screen ref={screenRef}>
      {Array.from({ length: GLITCH_BOLTS }, (_, index) => (
        <Bolt
          key={index}
          ref={(element) => {
            boltsRef.current[index] = element;
          }}
        />
      ))}

      <Mark src={TITLE_ASSETS.ornament} alt="" draggable={false} />
      <Caption>기록을 읽는 중…</Caption>
      {verdict && <Verdict>{verdict}</Verdict>}
    </Screen>
  );
}
