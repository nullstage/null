"use client";

import styled from "@emotion/styled";
import gsap from "gsap";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";

import { KEY_BINDINGS } from "@/game/config/inputConfig";
import { theme } from "@/styles/theme";

import { SFX, playSfx } from "./sfx";

/**
 * 키맵 안내. (DEC-020)
 *
 * 방 1 기록자 대화(서사) 종료 직후 최초 1회 자동으로 뜨고, 이후에는 H로 언제든
 * 다시 열 수 있다(HUDOverlay의 `helpOpen`). 서사에는 키 이름을 넣지 않는다는
 * 기존 원칙(DialogueBox 참고)은 그대로 두고, 이 모달은 대화 밖에서만 관여한다.
 * 아티팩트로 나중에 풀리는 스킬 슬롯과 디버그 키는 목록에서 뺀다 — 아직 갖지 않은
 * 키까지 보여주면 오히려 헷갈린다.
 */

const SEEN_KEY = "null:keymapSeen";

export const hasSeenKeymap = (): boolean => {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    // 시크릿 창 등에서 접근이 막히면 매번 안내를 띄운다. 안 보여주는 편보다 낫다.
    return false;
  }
};

export const markKeymapSeen = (): void => {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // 저장에 실패해도 이번 세션은 그대로 진행한다.
  }
};

/**
 * 런 시작 시점에 바로 쓸 수 있는 동작만 나열한다. 잠금 해제 전 스킬·디버그 키는 뺀다.
 *
 * "상태창(인벤토리)"의 E와 "도움말"의 H는 `KEY_BINDINGS`에 없다 — 설정에서 바꿀 수 있는
 * 전투 조작이 아니라 HUDOverlay가 직접 듣는 UI 토글 키라 여기서만 하드코딩한다.
 */
const buildRows = (): Array<{ label: string; keys: string }> => [
  { label: "이동", keys: `${KEY_BINDINGS.MOVE_LEFT} / ${KEY_BINDINGS.MOVE_RIGHT}` },
  { label: "점프", keys: KEY_BINDINGS.JUMP },
  { label: "대시", keys: KEY_BINDINGS.DASH },
  { label: "공격", keys: KEY_BINDINGS.ATTACK },
  { label: "무기 전환", keys: KEY_BINDINGS.SWITCH_MODE },
  { label: "패링", keys: KEY_BINDINGS.PARRY },
  { label: "상호작용", keys: KEY_BINDINGS.INTERACT },
  { label: "상태창(인벤토리)", keys: "E" },
  { label: "도움말(이 화면)", keys: "H" },
];

const prefersReducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const Backdrop = styled.div`
  position: absolute;
  inset: 0;
  z-index: ${theme.z.dialogue};
  display: grid;
  place-items: center;
  background: rgba(4, 3, 4, 0.82);
  cursor: pointer;
`;

const Card = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
  padding: 40px 48px;
  width: min(420px, 86vw);
  border: 1px solid rgba(200, 56, 60, 0.35);
  background: linear-gradient(180deg, rgba(30, 12, 14, 0.96) 0%, rgba(12, 10, 12, 0.96) 100%);
  cursor: default;
`;

const Title = styled.p`
  margin: 0;
  font-family: ${theme.font.ui};
  font-weight: 500;
  font-size: 19px;
  color: #fff;

  &::before {
    content: "✦";
    margin-right: 8px;
    font-size: 14px;
    color: rgba(200, 56, 60, 0.9);
  }
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 11px 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  font-family: ${theme.font.ui};
  font-weight: 300;
  font-size: 15px;
  color: #fff;

  &:last-of-type {
    border-bottom: none;
  }
`;

const KeyCap = styled.span`
  padding: 6px 14px;
  min-width: 64px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.06);
  font-family: ${theme.font.mono};
  font-size: 13px;
  letter-spacing: 0.04em;
  color: #fff;
`;

const Confirm = styled.button`
  margin-top: 4px;
  padding: 12px 36px;
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.14) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  font-family: ${theme.font.ui};
  font-weight: 300;
  font-size: 16px;
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

export default function KeyMapModal({ onDone }: { onDone: () => void }) {
  const rows = useMemo(() => buildRows(), []);

  const backdropRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const doneRef = useRef(false);

  const close = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;

    playSfx(SFX.select);
    gsap.killTweensOf(backdropRef.current);
    gsap.to(backdropRef.current, {
      autoAlpha: 0,
      duration: prefersReducedMotion() ? 0 : 0.3,
      ease: "power2.out",
      onComplete: onDone,
    });
  }, [onDone]);

  useLayoutEffect(() => {
    buttonRef.current?.focus();

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(
        cardRef.current,
        { autoAlpha: 0, y: 14 },
        { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" },
      );
    });
    return () => mm.revert();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "Enter" || event.key === " " || event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close]);

  return (
    <Backdrop ref={backdropRef} onPointerDown={close}>
      <Card ref={cardRef} onPointerDown={(event) => event.stopPropagation()}>
        <Title>조작법</Title>
        <List>
          {rows.map((row) => (
            <Row key={row.label}>
              <span>{row.label}</span>
              <KeyCap>{row.keys}</KeyCap>
            </Row>
          ))}
        </List>
        <Confirm ref={buttonRef} type="button" onClick={close}>
          확인
        </Confirm>
      </Card>
    </Backdrop>
  );
}
