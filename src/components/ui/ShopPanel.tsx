"use client";

import styled from "@emotion/styled";
import { useState } from "react";

import type { UpgradeDefinition, UpgradeId } from "@/game/types/game";
import { theme } from "@/styles/theme";

import Panel from "./Panel";

/**
 * 마을 그림자 상인. 그림자 조각을 받고 강화를 판다. (DEC-014 #3)
 *
 * 한 번 열면 한 개만 산다 — 구매 즉시 닫히고, 더 사려면 다시 말을 건다.
 * 잔액 검증의 정본은 Phaser(`CombatScene.handleShopBuy`)다. 여기서는
 * 모자란 품목의 버튼을 잠가 실패 경로 자체를 만들지 않는다.
 */

const Balance = styled.div`
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
    font-size: 19px;
    color: #c9a8ff;
  }
`;

const Choices = styled.div`
  display: grid;
  gap: ${theme.space(3)};
`;

const Choice = styled.button`
  position: relative;
  text-align: left;
  padding: ${theme.space(5)} ${theme.space(5)} ${theme.space(5)} ${theme.space(6)};
  border: none;
  /* 강화 선택(붉은 기둥)과 구분되는 보랏빛 기둥 — 여긴 거래다. */
  border-left: 2px solid rgba(138, 92, 255, 0.45);
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 100%);
  font-family: inherit;
  color: ${theme.color.text};
  cursor: pointer;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    transform 0.18s ease;

  &:hover:not(:disabled) {
    transform: translateX(4px);
    border-left-color: #a97fff;
    background: linear-gradient(90deg, rgba(74, 44, 120, 0.6) 0%, rgba(74, 44, 120, 0) 100%);
  }

  &:disabled {
    opacity: 0.35;
    cursor: default;
  }

  strong {
    display: block;
    margin-bottom: ${theme.space(2)};
    font-family: ${theme.font.ui};
    font-weight: 400;
    font-size: 17px;
    color: #fff;
  }

  small {
    display: block;
    color: ${theme.color.textMuted};
    font-size: 13px;
    line-height: 1.6;
  }
`;

const Price = styled.span`
  position: absolute;
  top: ${theme.space(5)};
  right: ${theme.space(5)};
  font-size: 14px;
  color: #c9a8ff;
`;

const Empty = styled.p`
  margin: ${theme.space(4)} 0;
  color: ${theme.color.textMuted};
  font-size: 13px;
`;

const Leave = styled.button`
  display: block;
  width: 100%;
  margin-top: ${theme.space(6)};
  padding: ${theme.space(3)};
  border: 1px solid ${theme.color.border};
  background: none;
  font-family: ${theme.font.ui};
  font-weight: 300;
  font-size: 14px;
  letter-spacing: 0.12em;
  color: ${theme.color.textMuted};
  cursor: pointer;
  transition: color 0.18s ease, border-color 0.18s ease;

  &:hover {
    color: #fff;
    border-color: rgba(255, 255, 255, 0.4);
  }
`;

export interface ShopPanelProps {
  choices: UpgradeDefinition[];
  shards: number;
  price: number;
  onBuy: (upgradeId: UpgradeId) => void;
  onClose: () => void;
}

export default function ShopPanel({ choices, shards, price, onBuy, onClose }: ShopPanelProps) {
  const [locked, setLocked] = useState(false);

  const handleBuy = (upgradeId: UpgradeId) => {
    if (locked) return;
    setLocked(true);
    onBuy(upgradeId);
  };

  return (
    <Panel title="「그림자 상인」">
      <Balance>
        <span>그림자 조각</span>
        <span>◆ {shards}</span>
      </Balance>

      {choices.length === 0 && <Empty>더 팔 것이 없다. …전부 가져갔군.</Empty>}

      <Choices>
        {choices.map((choice) => (
          <Choice
            key={choice.id}
            type="button"
            disabled={locked || shards < price}
            onClick={() => handleBuy(choice.id)}
          >
            <strong>{choice.name}</strong>
            <small>{choice.description}</small>
            <Price>◆ {price}</Price>
          </Choice>
        ))}
      </Choices>

      <Leave type="button" onClick={onClose}>
        떠나기
      </Leave>
    </Panel>
  );
}
