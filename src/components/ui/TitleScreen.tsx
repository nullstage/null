"use client";

import styled from "@emotion/styled";
import gsap from "gsap";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { theme } from "@/styles/theme";

import SettingsPanel from "./SettingsPanel";
import type { AudioSettings } from "./settingsStore";
import { SFX, playSfx } from "./sfx";
import { TITLE_ASSETS } from "./titleAssets";

/**
 * 시작 화면. Figma `Frame 1`(node 1:33)을 그대로 옮긴 것이다.
 *
 * 이미지·블러·웹폰트를 쓰기 때문에 Phaser 씬이 아니라 React 레이어로 그린다.
 * ReadyScene은 화면을 그리지 않고 여기서 올라오는 `ui:continue`만 기다린다. (DEC-006)
 *
 * 등장 연출은 GSAP 타임라인 하나로 관리한다. 요소마다 CSS 애니메이션을 흩뿌리면
 * 순서를 맞추기 어렵고, 나중에 길이를 줄일 때 손댈 곳이 늘어난다.
 */

/** Figma 원본 캔버스. 아래 좌표는 전부 이 크기 기준의 px다. */
const DESIGN = { width: 1920, height: 1080 } as const;

const Screen = styled.div`
  position: absolute;
  inset: 0;
  z-index: ${theme.z.panel};
  display: grid;
  place-items: center;
  overflow: hidden;
  cursor: pointer;

  /* Figma의 배경 사각형(Rectangle 1). 레터박스 영역까지 이 색으로 채운다. */
  background: linear-gradient(180deg, #702223 0%, #363636 100%);
`;

/**
 * 디자인 좌표를 그대로 쓰기 위한 16:9 무대.
 * `--u`는 "디자인 1px이 실제 몇 px인가"라서, 모든 값을 `calc(var(--u) * N)`으로 적는다.
 */
const Stage = styled.div`
  --u: calc(min(100vw, 100dvh * ${DESIGN.width} / ${DESIGN.height}) / ${DESIGN.width});

  position: relative;
  width: calc(var(--u) * ${DESIGN.width});
  height: calc(var(--u) * ${DESIGN.height});
`;

/**
 * Figma의 image 1 + image 2(rgba(0,0,0,0.46) + blur 6px)를 합쳐 내보낸 배경이다.
 * 어둡게·흐리게가 이미 구워져 있으므로 오버레이를 다시 얹지 않는다. 두 번 얹으면 새까매진다.
 *
 * 무대(16:9) 밖에 두고 화면 전체를 덮는다. 무대 안에 두면 화면 비율이 16:9가 아닐 때
 * 위아래나 좌우에 빈 띠가 남는다. 배경은 잘려도 되지만 타이틀은 잘리면 안 되므로 둘을 분리한다.
 */
const Backdrop = styled.img`
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

/** 디자인 좌표(px)를 그대로 받는 절대 배치 이미지. */
const Art = styled.img<{ left: number; top: number; w: number; h: number }>`
  position: absolute;
  left: calc(var(--u) * ${({ left }) => left});
  top: calc(var(--u) * ${({ top }) => top});
  width: calc(var(--u) * ${({ w }) => w});
  height: calc(var(--u) * ${({ h }) => h});
  pointer-events: none;
  user-select: none;
`;

/** 메뉴 항목. 디자인 좌표 기준 폭 480, 높이 62, 세로 간격 78. */
const MENU_LEFT = (DESIGN.width - 480) / 2;
const MENU_TOP = 744;
const MENU_STEP = 78;

const Menu = styled.nav`
  position: absolute;
  left: calc(var(--u) * ${MENU_LEFT});
  top: calc(var(--u) * ${MENU_TOP});
  width: calc(var(--u) * 480);
  display: flex;
  flex-direction: column;
  gap: calc(var(--u) * ${MENU_STEP - 62});
`;

/**
 * 배경은 가운데만 진하고 양 끝으로 갈수록 투명해지는 가로 그라데이션이다.
 * 사각형 테두리를 그리지 않아야 배경 아트를 가리지 않는다.
 */
const MenuItem = styled.button<{ selected: boolean; disabled: boolean }>`
  height: calc(var(--u) * 62);
  border: none;
  padding: 0;
  font-family: ${theme.font.ui};
  font-weight: 300;
  font-size: calc(var(--u) * 32);
  line-height: 1;
  color: #fff;
  opacity: ${({ disabled }) => (disabled ? 0.32 : 1)};
  cursor: ${({ disabled }) => (disabled ? "default" : "pointer")};
  user-select: none;
  transition:
    background 0.25s ease,
    letter-spacing 0.25s ease;

  background: linear-gradient(
    90deg,
    rgba(0, 0, 0, 0) 0%,
    rgba(0, 0, 0, ${({ selected }) => (selected ? 0.72 : 0.42)}) 50%,
    rgba(0, 0, 0, 0) 100%
  );

  ${({ selected, disabled }) =>
    selected && !disabled
      ? `
    letter-spacing: 0.06em;
    background: linear-gradient(
      90deg,
      rgba(112, 34, 35, 0) 0%,
      rgba(112, 34, 35, 0.78) 50%,
      rgba(112, 34, 35, 0) 100%
    );
  `
      : ""}
`;

type MenuId = "new" | "continue" | "settings";

/**
 * 이어하기는 저장 기능이 없어 비활성이다.
 * 세이브·로드는 MVP 범위 밖이라 임의로 구현하지 않는다. (CLAUDE.md 규칙 3, OQ-028)
 */
const MENU_ITEMS: { id: MenuId; label: string; disabled: boolean }[] = [
  { id: "new", label: "처음부터", disabled: false },
  { id: "continue", label: "이어하기", disabled: true },
  { id: "settings", label: "설정", disabled: false },
];

export default function TitleScreen({
  onStart,
  audio,
  onAudioChange,
}: {
  onStart: () => void;
  audio: AudioSettings;
  onAudioChange: (next: AudioSettings) => void;
}) {
  const screenRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLImageElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);
  const ornamentRef = useRef<HTMLImageElement>(null);
  const subtitleRef = useRef<HTMLImageElement>(null);
  const menuRef = useRef<HTMLElement>(null);

  /**
   * -1은 "아직 아무것도 고르지 않음"이다.
   * 0으로 시작하면 화면이 뜨자마자 처음부터가 선택돼 보이고, Enter를 잘못 눌러 런이 시작된다.
   */
  const [selected, setSelected] = useState(-1);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 키와 클릭이 같은 프레임에 겹쳐도 런이 두 번 시작되지 않게 한다.
  const startedRef = useRef(false);

  const start = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    onStart();
  }, [onStart]);

  const run = useCallback(
    (index: number) => {
      const item = MENU_ITEMS[index];
      if (!item || item.disabled) return;

      playSfx(SFX.select);
      if (item.id === "new") start();
      if (item.id === "settings") setSettingsOpen(true);
    },
    [start],
  );

  /** 선택을 옮기며 이동음을 낸다. 같은 자리면 아무 일도 하지 않는다. */
  const moveTo = useCallback(
    (next: number) => {
      if (next === selected) return;
      playSfx(SFX.move, { retrigger: true });
      setSelected(next);
    },
    [selected],
  );

  useEffect(() => {
    if (settingsOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const isDown = event.key === "ArrowDown" || event.key === "ArrowRight";
      const isUp = event.key === "ArrowUp" || event.key === "ArrowLeft";

      if (isDown || isUp) {
        event.preventDefault();
        // 아무것도 안 골라둔 상태에서 처음 누르면 위아래 무엇이든 첫 항목으로 들어온다.
        if (selected < 0) moveTo(0);
        else if (isDown) moveTo((selected + 1) % MENU_ITEMS.length);
        else moveTo((selected - 1 + MENU_ITEMS.length) % MENU_ITEMS.length);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        // 고른 것이 없으면 실행하지 않는다. 여기서 0을 넣으면 프리셀렉트를 없앤 의미가 사라진다.
        if (selected >= 0) run(selected);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [moveTo, run, selected, settingsOpen]);

  // 첫 페인트 전에 초기 상태를 잡아야 요소가 한 프레임 번쩍이지 않는다.
  useLayoutEffect(() => {
    const targets = [
      backdropRef.current,
      logoRef.current,
      ornamentRef.current,
      subtitleRef.current,
      menuRef.current,
    ];
    gsap.set(targets, { autoAlpha: 0 });

    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set(targets, { autoAlpha: 1 });
    });

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl
        // 배경이 먼저 천천히 밝아지며 조금씩 밀려 들어온다.
        .fromTo(
          backdropRef.current,
          { autoAlpha: 0, scale: 1.1 },
          { autoAlpha: 1, scale: 1.035, duration: 2.2, ease: "power2.out" },
          0,
        )
        // 타이틀은 위에서 살짝 내려앉으며 커진 상태에서 제자리로.
        .fromTo(
          logoRef.current,
          { autoAlpha: 0, y: -34, scale: 1.12 },
          { autoAlpha: 1, y: 0, scale: 1, duration: 1.5 },
          0.4,
        )
        // 장식은 위에서 아래로 그어지듯 자란다.
        .fromTo(
          ornamentRef.current,
          { autoAlpha: 0, scaleY: 0, transformOrigin: "50% 0%" },
          { autoAlpha: 1, scaleY: 1, duration: 0.8, ease: "power2.out" },
          1.3,
        )
        .fromTo(
          subtitleRef.current,
          { autoAlpha: 0, y: 14 },
          { autoAlpha: 1, y: 0, duration: 1.0, ease: "power2.out" },
          1.5,
        )
        .fromTo(
          menuRef.current,
          { autoAlpha: 0, y: 18 },
          { autoAlpha: 1, y: 0, duration: 0.9, ease: "power2.out" },
          2.2,
        )
        // 아주 느린 줌아웃. 정지 화면처럼 보이지 않게 하는 정도로만 움직인다.
        .to(backdropRef.current, { scale: 1, duration: 24, ease: "none" }, 2.2);
    });

    return () => mm.revert();
  }, []);

  return (
    <Screen ref={screenRef} data-node-id="1:33">
      <Backdrop ref={backdropRef} src={TITLE_ASSETS.background} alt="" draggable={false} />

      <Stage>
        <Art
          ref={logoRef}
          src={TITLE_ASSETS.logo}
          alt="NULL"
          left={381.7}
          top={40.53}
          w={1144.851}
          h={628.214}
          draggable={false}
        />
        <Art
          ref={ornamentRef}
          src={TITLE_ASSETS.ornament}
          alt=""
          left={917.76}
          top={568.94}
          w={84.649}
          h={149.411}
          draggable={false}
        />
        <Art
          ref={subtitleRef}
          src={TITLE_ASSETS.subtitle}
          alt="Zero Horizon"
          left={437.24}
          top={354.63}
          w={1045.515}
          h={348.505}
          draggable={false}
        />

        <Menu ref={menuRef}>
          {MENU_ITEMS.map((item, index) => (
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
      </Stage>

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
