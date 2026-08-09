"use client";

import styled from "@emotion/styled";
import { useState, type ReactElement } from "react";

import { assetPath } from "@/game/config/gameConfig";
import { UPGRADES } from "@/game/data/upgrades";
import type { HudState, UpgradeCategory, UpgradeId } from "@/game/types/game";
import { theme } from "@/styles/theme";

import {
  BootIcon,
  CycloneIcon,
  GunIcon,
  HeartIcon,
  SpikeIcon,
  SwordIcon,
  WaveIcon,
} from "./HudIcons";
import Panel from "./Panel";

/**
 * 상태창(E) — 스컬식 시트.
 *
 * 왼쪽: 스킬·아티팩트 아이콘 슬롯 그리드. 오른쪽: 선택한 것의 상세
 * (원형 초상 프레임 + 이름 배너 + 분류·속성 태그 + 설명).
 * 내용은 CSS로 그리고, 테두리만 참고 시트(ui/inventory-frame.png)를 잘라 쓴다.
 * 조회 전용이다 — 아무것도 고르지 않는다.
 */

const SKILL_IDS: readonly UpgradeId[] = [
  "MELEE_SWORD_WAVE",
  "MELEE_SPIKE_ERUPTION",
  "MELEE_BLADE_CYCLONE",
];

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

const iconFor = (id: UpgradeId): ReactElement =>
  SKILL_ICON[id] ?? CATEGORY_ICON[UPGRADES[id].category];

const Sheet = styled.div`
  display: flex;
  gap: ${theme.space(5)};
`;

const LeftCol = styled.div`
  width: 196px;
  flex-shrink: 0;
`;

const HpRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: ${theme.space(4)};
  padding-bottom: ${theme.space(3)};
  border-bottom: 1px solid ${theme.color.border};

  span:first-of-type {
    color: ${theme.color.textMuted};
    font-size: 12px;
    letter-spacing: 0.08em;
  }

  span:last-of-type {
    font-size: 17px;
    color: #fff;
  }
`;

const SectionLabel = styled.h3`
  margin: ${theme.space(4)} 0 ${theme.space(2)};
  font-family: ${theme.font.ui};
  font-weight: 300;
  font-size: 11px;
  letter-spacing: 0.2em;
  color: rgba(200, 56, 60, 0.85);

  &:first-of-type {
    margin-top: 0;
  }
`;

const SlotGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 44px);
  gap: 6px;
`;

const Slot = styled.button<{ filled: boolean; selected: boolean }>`
  position: relative;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid
    ${({ selected, filled }) =>
      selected ? "#f0d78a" : filled ? "rgba(255, 255, 255, 0.28)" : "rgba(255, 255, 255, 0.1)"};
  background: ${({ filled }) => (filled ? "rgba(8, 5, 9, 0.8)" : "rgba(255, 255, 255, 0.03)")};
  color: ${({ selected }) => (selected ? "#f0d78a" : "rgba(255, 255, 255, 0.85)")};
  box-shadow: ${({ selected }) => (selected ? "0 0 8px rgba(240, 215, 138, 0.35)" : "none")};
  cursor: ${({ filled }) => (filled ? "pointer" : "default")};
  transition: border-color 0.15s, color 0.15s, box-shadow 0.15s;

  svg,
  img {
    width: 22px;
    height: 22px;
  }
`;

/** 속성 아티팩트 슬롯 모서리의 작은 점 — 무슨 속성인지 색으로만 알린다. */
const ElementDot = styled.i<{ color: string }>`
  position: absolute;
  right: 3px;
  top: 3px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: ${({ color }) => color};
  box-shadow: 0 0 4px ${({ color }) => color};
`;

const Detail = styled.div`
  flex: 1;
  min-width: 250px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

/** 상세 상단의 원형 초상 프레임 — 참고 시트의 캐릭터 메달리온 문법. */
const PortraitRing = styled.div`
  width: 78px;
  height: 78px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 2px solid rgba(240, 215, 138, 0.75);
  box-shadow:
    inset 0 0 0 4px rgba(8, 5, 9, 0.9),
    inset 0 0 0 5px rgba(240, 215, 138, 0.3),
    0 0 14px rgba(240, 215, 138, 0.18);
  background: radial-gradient(circle, rgba(58, 44, 20, 0.6) 0%, rgba(8, 5, 9, 0.95) 75%);
  color: #f0d78a;

  svg,
  img {
    width: 34px;
    height: 34px;
  }
`;

const NameBanner = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.space(3)};
  width: 100%;
  margin: ${theme.space(3)} 0 ${theme.space(2)};
  font-family: ${theme.font.ui};
  font-weight: 400;
  font-size: 17px;
  color: #fff;
  text-align: center;

  &::before,
  &::after {
    content: "";
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(240, 215, 138, 0.5), transparent);
  }
`;

const TagRow = styled.div`
  display: flex;
  gap: 6px;
  margin-bottom: ${theme.space(3)};
`;

const Tag = styled.span<{ color?: string }>`
  padding: 2px 10px;
  border: 1px solid ${({ color }) => color ?? "rgba(255, 255, 255, 0.25)"};
  font-size: 11px;
  letter-spacing: 0.14em;
  color: ${({ color }) => color ?? "rgba(255, 255, 255, 0.65)"};
`;

const DescBox = styled.p`
  width: 100%;
  margin: 0;
  padding: ${theme.space(4)};
  border: 1px solid ${theme.color.border};
  background: rgba(255, 255, 255, 0.03);
  color: ${theme.color.textMuted};
  font-size: 13px;
  line-height: 1.7;
  text-align: center;
`;

const Empty = styled.p`
  margin: ${theme.space(6)} 0;
  color: ${theme.color.textMuted};
  font-size: 13px;
  text-align: center;
`;

const Hint = styled.p`
  margin: ${theme.space(5)} 0 0;
  text-align: center;
  color: ${theme.color.textMuted};
  font-size: 12px;
  letter-spacing: 0.08em;
`;

export interface StatusPanelProps {
  hud: HudState;
}

export default function StatusPanel({ hud }: StatusPanelProps) {
  const ownedSkills = SKILL_IDS.filter((id) => hud.selectedUpgrades.includes(id));
  const ownedArtifacts = hud.selectedUpgrades.filter((id) => !SKILL_IDS.includes(id));
  const [selected, setSelected] = useState<UpgradeId | null>(
    ownedSkills[0] ?? ownedArtifacts[0] ?? null,
  );

  const detail = selected ? UPGRADES[selected] : null;

  /** 고정 칸 수를 유지해 "인벤토리 판"으로 보이게 한다 — 빈 칸도 시트의 일부다. */
  const skillCells: (UpgradeId | null)[] = [
    ...ownedSkills,
    ...Array<null>(Math.max(0, 4 - ownedSkills.length)).fill(null),
  ];
  const artifactCells: (UpgradeId | null)[] = [
    ...ownedArtifacts,
    ...Array<null>(Math.max(0, 12 - ownedArtifacts.length)).fill(null),
  ];

  return (
    <Panel
      title="「남아 있는 것」"
      frameImage={assetPath("ui/inventory-frame.png")}
      /*
       * 원본(1536x1024)은 인벤토리 화면 통짜 목업이라 가운데에 칸 격자·초상화가
       * 그려져 있다. 바깥 장식 띠가 끝나는 지점(위 185 / 오른쪽 150 / 아래 140 /
       * 왼쪽 150)에서 잘라 테두리로만 쓰고, 안쪽 목업은 버린다 — 격자와 상세는
       * 아래 CSS 슬롯이 이미 그리고 있다.
       */
      frameSlice="185 150 140 150"
      frameWidth="54px 44px 42px 44px"
      framePadding="68px 44px 52px"
      /* 장식 띠가 좌우 44px씩 먹으므로 기본 560px면 상세 설명 칸이 깨져 접힌다. */
      maxWidth="640px"
    >
      <Sheet>
        <LeftCol>
          <HpRow>
            <span>체력</span>
            <span>
              {Math.round(hud.hp)} / {hud.maxHp}
            </span>
          </HpRow>

          <SectionLabel>스킬</SectionLabel>
          <SlotGrid>
            {skillCells.map((id, i) => (
              <Slot
                key={id ?? `skill-empty-${i}`}
                type="button"
                filled={id !== null}
                selected={id !== null && id === selected}
                onClick={() => id && setSelected(id)}
              >
                {id && iconFor(id)}
              </Slot>
            ))}
          </SlotGrid>

          <SectionLabel>아티팩트</SectionLabel>
          <SlotGrid>
            {artifactCells.map((id, i) => (
              <Slot
                key={id ?? `artifact-empty-${i}`}
                type="button"
                filled={id !== null}
                selected={id !== null && id === selected}
                onClick={() => id && setSelected(id)}
              >
                {id && iconFor(id)}
                {id && UPGRADES[id].element && (
                  <ElementDot color={ELEMENT_COLOR[UPGRADES[id].element]} />
                )}
              </Slot>
            ))}
          </SlotGrid>
        </LeftCol>

        <Detail>
          {detail ? (
            <>
              <PortraitRing>{iconFor(detail.id)}</PortraitRing>
              <NameBanner>{detail.name}</NameBanner>
              <TagRow>
                <Tag>{CATEGORY_LABEL[detail.category]}</Tag>
                {SKILL_IDS.includes(detail.id) && <Tag color="#8fd7ff">스킬</Tag>}
                {detail.element && (
                  <Tag color={ELEMENT_COLOR[detail.element]}>{ELEMENT_LABEL[detail.element]}</Tag>
                )}
              </TagRow>
              <DescBox>{detail.description}</DescBox>
            </>
          ) : (
            <Empty>
              아직 남겨진 스킬이나 아티팩트가 없습니다.
              <br />
              슬롯을 선택하면 자세한 내용을 확인할 수 있습니다.
            </Empty>
          )}
        </Detail>
      </Sheet>

      <Hint>E — 닫기</Hint>
    </Panel>
  );
}
