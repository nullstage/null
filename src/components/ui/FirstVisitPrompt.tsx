"use client";

import styled from "@emotion/styled";
import gsap from "gsap";
import { useLayoutEffect, useRef } from "react";

import { theme } from "@/styles/theme";

/**
 * 첫 방문 안내.
 *
 * 브라우저는 사용자 입력 전 소리를 막는다. 이 버튼이 그 입력 역할을 한다. (CLAUDE.md 배포 규칙)
 * 두 번째 방문부터는 `localStorage`에 남은 기록을 보고 건너뛴다.
 */

const VISITED_KEY = "null:visited";

export const hasVisitedBefore = (): boolean => {
  try {
    return window.localStorage.getItem(VISITED_KEY) === "1";
  } catch {
    // 시크릿 창 등에서 접근이 막히면 매번 안내를 띄운다. 소리가 안 나오는 편보다 낫다.
    return false;
  }
};

export const markVisited = (): void => {
  try {
    window.localStorage.setItem(VISITED_KEY, "1");
  } catch {
    // 저장에 실패해도 이번 세션은 그대로 진행한다.
  }
};

const Backdrop = styled.div`
  position: absolute;
  inset: 0;
  z-index: ${theme.z.prompt};
  display: grid;
  place-items: center;
  background: rgba(4, 3, 4, 0.82);
`;

const Card = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  padding: 44px 56px;
  max-width: min(520px, 86vw);
  text-align: center;
  border: 1px solid rgba(200, 56, 60, 0.35);
  background: linear-gradient(180deg, rgba(30, 12, 14, 0.96) 0%, rgba(12, 10, 12, 0.96) 100%);
`;

const Title = styled.p`
  margin: 0;
  font-family: ${theme.font.mono};
  font-size: 12px;
  letter-spacing: 0.32em;
  color: rgba(200, 56, 60, 0.9);
`;

const Body = styled.p`
  margin: 0;
  font-family: ${theme.font.ui};
  font-weight: 300;
  font-size: 17px;
  line-height: 1.7;
  color: #fff;
`;

const Confirm = styled.button`
  padding: 14px 40px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.14) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  font-family: ${theme.font.ui};
  font-weight: 300;
  font-size: 18px;
  letter-spacing: 0.04em;
  color: #fff;
  cursor: pointer;
  transition:
    background 0.2s ease,
    border-color 0.2s ease;

  &:hover,
  &:focus-visible {
    border-color: rgba(200, 56, 60, 0.75);
    background: linear-gradient(
      90deg,
      rgba(200, 56, 60, 0) 0%,
      rgba(200, 56, 60, 0.42) 50%,
      rgba(200, 56, 60, 0) 100%
    );
  }
`;

export default function FirstVisitPrompt({ onConfirm }: { onConfirm: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    buttonRef.current?.focus();

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(
        cardRef.current,
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.6, ease: "power2.out" },
      );
    });
    return () => mm.revert();
  }, []);

  const confirm = () => {
    markVisited();
    onConfirm();
  };

  return (
    <Backdrop>
      <Card ref={cardRef}>
        <Title>NOTICE</Title>
        <Body>
          첫 접속입니다.
          <br />
          원활한 진행을 위해 아래 버튼을 눌러 주세요.
        </Body>
        <Confirm ref={buttonRef} type="button" onClick={confirm}>
          시작하기
        </Confirm>
      </Card>
    </Backdrop>
  );
}
