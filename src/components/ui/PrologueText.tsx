"use client";

import styled from "@emotion/styled";
import gsap from "gsap";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

import { theme } from "@/styles/theme";

/**
 * 런을 시작할 때 한 번 지나가는 프롤로그.
 *
 * 로딩이 걷힌 뒤 검은 화면에 두 줄이 차례로 떠오른다.
 * 다시 볼 필요가 없는 사람도 있으니 아무 입력으로 건너뛸 수 있게 한다.
 */

const LINES = ["시험받는 자는 셀 수 없이 많았으나,", "돌아온 자의 이름을 아는 이는 없었다."];

const Screen = styled.div`
  position: absolute;
  inset: 0;
  z-index: ${theme.z.prologue};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22px;
  background: #000;
  cursor: pointer;
`;

const Line = styled.p`
  margin: 0;
  font-family: ${theme.font.ui};
  font-weight: 300;
  font-size: clamp(17px, 1.55vw, 27px);
  letter-spacing: 0.04em;
  line-height: 1.6;
  color: #fff;
  text-align: center;
  white-space: nowrap;
  user-select: none;
`;

const Skip = styled.span`
  position: absolute;
  right: 42px;
  bottom: 36px;
  font-family: ${theme.font.mono};
  font-size: 12px;
  letter-spacing: 0.22em;
  color: rgba(255, 255, 255, 0.32);
  user-select: none;
`;

export default function PrologueText({ onDone }: { onDone: () => void }) {
  const screenRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const skipRef = useRef<HTMLSpanElement>(null);

  // 건너뛰기와 자연 종료가 겹쳐도 한 번만 넘어가야 한다.
  const doneRef = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  }, [onDone]);

  const skip = useCallback(() => {
    if (doneRef.current) return;
    // 남은 연출을 지우고 곧바로 어둡게 덮은 뒤 넘긴다.
    gsap.killTweensOf([screenRef.current, skipRef.current, ...lineRefs.current]);
    gsap.to(screenRef.current, { autoAlpha: 0, duration: 0.25, onComplete: finish });
  }, [finish]);

  useLayoutEffect(() => {
    const lines = lineRefs.current.filter((line): line is HTMLParagraphElement => line !== null);
    gsap.set([...lines, skipRef.current], { autoAlpha: 0 });

    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set([...lines, skipRef.current], { autoAlpha: 1 });
      const timer = window.setTimeout(finish, 2200);
      return () => window.clearTimeout(timer);
    });

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });

      tl.fromTo(screenRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.5 });

      lines.forEach((line, index) => {
        tl.fromTo(
          line,
          { autoAlpha: 0, y: 10 },
          { autoAlpha: 1, y: 0, duration: 1.1 },
          // 첫 줄은 배경이 자리잡은 뒤, 다음 줄은 앞 줄을 읽을 틈을 두고 나온다.
          index === 0 ? 0.6 : ">+=0.9",
        );
      });

      tl.fromTo(skipRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, 1.2)
        // 두 줄을 다 읽을 시간을 준 뒤 넘어간다.
        .to([...lines, skipRef.current], { autoAlpha: 0, duration: 0.8 }, ">+=1.8")
        .to(screenRef.current, { autoAlpha: 0, duration: 0.6, onComplete: finish });
    });

    return () => mm.revert();
    // onDone은 부모에서 안정적으로 유지한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      skip();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [skip]);

  return (
    <Screen ref={screenRef} onPointerDown={skip}>
      {LINES.map((text, index) => (
        <Line
          key={text}
          ref={(element) => {
            lineRefs.current[index] = element;
          }}
        >
          {text}
        </Line>
      ))}
      <Skip ref={skipRef}>아무 키나 눌러 건너뛰기</Skip>
    </Screen>
  );
}
