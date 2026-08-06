"use client";

import styled from "@emotion/styled";
import gsap from "gsap";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { KEY_BINDINGS } from "@/game/config/inputConfig";
import { theme } from "@/styles/theme";

import type { AudioSettings } from "./settingsStore";

/**
 * 설정 화면.
 *
 * 왼쪽 세로 아이콘으로 분류를 고르고 오른쪽에 항목을 한 줄씩 놓는 구성이다.
 * 조작키는 아직 바꿀 수 없다. OQ-004(키 바인딩)가 미결정이라 현재 값을 보여 주기만 한다.
 */

type Category = "sound" | "control";

const CONTROL_ROWS: { label: string; keys: string[] }[] = [
  { label: "이동", keys: [KEY_BINDINGS.MOVE_LEFT, KEY_BINDINGS.MOVE_RIGHT] },
  { label: "점프", keys: [KEY_BINDINGS.JUMP] },
  { label: "대시", keys: [KEY_BINDINGS.DASH] },
  { label: "공격", keys: [KEY_BINDINGS.ATTACK] },
  { label: "모드 전환", keys: [KEY_BINDINGS.SWITCH_MODE] },
  { label: "확인", keys: [KEY_BINDINGS.CONFIRM] },
  { label: "디버그", keys: [KEY_BINDINGS.TOGGLE_DEBUG] },
];

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(120% 80% at 50% 0%, rgba(112, 34, 35, 0.35) 0%, rgba(6, 5, 6, 0) 70%),
    rgba(6, 5, 6, 0.96);
`;

const Header = styled.button`
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 26px 40px;
  border: none;
  background: transparent;
  font-family: ${theme.font.ui};
  font-weight: 300;
  font-size: 22px;
  color: #fff;
  cursor: pointer;

  &::before {
    content: "‹";
    font-size: 30px;
    line-height: 1;
    color: rgba(200, 56, 60, 0.9);
  }
`;

const Body = styled.div`
  display: flex;
  flex: 1;
  min-height: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
`;

const Rail = styled.nav`
  display: flex;
  flex-direction: column;
  width: 92px;
  padding-top: 26px;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
`;

const RailButton = styled.button<{ active: boolean }>`
  display: grid;
  place-items: center;
  height: 70px;
  border: none;
  border-left: 2px solid ${({ active }) => (active ? "#c8383c" : "transparent")};
  background: ${({ active }) =>
    active
      ? "linear-gradient(90deg, rgba(200,56,60,0.28) 0%, rgba(200,56,60,0) 100%)"
      : "transparent"};
  color: ${({ active }) => (active ? "#fff" : "rgba(255,255,255,0.42)")};
  cursor: pointer;
  transition:
    color 0.2s ease,
    background 0.2s ease;

  &:hover {
    color: #fff;
  }
`;

const Content = styled.div`
  flex: 1;
  min-width: 0;
  padding: 26px 40px 40px;
  overflow-y: auto;
`;

const SectionTitle = styled.h2`
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 22px;
  font-family: ${theme.font.ui};
  font-weight: 500;
  font-size: 19px;
  color: #fff;

  &::before {
    content: "✦";
    font-size: 14px;
    color: rgba(200, 56, 60, 0.9);
  }
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
  min-height: 62px;
  padding: 0 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 100%);
  font-family: ${theme.font.ui};
  font-weight: 300;
  font-size: 16px;
  color: #fff;
`;

const RowLabel = styled.span`
  white-space: nowrap;
`;

const RowControl = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  max-width: 460px;
  justify-content: flex-end;
`;

const Slider = styled.input`
  flex: 1;
  height: 2px;
  appearance: none;
  background: rgba(255, 255, 255, 0.18);
  cursor: pointer;

  &::-webkit-slider-thumb {
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #c8383c;
  }

  &::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border: none;
    border-radius: 50%;
    background: #c8383c;
  }
`;

const Value = styled.span`
  width: 34px;
  text-align: right;
  font-family: ${theme.font.mono};
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
`;

/** 참고 디자인의 선택 버튼처럼 채워진 사각형. 지금은 표시 전용이다. */
const KeyCap = styled.span`
  min-width: 78px;
  padding: 9px 16px;
  text-align: center;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.06);
  font-family: ${theme.font.mono};
  font-size: 13px;
  letter-spacing: 0.06em;
  color: #fff;
`;

const Note = styled.p`
  margin: 20px 20px 0;
  font-family: ${theme.font.ui};
  font-weight: 300;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.42);
`;

const HeadphoneIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M4 14v-2a8 8 0 0 1 16 0v2"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
    <rect x="2.5" y="13.5" width="4.5" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
    <rect x="17" y="13.5" width="4.5" height="7" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const KeyboardIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
    <rect x="2" y="6" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
    <path
      d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M8 14h8"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

export default function SettingsPanel({
  audio,
  onAudioChange,
  onClose,
}: {
  audio: AudioSettings;
  onAudioChange: (next: AudioSettings) => void;
  onClose: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [category, setCategory] = useState<Category>("sound");

  useLayoutEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(
        rootRef.current,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.3, ease: "power2.out" },
      );
    });
    return () => mm.revert();
  }, []);

  // 설정이 열려 있는 동안에는 시작 화면 메뉴가 키 입력을 받지 않아야 한다.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  const volumeRow = (label: string, key: keyof AudioSettings) => (
    <Row key={key}>
      <RowLabel>{label}</RowLabel>
      <RowControl>
        <Slider
          type="range"
          min={0}
          max={100}
          step={1}
          aria-label={label}
          value={Math.round(audio[key] * 100)}
          onChange={(event) => onAudioChange({ ...audio, [key]: Number(event.target.value) / 100 })}
        />
        <Value>{Math.round(audio[key] * 100)}</Value>
      </RowControl>
    </Row>
  );

  return (
    <Overlay ref={rootRef} onPointerDown={(event) => event.stopPropagation()}>
      <Header type="button" onClick={onClose}>
        설정
      </Header>

      <Body>
        <Rail>
          <RailButton
            type="button"
            active={category === "sound"}
            aria-label="사운드"
            onClick={() => setCategory("sound")}
          >
            <HeadphoneIcon />
          </RailButton>
          <RailButton
            type="button"
            active={category === "control"}
            aria-label="조작"
            onClick={() => setCategory("control")}
          >
            <KeyboardIcon />
          </RailButton>
        </Rail>

        <Content>
          {category === "sound" ? (
            <>
              <SectionTitle>사운드</SectionTitle>
              {volumeRow("마스터 볼륨", "master")}
              {volumeRow("배경음악", "bgm")}
              {volumeRow("효과음", "sfx")}
              <Note>마스터와 효과음은 소리가 붙는 대로 적용됩니다. 지금은 값만 저장됩니다.</Note>
            </>
          ) : (
            <>
              <SectionTitle>조작키</SectionTitle>
              {CONTROL_ROWS.map((row) => (
                <Row key={row.label}>
                  <RowLabel>{row.label}</RowLabel>
                  <RowControl>
                    {row.keys.map((key) => (
                      <KeyCap key={key}>{key}</KeyCap>
                    ))}
                  </RowControl>
                </Row>
              ))}
              <Note>키 변경은 아직 지원하지 않습니다. (OQ-004)</Note>
            </>
          )}
        </Content>
      </Body>
    </Overlay>
  );
}
