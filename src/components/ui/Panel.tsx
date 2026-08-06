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
  background: rgba(6, 8, 12, 0.72);
  padding: ${theme.space(6)};
`;

const Frame = styled.section`
  width: min(560px, 100%);
  border: 1px solid ${theme.color.border};
  border-radius: ${theme.radius};
  background: ${theme.color.panel};
  color: ${theme.color.text};
  font-family: ${theme.font.mono};
  padding: ${theme.space(7)};
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
`;

const Heading = styled.h2`
  margin: 0 0 ${theme.space(5)};
  font-size: 14px;
  letter-spacing: 0.22em;
  color: ${theme.color.accent};
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
  border: 1px solid ${theme.color.border};
  border-radius: 6px;
  background: transparent;
  color: ${theme.color.text};
  font-family: inherit;
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;

  &:hover:not(:disabled) {
    border-color: ${theme.color.accent};
    color: ${theme.color.accent};
  }

  &:disabled {
    opacity: 0.45;
    cursor: default;
  }
`;
