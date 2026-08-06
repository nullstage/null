"use client";

import styled from "@emotion/styled";
import gsap from "gsap";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { theme } from "@/styles/theme";

/**
 * 런을 시작할 때 지나가는 프롤로그.
 *
 * 한 번에 한 줄만 보여 준다. 다음 줄로 넘어가면 앞 줄은 사라진다.
 * 여러 줄을 쌓아 두면 읽는 순서가 흐려지고, 마지막 줄의 무게가 죽는다.
 *
 * 다음 줄은 사용자가 눌러야 나온다. 읽는 속도를 강제하지 않는다.
 */

const LINES = ["시험받는 자는 셀 수 없이 많았으나,", "돌아온 자의 이름을 아는 이는 없었다."];

/** 한 줄이 떠오르고 사라지는 데 걸리는 시간. */
const LINE_IN_SEC = 0.9;
const LINE_OUT_SEC = 0.45;

/**
 * 필름 그레인. 외부 이미지 없이 SVG 난수를 그대로 배경으로 쓴다.
 * 에셋을 추가하면 로딩이 하나 늘어난다. 이 정도 노이즈는 파일로 둘 값어치가 없다.
 */
const NOISE_URL =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'>" +
  "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/></filter>" +
  "<rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

const prefersReducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const Screen = styled.div`
  position: absolute;
  inset: 0;
  z-index: ${theme.z.prologue};
  display: grid;
  place-items: center;
  overflow: hidden;
  background: #000;
  cursor: pointer;
`;

/** 가운데만 아주 옅게 밝은 바탕. 글자가 허공에 뜨지 않게 받쳐 준다. */
const Glow = styled.div`
  position: absolute;
  inset: 0;
  background: radial-gradient(52% 38% at 50% 50%, rgba(112, 34, 35, 0.5) 0%, rgba(0, 0, 0, 0) 70%);
  pointer-events: none;
`;

/** 그레인은 화면보다 크게 잡아 두고 흔든다. 가장자리가 비지 않게 하려는 것이다. */
const Noise = styled.div`
  position: absolute;
  inset: -12%;
  background-image: ${NOISE_URL};
  opacity: 0.05;
  mix-blend-mode: screen;
  pointer-events: none;
`;

/** 위아래 어둠. 화면을 좁혀 보이게 해서 시선을 가운데로 모은다. */
const Vignette = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.9) 0%,
    rgba(0, 0, 0, 0) 30%,
    rgba(0, 0, 0, 0) 70%,
    rgba(0, 0, 0, 0.9) 100%
  );
  pointer-events: none;
`;

const LineRow = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
`;

const Line = styled.p`
  margin: 0;
  font-family: ${theme.font.ui};
  font-weight: 300;
  font-size: clamp(17px, 1.55vw, 27px);
  letter-spacing: 0.04em;
  line-height: 1.6;
  color: #fff;
  white-space: nowrap;
  user-select: none;
`;

/** 다음을 기다린다는 신호. 대화창 아래에서 깜빡이는 그 표시다. */
const Caret = styled.span`
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 8px solid rgba(200, 56, 60, 0.9);
  opacity: 0;
`;

export default function PrologueText({ onDone }: { onDone: () => void }) {
  const screenRef = useRef<HTMLDivElement>(null);
  const noiseRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);

  /** 지금 보여 주는 줄. -1이면 아직 배경만 떠 있다. */
  const [index, setIndex] = useState(-1);

  const readyRef = useRef(false);
  const busyRef = useRef(false);
  const lineTweenRef = useRef<gsap.core.Tween | null>(null);
  const doneRef = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;

    gsap.killTweensOf([screenRef.current, caretRef.current, lineRef.current]);
    gsap.to(screenRef.current, {
      autoAlpha: 0,
      duration: prefersReducedMotion() ? 0 : 0.7,
      ease: "power2.out",
      onComplete: onDone,
    });
  }, [onDone]);

  /** 앞 줄을 지우고 다음 줄로 넘어간다. */
  const advance = useCallback(() => {
    if (doneRef.current || busyRef.current || index < 0) return;

    // 아직 떠오르는 중이면 그것부터 끝낸다. 두 번 눌러야 넘어가면 답답하다.
    if (!readyRef.current) {
      lineTweenRef.current?.progress(1);
      return;
    }

    const last = index >= LINES.length - 1;
    busyRef.current = true;
    readyRef.current = false;
    gsap.killTweensOf(caretRef.current);

    const out = prefersReducedMotion() ? 0 : LINE_OUT_SEC;
    gsap
      .timeline({
        onComplete: () => {
          busyRef.current = false;
          if (last) finish();
          else setIndex((current) => current + 1);
        },
      })
      .to(caretRef.current, { autoAlpha: 0, duration: out * 0.35 }, 0)
      // 새겨진 방향 그대로 지워진다. 들어온 길로 나가야 한 동작으로 읽힌다.
      .to(
        lineRef.current,
        { clipPath: "inset(0% 0% 0% 100%)", duration: out, ease: "power2.inOut" },
        0,
      );
  }, [finish, index]);

  // 배경을 먼저 세우고 첫 줄로 넘어간다.
  useLayoutEffect(() => {
    const reduced = prefersReducedMotion();

    // 배경은 한 번 밝아지고 그대로 있는다. 계속 움직이면 글자와 시선을 다툰다.
    const intro = gsap.timeline({ onComplete: () => setIndex(0) });
    intro.fromTo(
      screenRef.current,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: reduced ? 0 : 0.6, ease: "power2.out" },
    );

    if (reduced) return () => intro.kill();

    // 그레인만 계속 돈다. 매 반복마다 자리를 새로 뽑아야 정지 화면으로 보이지 않는다.
    const grain = gsap.to(noiseRef.current, {
      duration: 0.12,
      repeat: -1,
      repeatRefresh: true,
      ease: "none",
      x: () => gsap.utils.random(-10, 10),
      y: () => gsap.utils.random(-10, 10),
      opacity: () => gsap.utils.random(0.04, 0.06),
    });

    return () => {
      intro.kill();
      grain.kill();
    };
  }, []);

  // 줄이 바뀔 때마다 떠오르게 하고, 다 뜨면 역삼각형을 깜빡인다.
  useLayoutEffect(() => {
    if (index < 0 || !lineRef.current) return;

    readyRef.current = false;
    gsap.killTweensOf(caretRef.current);
    gsap.set(caretRef.current, { autoAlpha: 0 });

    const reduced = prefersReducedMotion();

    const markReady = () => {
      readyRef.current = true;
      if (reduced) {
        gsap.set(caretRef.current, { autoAlpha: 1 });
        return;
      }
      // 깜빡이기만 한다. 위아래로 움직이면 와이프와 겹쳐 산만해진다.
      gsap.fromTo(
        caretRef.current,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.7, ease: "sine.inOut", repeat: -1, yoyo: true },
      );
    };

    // 왼쪽에서 오른쪽으로 새겨진다. 기록이 적히는 것처럼 보여야 한다.
    // 페이드나 이동을 겹치지 않는다. 움직이는 것이 둘 이상이면 문장이 눈에 안 들어온다.
    lineTweenRef.current = gsap.fromTo(
      lineRef.current,
      { clipPath: "inset(0% 100% 0% 0%)" },
      {
        clipPath: "inset(0% 0% 0% 0%)",
        duration: reduced ? 0 : LINE_IN_SEC,
        ease: "power2.inOut",
        onComplete: markReady,
      },
    );

    return () => {
      lineTweenRef.current?.kill();
    };
  }, [index]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === " ") event.preventDefault();
      advance();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advance]);

  return (
    <Screen ref={screenRef} onPointerDown={advance}>
      <Glow />
      <Noise ref={noiseRef} />
      <Vignette />

      {index >= 0 && (
        <LineRow>
          <Line ref={lineRef}>{LINES[index]}</Line>
          <Caret ref={caretRef} />
        </LineRow>
      )}
    </Screen>
  );
}
