"use client";

import styled from "@emotion/styled";

import type { RunResult } from "@/game/types/game";
import { theme } from "@/styles/theme";

import Panel, { PanelActions, PanelButton, PanelRow } from "./Panel";

/**
 * 결과 리포트.
 *
 * OQ-019 미결정 — 표시 항목이 확정되지 않았다.
 * 현재는 "분석 → 카운터 → 역기만"이 실제로 일어났음을 보여주는 최소 항목만 넣었다.
 */

const Verdict = styled.p<{ cleared: boolean }>`
  margin: 0 0 ${theme.space(5)};
  font-size: 22px;
  letter-spacing: 0.1em;
  color: ${({ cleared }) => (cleared ? theme.color.success : theme.color.danger)};
`;

const Section = styled.div`
  margin-top: ${theme.space(5)};
  padding-top: ${theme.space(5)};
  border-top: 1px solid ${theme.color.border};
`;

const SectionTitle = styled.h3`
  margin: 0 0 ${theme.space(3)};
  font-size: 12px;
  letter-spacing: 0.18em;
  color: ${theme.color.textMuted};
`;

export interface ResultPanelProps {
  result: RunResult;
  onRestart: () => void;
}

export default function ResultPanel({ result, onRestart }: ResultPanelProps) {
  const totalSeconds = Math.round(result.totalTimeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");

  return (
    <Panel title="RUN REPORT">
      <Verdict cleared={result.cleared}>{result.cleared ? "RUN CLEARED" : "RUN FAILED"}</Verdict>

      <PanelRow>
        <span>총 소요 시간</span>
        <span>
          {minutes}분 {seconds}초
        </span>
      </PanelRow>
      <PanelRow>
        <span>최종 분석 결과</span>
        <span>{result.finalStyle}</span>
      </PanelRow>
      <PanelRow>
        <span>Director 예측</span>
        <span>
          {result.deception
            ? result.deception.succeeded
              ? "실패 (역기만 성공)"
              : "적중"
            : "판정 전"}
        </span>
      </PanelRow>

      <Section>
        <SectionTitle>방별 분석 추이</SectionTitle>
        {result.rooms.map((room) => (
          <PanelRow key={room.roomIndex}>
            <span>
              방 {room.roomIndex} · {room.roomId}
            </span>
            <span>{room.analysis?.style ?? "-"}</span>
          </PanelRow>
        ))}
      </Section>

      <Section>
        <SectionTitle>보스 패턴 사용</SectionTitle>
        {(Object.entries(result.bossPatternUsage) as [string, number][]).map(([pattern, count]) => (
          <PanelRow key={pattern}>
            <span>{pattern}</span>
            <span>
              {count}회 · 가중치 {result.bossWeights[pattern as keyof typeof result.bossWeights]}
            </span>
          </PanelRow>
        ))}
      </Section>

      <PanelActions>
        <PanelButton type="button" onClick={onRestart} autoFocus>
          다시 시작
        </PanelButton>
      </PanelActions>
    </Panel>
  );
}
