"use client";

import styled from "@emotion/styled";

import { DIRECTOR_DIALOGUE, counterDialogueId } from "@/game/data/directorRules";
import { dashReliance } from "@/game/systems/DirectorPolicy";
import type { DirectorAnalysis, PlayStyle } from "@/game/types/game";
import { theme } from "@/styles/theme";

import Panel, { PanelActions, PanelButton, PanelRow } from "./Panel";

/**
 * 방 클리어 후 분석 팝업. (MVP_PLAN §7)
 *
 * 필수 표시: 감지된 스타일 / 근거리·원거리 비율 / 대시 의존도 / 신뢰도 / Director 대사
 *
 * OQ-012 미결정 — 카운터 예고 공개 범위. 지금은 대응 방향 문장까지만 보여준다.
 */

const STYLE_LABEL: Record<PlayStyle, string> = {
  MELEE: "근거리",
  RANGED: "원거리",
  MOBILE: "기동",
  MIXED: "혼합",
};

const Dialogue = styled.p`
  margin: ${theme.space(6)} 0 0;
  padding-top: ${theme.space(5)};
  border-top: 1px solid ${theme.color.border};
  color: ${theme.color.warning};
  font-size: 15px;
  line-height: 1.7;
`;

export interface AnalysisPanelProps {
  analysis: DirectorAnalysis;
  dashCount: number;
  onContinue: () => void;
}

export default function AnalysisPanel({ analysis, dashCount, onContinue }: AnalysisPanelProps) {
  const percent = (ratio: number) => `${Math.round(ratio * 100)}%`;

  return (
    <Panel title="DIRECTOR ANALYSIS">
      <PanelRow>
        <span>주 전투 방식</span>
        <span>{STYLE_LABEL[analysis.style]}</span>
      </PanelRow>
      <PanelRow>
        <span>근거리 적중 비율</span>
        <span>{percent(analysis.meleeRatio)}</span>
      </PanelRow>
      <PanelRow>
        <span>원거리 적중 비율</span>
        <span>{percent(analysis.rangedRatio)}</span>
      </PanelRow>
      <PanelRow>
        <span>대시 의존도</span>
        <span>{dashReliance(dashCount)}</span>
      </PanelRow>
      <PanelRow>
        <span>분석 신뢰도</span>
        <span>{Math.round(analysis.confidence)}%</span>
      </PanelRow>

      <Dialogue>
        “{DIRECTOR_DIALOGUE[analysis.dialogueId]}”
        <br />“{DIRECTOR_DIALOGUE[counterDialogueId(analysis.style)]}”
      </Dialogue>

      <PanelActions>
        <PanelButton type="button" onClick={onContinue} autoFocus>
          계속
        </PanelButton>
      </PanelActions>
    </Panel>
  );
}
