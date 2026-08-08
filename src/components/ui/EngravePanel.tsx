"use client";

import styled from "@emotion/styled";
import { useState, type ReactElement } from "react";

import type { EngravingId, EngravingView } from "@/game/data/engravings";
import { theme } from "@/styles/theme";

import {
  BootIcon,
  GunIcon,
  HeartIcon,
  ReloadIcon,
  ShardIcon,
  SwordIcon,
} from "./HudIcons";
import Panel from "./Panel";

/**
 * 기록 제단 — 각인 육각 트리. (참고: 세피리아 각인판)
 *
 * 에셋 없이 clip-path 육각형으로 그린다. 노드 좌표는 데이터의 col/row에서 환산.
 * 해금 가능한 노드를 누르면 즉시 새긴다 — 검증·저장은 Phaser 쪽(Engravings)이 정본.
 */

const NODE_ICON: Record<EngravingId, ReactElement> = {
  ROOT: <ShardIcon />,
  VIGOR: <HeartIcon />,
  MEMORY: <ReloadIcon />,
  SPARE_SHELL: <GunIcon />,
  SWORD_PATH: <SwordIcon />,
  AFTERIMAGE: <BootIcon />,
};

/** 육각 크기와 격자 간격. 행을 반칸씩 겹쳐 벌집처럼 붙인다. */
const HEX_W = 84;
const HEX_H = 94;
const STEP_X = 88;
const STEP_Y = 50;

const Balance = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: ${theme.space(4)};
  padding-bottom: ${theme.space(3)};
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

const Board = styled.div`
  position: relative;
  margin: 0 auto;
  width: ${2 * STEP_X + HEX_W}px;
  height: ${3 * STEP_Y + HEX_H}px;
`;

const Hex = styled.button<{ state: "unlocked" | "available" | "locked" }>`
  position: absolute;
  width: ${HEX_W}px;
  height: ${HEX_H}px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
  border: none;
  font-family: inherit;
  cursor: ${({ state }) => (state === "available" ? "pointer" : "default")};
  background: ${({ state }) =>
    state === "unlocked"
      ? "linear-gradient(180deg, #3a2c14 0%, #241a0c 100%)"
      : state === "available"
        ? "linear-gradient(180deg, #2c2338 0%, #1a1424 100%)"
        : "rgba(255, 255, 255, 0.04)"};
  color: ${({ state }) =>
    state === "unlocked" ? "#f0d78a" : state === "available" ? "#c9a8ff" : "rgba(255,255,255,0.22)"};
  transition: filter 0.15s, color 0.15s;

  /* clip-path가 border를 잘라먹는다 — 안쪽 테두리는 의사 요소 육각으로 그린다. */
  &::before {
    content: "";
    position: absolute;
    inset: 3px;
    clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
    background: transparent;
    box-shadow: inset 0 0 0 2px
      ${({ state }) =>
        state === "unlocked"
          ? "rgba(240, 215, 138, 0.85)"
          : state === "available"
            ? "rgba(169, 127, 255, 0.75)"
            : "rgba(255, 255, 255, 0.12)"};
    pointer-events: none;
  }

  &:hover {
    filter: ${({ state }) => (state === "available" ? "brightness(1.35)" : "none")};
  }

  svg {
    width: 24px;
    height: 24px;
  }

  small {
    font-size: 11px;
    letter-spacing: 0.05em;
  }
`;

const Info = styled.div`
  min-height: 58px;
  margin-top: ${theme.space(4)};
  padding: ${theme.space(3)} ${theme.space(4)};
  border: 1px solid ${theme.color.border};
  background: rgba(255, 255, 255, 0.03);

  strong {
    display: block;
    margin-bottom: 4px;
    font-family: ${theme.font.ui};
    font-weight: 400;
    font-size: 14px;
    color: #f0d78a;
  }

  small {
    color: ${theme.color.textMuted};
    font-size: 12px;
    line-height: 1.6;
  }
`;

const Leave = styled.button`
  display: block;
  width: 100%;
  margin-top: ${theme.space(4)};
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

export interface EngravePanelProps {
  nodes: EngravingView[];
  shards: number;
  onBuy: (id: EngravingId) => void;
  onClose: () => void;
}

export default function EngravePanel({ nodes, shards, onBuy, onClose }: EngravePanelProps) {
  const [focused, setFocused] = useState<EngravingView | null>(null);

  return (
    <Panel title="「기록 제단」">
      <Balance>
        <span>그림자 조각</span>
        <span>◆ {shards}</span>
      </Balance>

      <Board>
        {nodes.map((node) => {
          const state = node.unlocked ? "unlocked" : node.available ? "available" : "locked";
          const affordable = shards >= node.cost;
          return (
            <Hex
              key={node.id}
              type="button"
              state={state}
              style={{ left: node.col * STEP_X, top: node.row * STEP_Y }}
              onMouseEnter={() => setFocused(node)}
              onClick={() => {
                setFocused(node);
                if (state === "available" && affordable) onBuy(node.id);
              }}
            >
              {NODE_ICON[node.id]}
              {!node.unlocked && <small>◆ {node.cost}</small>}
            </Hex>
          );
        })}
      </Board>

      <Info>
        {focused ? (
          <>
            <strong>
              {focused.name}
              {focused.unlocked ? " — 새겨짐" : focused.available ? "" : " — 잠김"}
            </strong>
            <small>{focused.description}</small>
          </>
        ) : (
          // 안내는 설명식으로, 플레이버 한 줄만 남긴다. (사용자 결정)
          <small>
            각인에 마우스를 올리면 설명이 표시됩니다. 해금 가능한 각인은 눌러서 새깁니다.
            <br />
            <em>— 침식이 삼키지 못하는, 유일한 기록이다.</em>
          </small>
        )}
      </Info>

      <Leave type="button" onClick={onClose}>
        물러나기
      </Leave>
    </Panel>
  );
}
