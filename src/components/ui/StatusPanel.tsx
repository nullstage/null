"use client";

import { css } from "@emotion/react";
import styled from "@emotion/styled";
import gsap from "gsap";
import { useEffect, useRef, useState, type ReactElement } from "react";

import { assetPath } from "@/game/config/gameConfig";
import { UPGRADES } from "@/game/data/upgrades";
import type { HudState, UpgradeCategory, UpgradeId } from "@/game/types/game";
import { theme } from "@/styles/theme";

import { BootIcon, CycloneIcon, GunIcon, HeartIcon, SpikeIcon, SwordIcon, WaveIcon } from "./HudIcons";
import { Backdrop } from "./Panel";

/**
 * 상태창(E) — 참고 이미지(inventory-frame.png)의 레이아웃 그대로 재현.
 *
 * 프레임 그림 하나를 배경으로 깔고, 그 위에 실제 좌표(1536x1024 기준 px를 %로 환산)로
 * 탭 6칸·7x5 슬롯 그리드·원형 초상·게이지 3줄·설명란을 투명 오버레이로 얹는다.
 * 슬롯 테두리·탭 아이콘·게이지 눈금(다이아 핍)은 전부 그림 안에 이미 그려져 있어
 * 따로 그리지 않는다 — 동적으로 바뀌는 부분만 겹친다.
 */

const SKILL_IDS: readonly UpgradeId[] = ["MELEE_SWORD_WAVE", "MELEE_SPIKE_ERUPTION", "MELEE_BLADE_CYCLONE"];

const SKILL_ICON: Partial<Record<UpgradeId, ReactElement>> = {
  MELEE_SWORD_WAVE: <WaveIcon />,
  MELEE_SPIKE_ERUPTION: <SpikeIcon />,
  MELEE_BLADE_CYCLONE: <CycloneIcon />,
  /* eslint-disable @next/next/no-img-element */
  HEALTH_MASK: <img src={assetPath("ui/items/mask-of-no-name.png")} alt="" />,
  MELEE_BERSERK: <img src={assetPath("ui/items/enraged-blade.png")} alt="" />,
  RANGED_RELOAD_BURST: <img src={assetPath("ui/items/hunters-revolver.png")} alt="" />,
  MOBILITY_FEATHER: <img src={assetPath("ui/items/feather-fall.png")} alt="" />,
  HEALTH_VAMPIRE: <img src={assetPath("ui/items/undying-heart.png")} alt="" />,
  ITEM_RED_STAR_SHARD: <img src={assetPath("ui/items/red-star-shard.png")} alt="" />,
  ITEM_GREED_EYE_ORB: <img src={assetPath("ui/items/greed-eye-orb.png")} alt="" />,
  ITEM_RUNNER_STAR: <img src={assetPath("ui/items/runner-star.png")} alt="" />,
  ITEM_SHADOWFLAME_RING: <img src={assetPath("ui/items/shadowflame-ring.png")} alt="" />,
  ITEM_BLOOD_NECKLACE: <img src={assetPath("ui/items/blood-necklace.png")} alt="" />,
  ITEM_BAT_AXE: <img src={assetPath("ui/items/bat-axe.png")} alt="" />,
  ITEM_NIGHT_MASK: <img src={assetPath("ui/items/night-mask.png")} alt="" />,
  ITEM_VIOLET_DIAMOND_PENDANT: <img src={assetPath("ui/items/violet-diamond-pendant.png")} alt="" />,
  ITEM_RED_SEAL: <img src={assetPath("ui/items/red-seal.png")} alt="" />,
  ITEM_VIOLET_GEM_PENDANT: <img src={assetPath("ui/items/violet-gem-pendant.png")} alt="" />,
  ITEM_RED_POTION: <img src={assetPath("ui/items/red-potion.png")} alt="" />,
  ITEM_VIOLET_POTION: <img src={assetPath("ui/items/violet-potion.png")} alt="" />,
  ITEM_BLUE_POTION: <img src={assetPath("ui/items/blue-potion.png")} alt="" />,
  ITEM_GOLD_POTION: <img src={assetPath("ui/items/gold-potion.png")} alt="" />,
  ITEM_TEAL_POTION: <img src={assetPath("ui/items/teal-potion.png")} alt="" />,
  ITEM_RED_SHARD: <img src={assetPath("ui/items/red-shard.png")} alt="" />,
  ITEM_VIOLET_WHIRL_ORB: <img src={assetPath("ui/items/violet-whirl-orb.png")} alt="" />,
  ITEM_TEAL_GEM: <img src={assetPath("ui/items/teal-gem.png")} alt="" />,
  ITEM_GOLD_CROSS_STAR: <img src={assetPath("ui/items/gold-cross-star.png")} alt="" />,
  ITEM_GEAR_HEART: <img src={assetPath("ui/items/gear-heart.png")} alt="" />,
  ITEM_RED_RING: <img src={assetPath("ui/items/red-ring.png")} alt="" />,
  ITEM_VIOLET_RING: <img src={assetPath("ui/items/violet-ring.png")} alt="" />,
  ITEM_BLUE_RING: <img src={assetPath("ui/items/blue-ring.png")} alt="" />,
  ITEM_GOLD_RING: <img src={assetPath("ui/items/gold-ring.png")} alt="" />,
  ITEM_TEAL_RING: <img src={assetPath("ui/items/teal-ring.png")} alt="" />,
  ITEM_BEAST_FANG: <img src={assetPath("ui/items/beast-fang.png")} alt="" />,
  ITEM_BLOOD_CAPE: <img src={assetPath("ui/items/blood-cape.png")} alt="" />,
  ITEM_SPIKED_STAR: <img src={assetPath("ui/items/spiked-star.png")} alt="" />,
  ITEM_RED_SPELLBOOK: <img src={assetPath("ui/items/red-spellbook.png")} alt="" />,
  ITEM_VIOLET_SPELLBOOK: <img src={assetPath("ui/items/violet-spellbook.png")} alt="" />,
  ITEM_BLUE_SPELLBOOK: <img src={assetPath("ui/items/blue-spellbook.png")} alt="" />,
  ITEM_GOLD_SPELLBOOK: <img src={assetPath("ui/items/gold-spellbook.png")} alt="" />,
  ITEM_GREEN_SPELLBOOK: <img src={assetPath("ui/items/green-spellbook.png")} alt="" />,
  ITEM_OLD_SCROLL: <img src={assetPath("ui/items/old-scroll.png")} alt="" />,
  ITEM_VIOLET_SCROLL: <img src={assetPath("ui/items/violet-scroll.png")} alt="" />,
  ITEM_BLOODY_SCROLL: <img src={assetPath("ui/items/bloody-scroll.png")} alt="" />,
  ITEM_GOLD_SCROLL: <img src={assetPath("ui/items/gold-scroll.png")} alt="" />,
  ITEM_WINGED_STAR: <img src={assetPath("ui/items/winged-star.png")} alt="" />,
  ITEM_RED_ARROW: <img src={assetPath("ui/items/red-arrow.png")} alt="" />,
  ITEM_OLD_RIFLE: <img src={assetPath("ui/items/old-rifle.png")} alt="" />,
  ITEM_VIOLET_DAGGER: <img src={assetPath("ui/items/violet-dagger.png")} alt="" />,
  ITEM_BLOOD_SCYTHE: <img src={assetPath("ui/items/blood-scythe.png")} alt="" />,
  ITEM_STAR_MACE: <img src={assetPath("ui/items/star-mace.png")} alt="" />,
  ITEM_BLACK_SHURIKEN: <img src={assetPath("ui/items/black-shuriken.png")} alt="" />,
  ITEM_VIOLET_SHURIKEN: <img src={assetPath("ui/items/violet-shuriken.png")} alt="" />,
  ITEM_GREEN_STAFF: <img src={assetPath("ui/items/green-staff.png")} alt="" />,
  ITEM_BLACK_HOURGLASS: <img src={assetPath("ui/items/black-hourglass.png")} alt="" />,
  ITEM_VIOLET_HOURGLASS: <img src={assetPath("ui/items/violet-hourglass.png")} alt="" />,
  ITEM_RED_LANTERN: <img src={assetPath("ui/items/red-lantern.png")} alt="" />,
  ITEM_THORN_CROWN: <img src={assetPath("ui/items/thorn-crown.png")} alt="" />,
  ITEM_VIOLET_LANTERN: <img src={assetPath("ui/items/violet-lantern.png")} alt="" />,
  ITEM_VIOLET_FLAME_ORB: <img src={assetPath("ui/items/violet-flame-orb.png")} alt="" />,
  ITEM_RED_WHIRL_ORB: <img src={assetPath("ui/items/red-whirl-orb.png")} alt="" />,
  ITEM_CRACKED_ORB: <img src={assetPath("ui/items/cracked-orb.png")} alt="" />,
  ITEM_GLASS_ORB: <img src={assetPath("ui/items/glass-orb.png")} alt="" />,
  /* eslint-enable @next/next/no-img-element */
};

const CATEGORY_ICON: Record<UpgradeCategory, ReactElement> = {
  MELEE: <SwordIcon />,
  RANGED: <GunIcon />,
  MOBILITY: <BootIcon />,
  HEALTH: <HeartIcon />,
};

const CATEGORY_LABEL: Record<UpgradeCategory, string> = {
  MELEE: "근접",
  RANGED: "원거리",
  MOBILITY: "기동",
  HEALTH: "생존",
};

const ELEMENT_LABEL: Record<string, string> = {
  FIRE: "화염",
  FROST: "냉기",
  POISON: "맹독",
  BLEED: "출혈",
  DARK: "암흑",
  SHOCK: "감전",
  HOLY: "신성",
};
const ELEMENT_COLOR: Record<string, string> = {
  FIRE: "#ff8a50",
  FROST: "#8fd7ff",
  POISON: "#8fe08a",
  BLEED: "#e0334f",
  DARK: "#a78bfa",
  SHOCK: "#ffe066",
  HOLY: "#f0d78a",
};

const iconFor = (id: UpgradeId): ReactElement => SKILL_ICON[id] ?? CATEGORY_ICON[UPGRADES[id].category];

/** 참고 그림(1536x1024)에서 잰 좌표. 전부 이 기준의 %로 환산해 오버레이를 얹는다. */
const IMG_W = 1536;
const IMG_H = 1024;
const pctX = (px: number) => `${(px / IMG_W) * 100}%`;
const pctY = (px: number) => `${(px / IMG_H) * 100}%`;

type TabId = "ALL" | UpgradeCategory | "ARTIFACT";

/** 탭 아이콘(검·투구·물약·반지·좌대·주사위)은 그림에 이미 그려져 있다 — 좌표와 분류만 정한다. */
const TABS: { id: TabId; label: string; cx: number; match: (id: UpgradeId) => boolean }[] = [
  { id: "MELEE", label: "근접", cx: 222, match: (id) => !id.startsWith("ITEM_") && UPGRADES[id].category === "MELEE" },
  { id: "HEALTH", label: "생존", cx: 352, match: (id) => !id.startsWith("ITEM_") && UPGRADES[id].category === "HEALTH" },
  { id: "RANGED", label: "원거리", cx: 482, match: (id) => !id.startsWith("ITEM_") && UPGRADES[id].category === "RANGED" },
  { id: "MOBILITY", label: "기동", cx: 612, match: (id) => !id.startsWith("ITEM_") && UPGRADES[id].category === "MOBILITY" },
  { id: "ARTIFACT", label: "아티팩트", cx: 742, match: (id) => id.startsWith("ITEM_") },
  { id: "ALL", label: "전체", cx: 872, match: () => true },
];
const TAB_TOP = 205;
const TAB_H = 57;
const TAB_W = 115;

const GRID = { left: 122, top: 288, width: 805, height: 545, cols: 7, rows: 5 };
const CELL_W = GRID.width / GRID.cols;
const CELL_H = GRID.height / GRID.rows;

const PORTRAIT = { cx: 1178, cy: 380, size: 150 };

const GAUGE = { left: 1038, width: 250, height: 20, rows: [567, 612, 657] };

const DESC = { left: 975, top: 705, width: 410, height: 120 };

const Frame = styled.div`
  position: relative;
  width: min(1300px, 94vw);
  aspect-ratio: ${IMG_W} / ${IMG_H};
  background: url(${assetPath("ui/inventory-frame.png")}) center / 100% 100% no-repeat;
  image-rendering: pixelated;
`;

const TabHit = styled.button<{ active: boolean }>`
  position: absolute;
  border: none;
  background: none;
  cursor: pointer;

  ${({ active }) =>
    active &&
    css`
      box-shadow: inset 0 0 0 2px rgba(240, 215, 138, 0.85), 0 0 10px rgba(240, 215, 138, 0.35);
    `}
`;

const GridSlot = styled.button<{ filled: boolean; selected: boolean }>`
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: ${({ selected }) => (selected ? "rgba(240, 215, 138, 0.16)" : "transparent")};
  box-shadow: ${({ selected }) => (selected ? "inset 0 0 0 2px rgba(240, 215, 138, 0.85)" : "none")};
  color: rgba(255, 255, 255, 0.9);
  cursor: ${({ filled }) => (filled ? "pointer" : "default")};

  svg,
  img {
    width: 62%;
    height: 62%;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8));
  }
`;

const ElementDot = styled.i<{ color: string }>`
  position: absolute;
  right: 8%;
  top: 8%;
  width: 12%;
  height: 12%;
  border-radius: 50%;
  background: ${({ color }) => color};
  box-shadow: 0 0 4px ${({ color }) => color};
`;

const PortraitHit = styled.div`
  position: absolute;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f0d78a;

  svg,
  img {
    width: 46%;
    height: 46%;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.85));
  }
`;

const GaugeFill = styled.div<{ pct: number }>`
  position: absolute;
  height: 100%;
  width: ${({ pct }) => pct * 100}%;
  max-width: 100%;
  background: linear-gradient(90deg, rgba(200, 56, 60, 0.25), rgba(200, 56, 60, 0.85));
  box-shadow: 0 0 6px rgba(200, 56, 60, 0.5);
  transition: width 0.25s ease;
`;

const DescOverlay = styled.div`
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: ${theme.space(2)};
  overflow: hidden;
  text-align: center;
  color: ${theme.color.text};

  strong {
    font-family: ${theme.font.ui};
    font-weight: 400;
    font-size: 14px;
    color: #f0d78a;
  }

  small {
    font-size: 11px;
    line-height: 1.5;
    color: ${theme.color.textMuted};
  }
`;

const TagRow = styled.div`
  display: flex;
  gap: 5px;
`;

const Tag = styled.span<{ color?: string }>`
  padding: 1px 7px;
  border: 1px solid ${({ color }) => color ?? "rgba(255, 255, 255, 0.25)"};
  font-size: 9px;
  letter-spacing: 0.1em;
  color: ${({ color }) => color ?? "rgba(255, 255, 255, 0.65)"};
`;

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${theme.space(3)};
`;

const Hint = styled.p`
  margin: 0;
  text-align: center;
  color: ${theme.color.textMuted};
  font-size: 12px;
  letter-spacing: 0.08em;
`;

export interface StatusPanelProps {
  hud: HudState;
}

export default function StatusPanel({ hud }: StatusPanelProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<TabId>("ALL");
  const [selected, setSelected] = useState<UpgradeId | null>(hud.selectedUpgrades[0] ?? null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tween = gsap.fromTo(frame, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.28, ease: "power2.out" });
    return () => {
      tween.kill();
    };
  }, []);

  const tab = TABS.find((t) => t.id === activeTab) ?? TABS[TABS.length - 1];
  const owned = hud.selectedUpgrades.filter(tab.match);
  const cellCount = Math.max(GRID.cols * GRID.rows, owned.length);
  const cells: (UpgradeId | null)[] = [...owned, ...Array<null>(cellCount - owned.length).fill(null)];

  const detail = selected ? UPGRADES[selected] : null;

  const attackFill = Math.min(
    1,
    hud.selectedUpgrades.filter((id) => UPGRADES[id].category === "MELEE" || UPGRADES[id].category === "RANGED").length / 10,
  );
  const defenseFill = Math.min(
    1,
    hud.selectedUpgrades.filter((id) => UPGRADES[id].category === "HEALTH" || UPGRADES[id].category === "MOBILITY").length / 8,
  );
  const hpFill = hud.maxHp > 0 ? Math.max(0, Math.min(1, hud.hp / hud.maxHp)) : 0;

  const selectTab = (id: TabId) => {
    setActiveTab(id);
    const nextOwned = hud.selectedUpgrades.filter(TABS.find((t) => t.id === id)!.match);
    if (!selected || !nextOwned.includes(selected)) {
      setSelected(nextOwned[0] ?? null);
    }
  };

  return (
    <Backdrop role="dialog" aria-modal="true" aria-label="「남아 있는 것」">
      <Wrap>
        <Frame ref={frameRef}>
          {TABS.map((t) => (
            <TabHit
              key={t.id}
              type="button"
              title={t.label}
              active={t.id === activeTab}
              onClick={() => selectTab(t.id)}
              style={{
                left: pctX(t.cx - TAB_W / 2),
                top: pctY(TAB_TOP),
                width: pctX(TAB_W),
                height: pctY(TAB_H),
              }}
            />
          ))}

          {cells.map((id, i) => {
            const col = i % GRID.cols;
            const row = Math.floor(i / GRID.cols);
            const filled = id !== null;
            return (
              <GridSlot
                key={id ?? `empty-${i}`}
                type="button"
                filled={filled}
                selected={filled && id === selected}
                onClick={() => id && setSelected(id)}
                style={{
                  left: pctX(GRID.left + col * CELL_W),
                  top: pctY(GRID.top + row * CELL_H),
                  width: pctX(CELL_W),
                  height: pctY(CELL_H),
                }}
              >
                {id && iconFor(id)}
                {id && UPGRADES[id].element && <ElementDot color={ELEMENT_COLOR[UPGRADES[id].element]} />}
              </GridSlot>
            );
          })}

          <PortraitHit
            style={{
              left: pctX(PORTRAIT.cx - PORTRAIT.size / 2),
              top: pctY(PORTRAIT.cy - PORTRAIT.size / 2),
              width: pctX(PORTRAIT.size),
              height: pctY(PORTRAIT.size),
            }}
          >
            {detail && iconFor(detail.id)}
          </PortraitHit>

          <div
            style={{
              position: "absolute",
              left: pctX(GAUGE.left),
              top: pctY(GAUGE.rows[0] - GAUGE.height / 2),
              width: pctX(GAUGE.width),
              height: pctY(GAUGE.height),
            }}
          >
            <GaugeFill pct={hpFill} />
          </div>
          <div
            style={{
              position: "absolute",
              left: pctX(GAUGE.left),
              top: pctY(GAUGE.rows[1] - GAUGE.height / 2),
              width: pctX(GAUGE.width),
              height: pctY(GAUGE.height),
            }}
          >
            <GaugeFill pct={attackFill} />
          </div>
          <div
            style={{
              position: "absolute",
              left: pctX(GAUGE.left),
              top: pctY(GAUGE.rows[2] - GAUGE.height / 2),
              width: pctX(GAUGE.width),
              height: pctY(GAUGE.height),
            }}
          >
            <GaugeFill pct={defenseFill} />
          </div>

          <DescOverlay
            style={{
              left: pctX(DESC.left),
              top: pctY(DESC.top),
              width: pctX(DESC.width),
              height: pctY(DESC.height),
            }}
          >
            {detail ? (
              <>
                <strong>{detail.name}</strong>
                <TagRow>
                  <Tag>{CATEGORY_LABEL[detail.category]}</Tag>
                  {SKILL_IDS.includes(detail.id) && <Tag color="#8fd7ff">스킬</Tag>}
                  {detail.element && <Tag color={ELEMENT_COLOR[detail.element]}>{ELEMENT_LABEL[detail.element]}</Tag>}
                </TagRow>
                <small>{detail.description}</small>
              </>
            ) : (
              <small>슬롯을 선택하면 자세한 내용을 확인할 수 있습니다.</small>
            )}
          </DescOverlay>
        </Frame>

        <Hint>E — 닫기</Hint>
      </Wrap>
    </Backdrop>
  );
}
