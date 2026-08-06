"use client";

import styled from "@emotion/styled";

import type {
  BossPatternWeights,
  CombatTelemetry,
  DirectorAnalysis,
  GamePhase,
  RoomId,
} from "@/game/types/game";
import { theme } from "@/styles/theme";

/**
 * F1 디버그 패널. (MVP_PLAN §7)
 *
 * 일반 플레이에서는 꺼진 상태가 기본이고, 시연 촬영의 증거 장면에 사용한다.
 * OQ-022 미결정 — 배포 빌드에 포함할지 확정되지 않았다. 지금은 포함한다.
 */

const Box = styled.aside`
  position: absolute;
  top: ${theme.space(4)};
  right: ${theme.space(4)};
  z-index: ${theme.z.debug};
  min-width: 240px;
  padding: ${theme.space(4)};
  border: 1px solid ${theme.color.border};
  border-radius: 6px;
  background: rgba(6, 8, 12, 0.86);
  color: ${theme.color.text};
  font-family: ${theme.font.mono};
  font-size: 12px;
  line-height: 1.8;
  pointer-events: none;
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${theme.space(4)};

  span:last-of-type {
    color: ${theme.color.accent};
  }
`;

const Divider = styled.hr`
  margin: ${theme.space(2)} 0;
  border: none;
  border-top: 1px solid ${theme.color.border};
`;

export interface DebugPanelProps {
  phase: GamePhase;
  roomIndex: number;
  roomId: RoomId;
  telemetry: CombatTelemetry | null;
  analysis: DirectorAnalysis | null;
  bossWeights: BossPatternWeights;
}

export default function DebugPanel({
  phase,
  roomIndex,
  roomId,
  telemetry,
  analysis,
  bossWeights,
}: DebugPanelProps) {
  return (
    <Box>
      <Row>
        <span>phase</span>
        <span>{phase}</span>
      </Row>
      <Row>
        <span>room</span>
        <span>
          {roomIndex} · {roomId || "-"}
        </span>
      </Row>
      <Divider />
      <Row>
        <span>melee hits</span>
        <span>{telemetry?.meleeHits ?? 0}</span>
      </Row>
      <Row>
        <span>ranged hits</span>
        <span>{telemetry?.rangedHits ?? 0}</span>
      </Row>
      <Row>
        <span>dash</span>
        <span>{telemetry?.dashCount ?? 0}</span>
      </Row>
      <Divider />
      <Row>
        <span>style</span>
        <span>{analysis?.style ?? "-"}</span>
      </Row>
      <Row>
        <span>confidence</span>
        <span>{analysis ? `${Math.round(analysis.confidence)}%` : "-"}</span>
      </Row>
      <Row>
        <span>counter room</span>
        <span>{analysis?.counterRoomId ?? "-"}</span>
      </Row>
      <Divider />
      <Row>
        <span>boss weights</span>
        <span>
          {bossWeights.slash}/{bossWeights.dash}/{bossWeights.projectile}/{bossWeights.slam}
        </span>
      </Row>
    </Box>
  );
}
