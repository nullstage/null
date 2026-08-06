"use client";

import styled from "@emotion/styled";
import gsap from "gsap";
import { useEffect, useRef, type ReactNode } from "react";

import { theme } from "@/styles/theme";

/**
 * 방 사이 팝업의 공통 껍데기.
 *
 * 등장 연출은 GSAP으로 한 곳에서만 처리한다. 각 패널이 따로 애니메이션을 만들지 않는다.
 * `prefers-reduced-motion`을 존중한다.
 */

const Backdrop = styled.div`
  position: absolute;
  inset: 0;
  z-index: ${theme.z.panel};
  display: grid;
  place-items: center;
  padding: ${theme.space(6)};

  /* 시작 화면·일시정지와 같은 붉은 어둠. 패널만 푸른 톤이면 다른 게임처럼 보인다. */
  background:
    radial-gradient(90% 70% at 50% 0%, rgba(112, 34, 35, 0.34) 0%, rgba(6, 5, 6, 0) 72%),
    rgba(6, 5, 6, 0.84);
`;

const Frame = styled.section`
  position: relative;
  width: min(560px, 100%);
  /* 도트 화면과 맞물리도록 모서리를 깎지 않는다. */
  border: 1px solid rgba(200, 56, 60, 0.4);
  background: rgba(12, 9, 11, 0.94);
  color: ${theme.color.text};
  font-family: ${theme.font.mono};
  padding: ${theme.space(7)};
  box-shadow:
    inset 0 0 0 1px rgba(0, 0, 0, 0.7),
    0 24px 60px rgba(0, 0, 0, 0.6);

  /* 위쪽 붉은 띠. 창이 어디서 시작하는지 한눈에 잡아 준다. */
  &::before {
    content: "";
    position: absolute;
    inset: 0 0 auto;
    height: 2px;
    background: linear-gradient(
      90deg,
      rgba(200, 56, 60, 0) 0%,
      rgba(200, 56, 60, 0.9) 50%,
      rgba(200, 56, 60, 0) 100%
    );
  }
`;

const Heading = styled.h2`
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 ${theme.space(5)};
  font-family: ${theme.font.ui};
  font-weight: 300;
  font-size: 16px;
  letter-spacing: 0.22em;
  color: #fff;

  &::before {
    content: "✦";
    font-size: 12px;
    letter-spacing: 0;
    color: rgba(200, 56, 60, 0.95);
  }
`;

export interface PanelProps {
  title: string;
  children: ReactNode;
}

export default function Panel({ title, children }: PanelProps) {
  const frameRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const tween = gsap.fromTo(
      frame,
      { autoAlpha: 0, y: 16 },
      { autoAlpha: 1, y: 0, duration: 0.28, ease: "power2.out" },
    );
    return () => {
      tween.kill();
    };
  }, []);

  return (
    <Backdrop role="dialog" aria-modal="true" aria-label={title}>
      <Frame ref={frameRef}>
        <Heading>{title}</Heading>
        {children}
      </Frame>
    </Backdrop>
  );
}

export const PanelRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${theme.space(4)};
  padding: ${theme.space(2)} 0;
  font-size: 15px;

  span:last-of-type {
    color: ${theme.color.textMuted};
  }
`;

export const PanelActions = styled.div`
  display: flex;
  gap: ${theme.space(3)};
  margin-top: ${theme.space(6)};
`;

export const PanelButton = styled.button`
  flex: 1;
  padding: ${theme.space(3)} ${theme.space(4)};
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0) 0%,
    rgba(0, 0, 0, 0.4) 50%,
    rgba(0, 0, 0, 0) 100%
  );
  font-family: ${theme.font.ui};
  font-weight: 300;
  font-size: 15px;
  color: #fff;
  cursor: pointer;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    letter-spacing 0.18s ease;

  /* 시작 화면 메뉴와 같은 규칙. 고르면 가운데가 붉게 진해진다. */
  &:hover:not(:disabled) {
    letter-spacing: 0.06em;
    border-color: rgba(200, 56, 60, 0.75);
    background: linear-gradient(
      90deg,
      rgba(112, 34, 35, 0) 0%,
      rgba(112, 34, 35, 0.75) 50%,
      rgba(112, 34, 35, 0) 100%
    );
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
`;
