"use client";

import styled from "@emotion/styled";
import gsap from "gsap";
import { useLayoutEffect, useRef } from "react";

import { theme } from "@/styles/theme";

/**
 * 커스텀 마우스 커서. 링이 점을 늦게 따라오며 속도만큼 늘어난다.
 *
 * mobicom 프로젝트의 구현을 가져와 색만 이 게임의 붉은 톤으로 바꿨다.
 * 터치 기기와 모션 최소화 설정에서는 기본 커서를 그대로 둔다.
 */

const RING_SIZE = 28;
const DOT_SIZE = 10;
const ACCENT = "#c8383c";

const Root = styled.div`
  @media (hover: none), (prefers-reduced-motion: reduce) {
    display: none;
  }
`;

const Ring = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: ${RING_SIZE}px;
  height: ${RING_SIZE}px;
  margin: ${-RING_SIZE / 2}px 0 0 ${-RING_SIZE / 2}px;
  border-radius: 50%;
  background: linear-gradient(90deg, rgba(200, 56, 60, 0.28) 0%, rgba(255, 255, 255, 0.22) 100%);
  box-shadow: 0 -2px 8px 0 rgba(200, 56, 60, 0.5);
  pointer-events: none;
  z-index: ${theme.z.cursor};
  opacity: 0;
  will-change: transform;
`;

const Dot = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: ${DOT_SIZE}px;
  height: ${DOT_SIZE}px;
  margin: ${-DOT_SIZE / 2}px 0 0 ${-DOT_SIZE / 2}px;
  background: ${ACCENT};
  border-radius: 50%;
  box-shadow: 0 0 6px rgba(200, 56, 60, 0.65);
  pointer-events: none;
  z-index: ${theme.z.cursor};
  opacity: 0;
  will-change: transform;
`;

const HOVER_SELECTOR = 'a, button, input, [data-cursor="hover"]';

export default function CursorFollower() {
  const ringRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ring = ringRef.current;
    const dot = dotRef.current;
    if (!ring || !dot) return;

    if (
      window.matchMedia("(hover: none)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    document.documentElement.style.cursor = "none";

    const mouse = { x: 0, y: 0 };
    const ringPos = { x: 0, y: 0 };
    const dotPos = { x: 0, y: 0 };

    let visible = false;
    let hovering = false;
    const mod = { press: 1 };

    const setRing = gsap.quickSetter(ring, "css") as (values: object) => void;
    const setDot = gsap.quickSetter(dot, "css") as (values: object) => void;

    const clamp = gsap.utils.clamp(0, 0.42);

    const tick = () => {
      // 점은 거의 즉시, 링은 늦게 따라온다.
      dotPos.x += (mouse.x - dotPos.x) * 0.4;
      dotPos.y += (mouse.y - dotPos.y) * 0.4;
      ringPos.x += (mouse.x - ringPos.x) * 0.16;
      ringPos.y += (mouse.y - ringPos.y) * 0.16;

      // 벌어진 거리만큼 진행 방향으로 늘린다.
      const dx = mouse.x - ringPos.x;
      const dy = mouse.y - ringPos.y;
      const stretch = clamp(Math.hypot(dx, dy) / 90);
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const base = (hovering ? 2 : 1) * mod.press;

      setDot({ x: dotPos.x, y: dotPos.y });
      setRing({
        x: ringPos.x,
        y: ringPos.y,
        rotation: angle,
        scaleX: base * (1 + stretch),
        scaleY: base * (1 - stretch * 0.7),
      });
    };

    gsap.ticker.add(tick);

    const onMove = (event: MouseEvent) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
      if (visible) return;
      visible = true;
      ringPos.x = dotPos.x = event.clientX;
      ringPos.y = dotPos.y = event.clientY;
      gsap.to([ring, dot], { opacity: 1, duration: 0.3 });
    };

    const onOver = (event: MouseEvent) => {
      if (!(event.target as HTMLElement | null)?.closest(HOVER_SELECTOR)) return;
      hovering = true;
      gsap.to(ring, { opacity: 1, duration: 0.3, ease: "back.out(3)" });
      gsap.to(dot, { scale: 0, duration: 0.25, ease: "back.in(2)" });
    };

    const onOut = (event: MouseEvent) => {
      if (!(event.target as HTMLElement | null)?.closest(HOVER_SELECTOR)) return;
      hovering = false;
      gsap.to(dot, { scale: 1, duration: 0.35, ease: "back.out(3)" });
    };

    const onDown = () => gsap.to(mod, { press: 0.75, duration: 0.18, ease: "back.out(4)" });
    const onUp = () => gsap.to(mod, { press: 1, duration: 0.5, ease: "elastic.out(1, 0.4)" });
    const onLeave = () => gsap.to([ring, dot], { opacity: 0, duration: 0.3 });
    const onEnter = () => gsap.to([ring, dot], { opacity: 1, duration: 0.3 });

    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    document.addEventListener("mouseleave", onLeave);
    document.addEventListener("mouseenter", onEnter);

    return () => {
      gsap.ticker.remove(tick);
      document.documentElement.style.cursor = "";
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      document.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("mouseenter", onEnter);
    };
  }, []);

  return (
    <Root aria-hidden>
      <Ring ref={ringRef} />
      <Dot ref={dotRef} />
    </Root>
  );
}
