"use client";

import styled from "@emotion/styled";
import { useState } from "react";

import type { UpgradeDefinition, UpgradeId } from "@/game/types/game";
import { theme } from "@/styles/theme";

import Panel from "./Panel";

/**
 * 강화 선택. (MVP_PLAN §2)
 *
 * 중복 입력 방지가 필수다. 두 번 눌리면 강화가 두 개 적용되거나
 * 방 전환이 두 번 일어난다. (MVP_PLAN §12 안정화 항목)
 */

const Choices = styled.div`
  display: grid;
  gap: ${theme.space(3)};
`;

const Choice = styled.button`
  position: relative;
  text-align: left;
  padding: ${theme.space(5)} ${theme.space(5)} ${theme.space(5)} ${theme.space(6)};
  /* 왼쪽 붉은 기둥이 카드의 얼굴이다. 테두리를 두르면 셋이 나란히 답답해진다. */
  border: none;
  border-left: 2px solid rgba(200, 56, 60, 0.45);
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 100%);
  font-family: inherit;
  color: ${theme.color.text};
  cursor: pointer;
  transition:
    background 0.18s ease,
    border-color 0.18s ease,
    transform 0.18s ease;

  &:hover:not(:disabled) {
    /* 살짝 앞으로 나온다. 지금 무엇을 고르고 있는지 손이 아니라 눈으로 안다. */
    transform: translateX(4px);
    border-left-color: #e05055;
    background: linear-gradient(90deg, rgba(112, 34, 35, 0.6) 0%, rgba(112, 34, 35, 0) 100%);
  }

  &:disabled {
    opacity: 0.4;
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
    color: ${theme.color.textMuted};
    font-size: 13px;
    line-height: 1.6;
  }
`;

export interface UpgradePanelProps {
  choices: UpgradeDefinition[];
  onSelect: (upgradeId: UpgradeId) => void;
}

export default function UpgradePanel({ choices, onSelect }: UpgradePanelProps) {
  const [locked, setLocked] = useState(false);

  const handleSelect = (upgradeId: UpgradeId) => {
    if (locked) return;
    setLocked(true);
    onSelect(upgradeId);
  };

  return (
    <Panel title="「주어진 것」">
      <Choices>
        {choices.map((choice) => (
          <Choice
            key={choice.id}
            type="button"
            disabled={locked}
            onClick={() => handleSelect(choice.id)}
          >
            <strong>{choice.name}</strong>
            <small>{choice.description}</small>
          </Choice>
        ))}
      </Choices>
    </Panel>
  );
}
