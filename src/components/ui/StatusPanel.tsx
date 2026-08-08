"use client";

import styled from "@emotion/styled";

import { UPGRADES } from "@/game/data/upgrades";
import type { HudState, UpgradeCategory } from "@/game/types/game";
import { theme } from "@/styles/theme";

import Panel from "./Panel";

/**
 * 상태창(E). 지금까지 모은 아티팩트와 현재 체력을 확인하는 용도다.
 * 강화 선택(UpgradePanel)과 달리 아무것도 고르지 않는다 — 순수 조회 화면.
 */

const CATEGORY_LABEL: Record<UpgradeCategory, string> = {
  MELEE: "근접",
  RANGED: "원거리",
  MOBILITY: "기동",
  HEALTH: "체력",
};

const CATEGORY_ORDER: UpgradeCategory[] = ["MELEE", "RANGED", "MOBILITY", "HEALTH"];

const HpRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: ${theme.space(5)};
  padding-bottom: ${theme.space(4)};
  border-bottom: 1px solid ${theme.color.border};

  span:first-of-type {
    color: ${theme.color.textMuted};
    font-size: 13px;
    letter-spacing: 0.08em;
  }

  span:last-of-type {
    font-size: 20px;
    color: #fff;
  }
`;

const CategoryTitle = styled.h3`
  margin: ${theme.space(4)} 0 ${theme.space(2)};
  font-family: ${theme.font.ui};
  font-weight: 300;
  font-size: 12px;
  letter-spacing: 0.16em;
  color: rgba(200, 56, 60, 0.85);

  &:first-of-type {
    margin-top: 0;
  }
`;

const ArtifactRow = styled.div`
  padding: ${theme.space(2)} 0;

  strong {
    display: block;
    font-family: ${theme.font.ui};
    font-weight: 400;
    font-size: 14px;
    color: #fff;
  }

  small {
    color: ${theme.color.textMuted};
    font-size: 12px;
    line-height: 1.6;
  }
`;

const Empty = styled.p`
  margin: ${theme.space(4)} 0;
  color: ${theme.color.textMuted};
  font-size: 13px;
`;

const Hint = styled.p`
  margin: ${theme.space(6)} 0 0;
  text-align: center;
  color: ${theme.color.textMuted};
  font-size: 12px;
  letter-spacing: 0.08em;
`;

export interface StatusPanelProps {
  hud: HudState;
}

export default function StatusPanel({ hud }: StatusPanelProps) {
  const byCategory = CATEGORY_ORDER.map((category) => ({
    category,
    owned: hud.selectedUpgrades.filter((id) => UPGRADES[id].category === category),
  })).filter((group) => group.owned.length > 0);

  return (
    <Panel title="「가진 것」">
      <HpRow>
        <span>체력</span>
        <span>
          {Math.round(hud.hp)} / {hud.maxHp}
        </span>
      </HpRow>

      {byCategory.length === 0 && <Empty>아직 얻은 아티팩트가 없다.</Empty>}

      {byCategory.map(({ category, owned }) => (
        <div key={category}>
          <CategoryTitle>{CATEGORY_LABEL[category]}</CategoryTitle>
          {owned.map((id) => (
            <ArtifactRow key={id}>
              <strong>{UPGRADES[id].name}</strong>
              <small>{UPGRADES[id].description}</small>
            </ArtifactRow>
          ))}
        </div>
      ))}

      <Hint>E — 닫기</Hint>
    </Panel>
  );
}
