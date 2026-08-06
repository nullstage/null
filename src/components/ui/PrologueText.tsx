"use client";

import styled from "@emotion/styled";
import gsap from "gsap";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { theme } from "@/styles/theme";

/**
 * 런을 시작할 때 지나가는 프롤로그.
 *
 * 검은 화면에 한 줄씩 띄우고, 다음 줄은 사용자가 눌러야 나온다.
 * 기다리는 동안 줄 옆에서 역삼각형이 깜빡인다. 읽는 속도를 강제하지 않기 위함이다.
 */

const LINES = ["시험받는 자는 셀 수 없이 많았으나,", "돌아온 자의 이름을 아는 이는 없었다."];

/** 한 줄이 떠오르는 데 걸리는 시간. */
const LINE_IN_SEC = 0.8;

const prefersReducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const Screen = styled.div`
  position: absolute;
  inset: 0;
  z-index: ${theme.z.prologue};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  background: #000;
  cursor: pointer;
`;

const LineRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 14px;
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
  align-self: center;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 8px solid rgba(200, 56, 60, 0.9);
  opacity: 0;
`;

export default function PrologueText({ onDone }: { onDone: () => void }) {
  const screenRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const caretRef = useRef<HTMLSpanElement>(null);

  /** 지금까지 띄운 줄 수. */
  const [visible, setVisible] = useState(0);
  /** 현재 줄이 다 떠서 다음 입력을 받을 수 있는 상태인지. */
  const readyRef = useRef(false);
  const lineTweenRef = useRef<gsap.core.Tween | null>(null);
  const doneRef = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;

    gsap.killTweensOf([screenRef.current, caretRef.current, ...lineRefs.current]);
    gsap.to(screenRef.current, {
      autoAlpha: 0,
      duration: prefersReducedMotion() ? 0 : 0.6,
      ease: "power2.out",
      onComplete: onDone,
    });
  }, [onDone]);

  /** 누를 때마다 한 걸음 나아간다. 아직 떠오르는 중이면 그것부터 끝낸다. */
  const advance = useCallback(() => {
    if (doneRef.current || visible === 0) return;

    if (!readyRef.current) {
      lineTweenRef.current?.progress(1);
      return;
    }
    if (visible < LINES.length) {
      setVisible((count) => count + 1);
      return;
    }
    finish();
  }, [finish, visible]);

  // 배경이 자리잡은 뒤 첫 줄을 띄운다.
  useLayoutEffect(() => {
    const tween = gsap.fromTo(
      screenRef.current,
      { autoAlpha: 0 },
      {
        autoAlpha: 1,
        duration: prefersReducedMotion() ? 0 : 0.5,
        ease: "power2.out",
        onComplete: () => setVisible(1),
      },
    );
    return () => {
      tween.kill();
    };
  }, []);

  // 줄이 늘어날 때마다 그 줄을 띄우고, 다 뜨면 역삼각형을 깜빡인다.
  useLayoutEffect(() => {
    if (visible === 0) return;

    const line = lineRefs.current[visible - 1];
    if (!line) return;

    readyRef.current = false;
    gsap.killTweensOf(caretRef.current);
    gsap.set(caretRef.current, { autoAlpha: 0, y: 0 });

    const markReady = () => {
      readyRef.current = true;
      if (prefersReducedMotion()) {
        gsap.set(caretRef.current, { autoAlpha: 1 });
        return;
      }
      gsap.to(caretRef.current, { autoAlpha: 1, duration: 0.25 });
      gsap.to(caretRef.current, {
        y: 4,
        duration: 0.55,
        ease: "sine.inOut",
        repeat: -1,
        yoyo: true,
      });
    };

    if (prefersReducedMotion()) {
      gsap.set(line, { autoAlpha: 1, y: 0 });
      markReady();
      return;
    }

    lineTweenRef.current = gsap.fromTo(
      line,
      { autoAlpha: 0, y: 10 },
      { autoAlpha: 1, y: 0, duration: LINE_IN_SEC, ease: "power2.out", onComplete: markReady },
    );

    return () => {
      lineTweenRef.current?.kill();
    };
  }, [visible]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      // 스페이스는 기본 스크롤 동작이 있다.
      if (event.key === " ") event.preventDefault();
      advance();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advance]);

  return (
    <Screen ref={screenRef} onPointerDown={advance}>
      {LINES.slice(0, visible).map((text, index) => (
        <LineRow key={text}>
          <Line
            ref={(element) => {
              lineRefs.current[index] = element;
            }}
          >
            {text}
          </Line>
          {index === visible - 1 && <Caret ref={caretRef} />}
        </LineRow>
      ))}
    </Screen>
  );
}
