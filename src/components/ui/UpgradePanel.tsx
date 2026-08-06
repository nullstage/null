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
  text-align: left;
  padding: ${theme.space(5)};
  border: 1px solid ${theme.color.border};
  border-radius: 8px;
  background: transparent;
  color: ${theme.color.text};
  font-family: inherit;
  cursor: pointer;
  transition: border-color 0.15s ease;

  &:hover:not(:disabled) {
    border-color: ${theme.color.accent};
  }

  &:disabled {
    opacity: 0.45;
    cursor: default;
  }

  strong {
    display: block;
    font-size: 16px;
    margin-bottom: ${theme.space(2)};
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
