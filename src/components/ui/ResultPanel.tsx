"use client";

import styled from "@emotion/styled";

import type { BossPattern, RunResult } from "@/game/types/game";
import { theme } from "@/styles/theme";

import { STYLE_LABEL } from "./AnalysisPanel";
import Panel, { PanelActions, PanelButton, PanelRow } from "./Panel";

/**
 * 결과 리포트.
 *
 * 기록자가 이 시험의 장부를 덮는 장면이다. 통계표가 아니라 남겨진 기록으로 읽히게 쓴다.
 *
 * OQ-019 미결정 — 표시 항목이 확정되지 않았다.
 * 현재는 "분석 → 카운터 → 역기만"이 실제로 일어났음을 보여주는 최소 항목만 넣었다.
 */

/** 패턴 키를 그대로 노출하면 기록이 아니라 로그로 보인다. */
const PATTERN_LABEL: Record<BossPattern, string> = {
  slash: "베기",
  dash: "짓쳐듦",
  projectile: "던짐",
  slam: "내리침",
};

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
    <Panel title="이번 런">
      <Verdict cleared={result.cleared}>
        {result.cleared ? "시험을 지났다" : "돌아오지 못했다"}
      </Verdict>

      <PanelRow>
        <span>걸린 시간</span>
        <span>
          {minutes}분 {seconds}초
        </span>
      </PanelRow>
      <PanelRow>
        <span>끝내 싸운 방식</span>
        <span>{STYLE_LABEL[result.finalStyle]}</span>
      </PanelRow>
      <PanelRow>
        <span>예측을 속였는가</span>
        <span>
          {result.deception
            ? result.deception.succeeded
              ? "속였다"
              : "읽혔다"
            : "기록이 끊겼다"}
        </span>
      </PanelRow>

      <Section>
        <SectionTitle>방마다 어떻게 봤는가</SectionTitle>
        {result.rooms.map((room) => (
          <PanelRow key={room.roomIndex}>
            <span>{room.roomIndex}번째 방</span>
            <span>{room.analysis ? STYLE_LABEL[room.analysis.style] : "-"}</span>
          </PanelRow>
        ))}
      </Section>

      <Section>
        <SectionTitle>보스가 쓴 패턴</SectionTitle>
        {(Object.entries(result.bossPatternUsage) as [BossPattern, number][]).map(
          ([pattern, count]) => (
            <PanelRow key={pattern}>
              <span>{PATTERN_LABEL[pattern]}</span>
              <span>
                {count}회 · 비중 {result.bossWeights[pattern]}
              </span>
            </PanelRow>
          ),
        )}
      </Section>

      <PanelActions>
        <PanelButton type="button" onClick={onRestart} autoFocus>
          다시 선다
        </PanelButton>
      </PanelActions>
    </Panel>
  );
}
