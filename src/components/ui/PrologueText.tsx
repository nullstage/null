"use client";

import styled from "@emotion/styled";
import gsap from "gsap";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { theme } from "@/styles/theme";

import { glitchBolt } from "./glitch";

/**
 * 런을 시작할 때 지나가는 프롤로그.
 *
 * 한 번에 한 줄만 보여 준다. 다음 줄로 넘어가면 앞 줄은 사라진다.
 * 여러 줄을 쌓아 두면 읽는 순서가 흐려지고, 마지막 줄의 무게가 죽는다.
 *
 * 다음 줄은 사용자가 눌러야 나온다. 읽는 속도를 강제하지 않는다.
 */

const LINES = ["이름을 잃은 자는 수없이 이곳을 지나갔다.", "그러나 끝까지 기록된 이름은 아직 하나도 없다."];

/** 한 글자가 찍히는 간격. 글자 수만큼 곱해 한 줄의 등장 시간이 된다. */
const PER_CHAR_SEC = 0.055;
/** 지워질 때는 그냥 옅어진다. 찍히는 것과 대칭을 이루지 않아야 여운이 남는다. */
const LINE_OUT_SEC = 0.7;

/** 배경 글리치 줄기 수. 로딩보다 적게 둔다. 여기서는 글자가 주인공이다. */
const GLITCH_BOLTS = 2;

/** 줄이 지워진 뒤 다음 줄이 나올 때까지 비워 두는 시간. 숨 돌릴 틈이 있어야 문장이 남는다. */
const LINE_GAP_SEC = 0.65;

/** 검은 화면이 자리잡고 첫 줄이 나올 때까지의 시간. */
const OPENING_HOLD_SEC = 0.6;

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

/** 로딩 화면과 같은 세로 픽셀 글리치. 두 화면이 같은 세계로 보이게 한다. */
const Bolt = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 2px;
  height: 120px;
  opacity: 0;
  transform-origin: 50% 0%;
  mix-blend-mode: screen;
  pointer-events: none;
  will-change: transform, opacity;
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
  const boltsRef = useRef<(HTMLDivElement | null)[]>([]);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);

  /** 지금 보여 주는 줄. -1이면 아직 배경만 떠 있다. */
  const [index, setIndex] = useState(-1);
  /** 지금까지 찍힌 글자 수. */
  const [typed, setTyped] = useState(0);

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
      // 찍힐 때와 대칭을 이루지 않는다. 그냥 옅어져야 여운이 남는다.
      .to(lineRef.current, { autoAlpha: 0, duration: out, ease: "power1.in" }, 0)
      // 빈 화면으로 잠깐 둔다. 바로 다음 줄이 나오면 앞 문장이 읽히기 전에 밀려난다.
      .to({}, { duration: prefersReducedMotion() ? 0 : LINE_GAP_SEC });
  }, [finish, index]);

  // 배경을 먼저 세우고 첫 줄로 넘어간다.
  useLayoutEffect(() => {
    const reduced = prefersReducedMotion();

    /**
     * 검은 화면을 처음부터 불투명하게 깐다.
     *
     * 페이드인을 넣으면 그 사이 아래의 전투 씬이 비친다. 로딩이 다 걷힌 뒤에야
     * 이 화면이 마운트되기 때문이다. 어차피 앞 화면이 걷히는 중이라 페이드가 필요 없다.
     */
    gsap.set(screenRef.current, { autoAlpha: 1 });

    // 첫 줄은 조금 뜸을 들이고 나온다. 화면이 바뀌자마자 글자가 뜨면 급해 보인다.
    const intro = gsap
      .timeline({ onComplete: () => setIndex(0) })
      .to({}, { duration: reduced ? 0 : OPENING_HOLD_SEC });

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

    // 검은 배경이라 밝은 색을 얹는다. 로딩보다 훨씬 뜸하게 친다.
    const bolts = boltsRef.current
      .filter((bolt): bolt is HTMLDivElement => bolt !== null)
      .map((bolt) =>
        glitchBolt(bolt, {
          tints: ["rgba(255, 255, 255, 0.5)", "rgba(200, 56, 60, 0.85)"],
          restMin: 1.6,
          restMax: 4.5,
          lengthMin: 60,
          lengthMax: 260,
        }),
      );

    return () => {
      intro.kill();
      grain.kill();
      for (const bolt of bolts) bolt.kill();
    };
  }, []);

  // 줄이 바뀔 때마다 떠오르게 하고, 다 뜨면 역삼각형을 깜빡인다.
  useLayoutEffect(() => {
    if (index < 0 || !lineRef.current) return;

    readyRef.current = false;
    setTyped(0);
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

    // 앞 줄이 페이드로 사라졌으므로 투명도를 되돌려 놓는다.
    gsap.set(lineRef.current, { autoAlpha: 1 });

    const text = LINES[index];

    /**
     * 한 글자씩 찍는다. 기록이 적히는 것처럼 보여야 한다.
     *
     * 문자열을 직접 자르지 않고 카운터를 트윈한다. 그래야 중간에 progress(1)로
     * 건너뛸 때도 같은 완료 경로를 탄다.
     */
    const counter = { chars: 0 };
    let shown = 0;

    lineTweenRef.current = gsap.to(counter, {
      chars: text.length,
      duration: reduced ? 0 : text.length * PER_CHAR_SEC,
      ease: "none",
      onUpdate: () => {
        const next = Math.floor(counter.chars);
        // 글자 수가 실제로 바뀔 때만 다시 그린다. 매 프레임 갱신할 이유가 없다.
        if (next === shown) return;
        shown = next;
        setTyped(next);
      },
      onComplete: () => {
        setTyped(text.length);
        markReady();
      },
    });

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
      {Array.from({ length: GLITCH_BOLTS }, (_, boltIndex) => (
        <Bolt
          key={boltIndex}
          ref={(element) => {
            boltsRef.current[boltIndex] = element;
          }}
        />
      ))}
      <Vignette />

      {index >= 0 && (
        <LineRow>
          <Line ref={lineRef}>{LINES[index].slice(0, typed)}</Line>
          <Caret ref={caretRef} />
        </LineRow>
      )}
    </Screen>
  );
}
