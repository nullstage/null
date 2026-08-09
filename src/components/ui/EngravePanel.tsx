"use client";

import styled from "@emotion/styled";
import { useState } from "react";

import { assetPath } from "@/game/config/gameConfig";
import type { EngravingId, EngravingView } from "@/game/data/engravings";
import { theme } from "@/styles/theme";

import Panel from "./Panel";

/**
 * 기록 제단 — 각인 육각 트리. (참고: 세피리아 각인판)
 *
 * 제공받은 픽셀아트 육각 배지 6장을 그대로 쓴다(테두리·보석 장식까지 그림 안에 있다).
 * 노드 좌표는 데이터의 col/row에서 환산. 해금 가능한 노드를 누르면 즉시 새긴다 —
 * 검증·저장은 Phaser 쪽(Engravings)이 정본.
 */

const NODE_ICON: Record<EngravingId, string> = {
  ROOT: assetPath("ui/engravings/ROOT.png"),
  VIGOR: assetPath("ui/engravings/VIGOR.png"),
  MEMORY: assetPath("ui/engravings/MEMORY.png"),
  SPARE_SHELL: assetPath("ui/engravings/SPARE_SHELL.png"),
  SWORD_PATH: assetPath("ui/engravings/SWORD_PATH.png"),
  AFTERIMAGE: assetPath("ui/engravings/AFTERIMAGE.png"),
};

/** 육각 배지 크기와 격자 간격. 행을 반칸씩 겹쳐 벌집처럼 붙인다. */
const HEX_W = 92;
const HEX_H = 100;
const STEP_X = 92;
const STEP_Y = 54;

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

/** 배지 그림 자체가 테두리·보석까지 다 그려져 있다 — CSS로는 상태별 밝기만 조절한다. */
const Hex = styled.button<{ state: "unlocked" | "available" | "locked"; icon: string }>`
  position: absolute;
  width: ${HEX_W}px;
  height: ${HEX_H}px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding-bottom: 6px;
  border: none;
  background: url(${({ icon }) => icon}) center / contain no-repeat;
  font-family: inherit;
  cursor: ${({ state }) => (state === "available" ? "pointer" : "default")};
  color: ${({ state }) =>
    state === "unlocked" ? "#f0d78a" : state === "available" ? "#c9a8ff" : "rgba(255,255,255,0.22)"};
  filter: ${({ state }) =>
    state === "locked" ? "grayscale(0.85) brightness(0.5)" : "none"};
  transition: filter 0.15s;

  &:hover {
    filter: ${({ state }) =>
      state === "available" ? "brightness(1.3)" : state === "locked" ? "grayscale(0.85) brightness(0.5)" : "none"};
  }

  small {
    font-size: 11px;
    letter-spacing: 0.05em;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9), 0 0 6px rgba(0, 0, 0, 0.9);
  }
`;

/**
 * 비용 표시. 조각이 모자라면 붉게 물든다 — 눌러도 아무 일이 없는 이유가
 * 설명을 읽기 전에 값에서 먼저 보여야 한다.
 */
const Cost = styled.small<{ short: boolean }>`
  color: ${({ short }) => (short ? "#e05055" : "inherit")};
`;

/** 설명 아래 한 줄. 왜 새길 수 없는지를 말해 준다. */
const Shortage = styled.small`
  display: block;
  margin-top: 6px;
  color: #e05055;
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
  // 노드 객체가 아니라 id만 들고 있는다. 각인을 새기면 부모가 갱신된 `nodes`를
  // 다시 내려주는데, 객체를 붙잡고 있으면 방금 새긴 각인이 계속 "잠김"으로 남는다.
  const [focusedId, setFocusedId] = useState<EngravingId | null>(null);
  const focused = nodes.find((node) => node.id === focusedId) ?? null;

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
              icon={NODE_ICON[node.id]}
              style={{ left: node.col * STEP_X, top: node.row * STEP_Y }}
              onMouseEnter={() => setFocusedId(node.id)}
              onClick={() => {
                setFocusedId(node.id);
                if (state === "available" && affordable) onBuy(node.id);
              }}
            >
              {!node.unlocked && (
                <Cost short={state === "available" && !affordable}>◆ {node.cost}</Cost>
              )}
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
            {focused.available && shards < focused.cost && (
              <Shortage>그림자 조각이 모자라다.</Shortage>
            )}
          </>
        ) : (
          // 안내는 설명식으로, 플레이버 한 줄만 남긴다. (사용자 결정)
          <small>
            각인에 마우스를 올리면 남겨진 기록을 확인할 수 있습니다.
            <br />
            새길 수 있는 각인을 선택하면 다음 기록에도 그 흔적이 남습니다.
            <br />
            <em>침식도 한 번 새겨진 기록까지는 지우지 못한다.</em>
          </small>
        )}
      </Info>

      <Leave type="button" onClick={onClose}>
        제단에서 물러난다
      </Leave>
    </Panel>
  );
}
