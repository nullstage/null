"use client";

import styled from "@emotion/styled";
import gsap from "gsap";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { theme } from "@/styles/theme";

import SettingsPanel from "./SettingsPanel";
import type { AudioSettings } from "./settingsStore";
import { SFX, playSfx } from "./sfx";

/**
 * 전투 중 Esc로 여는 일시정지 메뉴.
 *
 * 시작 화면과 같은 톤을 쓴다. 가운데만 진한 가로 그라데이션, Pretendard light, 흰 글씨.
 * 같은 게임 안에서 메뉴가 두 가지 얼굴을 갖지 않게 하려는 것이다.
 *
 * 씬을 직접 멈추지 않는다. 여는 쪽(HUDOverlay)이 `game:pause`를 쏘고,
 * 그 이벤트를 받은 `createGame`이 씬을 멈춘다. (DEC-006)
 */

const Screen = styled.div`
  position: absolute;
  inset: 0;
  z-index: ${theme.z.prompt};
  display: grid;
  place-items: center;

  background:
    radial-gradient(90% 70% at 50% 0%, rgba(112, 34, 35, 0.42) 0%, rgba(6, 5, 6, 0) 72%),
    rgba(6, 5, 6, 0.88);
  backdrop-filter: blur(3px);
`;

const Panel = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(480px, 72vw);
`;

const Title = styled.h1`
  margin: 0 0 8px;
  font-family: ${theme.font.ui};
  font-weight: 200;
  font-size: 34px;
  letter-spacing: 0.24em;
  /* 자간을 준 만큼 마지막 글자 뒤에도 여백이 붙어 글자가 왼쪽으로 밀린다. */
  text-indent: 0.24em;
  color: #fff;
`;

/** 타이틀 아래 가는 붉은 선. 시작 화면 장식과 같은 색을 쓴다. */
const Rule = styled.div`
  width: 100%;
  height: 1px;
  margin-bottom: 30px;
  background: linear-gradient(
    90deg,
    rgba(200, 56, 60, 0) 0%,
    rgba(200, 56, 60, 0.85) 50%,
    rgba(200, 56, 60, 0) 100%
  );
`;

const Menu = styled.nav`
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 6px;
`;

/** 시작 화면 MenuItem과 같은 규칙. 선택되면 검정이 붉은색으로 바뀐다. */
const MenuItem = styled.button<{ selected: boolean; disabled: boolean }>`
  height: 58px;
  border: none;
  padding: 0;
  font-family: ${theme.font.ui};
  font-weight: 300;
  font-size: 21px;
  line-height: 1;
  color: #fff;
  opacity: ${({ disabled }) => (disabled ? 0.3 : 1)};
  cursor: ${({ disabled }) => (disabled ? "default" : "pointer")};
  user-select: none;
  transition:
    background 0.22s ease,
    letter-spacing 0.22s ease;

  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0) 0%,
    rgba(0, 0, 0, 0.45) 50%,
    rgba(0, 0, 0, 0) 100%
  );

  ${({ selected, disabled }) =>
    selected && !disabled
      ? `
    letter-spacing: 0.08em;
    background: linear-gradient(
      90deg,
      rgba(112, 34, 35, 0) 0%,
      rgba(112, 34, 35, 0.8) 50%,
      rgba(112, 34, 35, 0) 100%
    );
  `
      : ""}
`;

const Hint = styled.p`
  margin: 26px 0 0;
  font-family: ${theme.font.mono};
  font-size: 12px;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.34);
`;

type ItemId = "resume" | "settings" | "save" | "giveup" | "exit";

/**
 * 저장은 비활성이다. 세이브·로드는 MVP 범위 밖이라 임의로 만들지 않는다.
 * (CLAUDE.md 규칙 3, OQ-028 — 시작 화면의 이어하기와 같은 이유)
 * 포기하기는 사망과 같은 흐름 — 런을 유지한 채 튜토리얼 마을로 되돌아간다.
 */
const ITEMS: { id: ItemId; label: string; disabled: boolean }[] = [
  { id: "resume", label: "계속하기", disabled: false },
  { id: "settings", label: "설정", disabled: false },
  { id: "save", label: "저장", disabled: true },
  { id: "giveup", label: "포기하기", disabled: false },
  { id: "exit", label: "나가기", disabled: false },
];

export default function PauseMenu({
  audio,
  onAudioChange,
  onResume,
  onGiveUp,
  onExit,
}: {
  audio: AudioSettings;
  onAudioChange: (next: AudioSettings) => void;
  onResume: () => void;
  onGiveUp: () => void;
  onExit: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const moveTo = useCallback(
    (next: number) => {
      if (next === selected) return;
      playSfx(SFX.move, { retrigger: true });
      setSelected(next);
    },
    [selected],
  );

  const run = useCallback(
    (index: number) => {
      const item = ITEMS[index];
      if (!item || item.disabled) return;

      playSfx(SFX.select);
      if (item.id === "resume") onResume();
      if (item.id === "settings") setSettingsOpen(true);
      if (item.id === "giveup") onGiveUp();
      if (item.id === "exit") onExit();
    },
    [onExit, onGiveUp, onResume],
  );

  useLayoutEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(
        rootRef.current,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.22, ease: "power2.out" },
      );
    });
    return () => mm.revert();
  }, []);

  // Esc는 여기서 다루지 않는다. 여는 쪽과 닫는 쪽이 갈리면 한 번 눌러 열자마자 닫힌다.
  useEffect(() => {
    if (settingsOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        moveTo((selected + 1) % ITEMS.length);
        return;
      }
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        moveTo((selected - 1 + ITEMS.length) % ITEMS.length);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        run(selected);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moveTo, run, selected, settingsOpen]);

  return (
    <Screen ref={rootRef}>
      <Panel>
        <Title>일시정지</Title>
        <Rule />

        <Menu>
          {ITEMS.map((item, index) => (
            <MenuItem
              key={item.id}
              type="button"
              selected={index === selected}
              disabled={item.disabled}
              onPointerEnter={() => moveTo(index)}
              onPointerDown={() => run(index)}
            >
              {item.label}
            </MenuItem>
          ))}
        </Menu>

        <Hint>ESC — 돌아가기</Hint>
      </Panel>

      {settingsOpen && (
        <SettingsPanel
          audio={audio}
          onAudioChange={onAudioChange}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </Screen>
  );
}
