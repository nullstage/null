"use client";

import styled from "@emotion/styled";

import {
  COUNTER_DIALOGUE_SOFT,
  COUNTER_SUMMARY,
  COUNTER_SUMMARY_SOFT,
  DIRECTOR_DIALOGUE,
  STYLE_TITLE,
  counterDialogueId,
} from "@/game/data/directorRules";
import { dashReliance } from "@/game/systems/DirectorPolicy";
import type { DirectorAnalysis, PlayStyle } from "@/game/types/game";
import { theme } from "@/styles/theme";

import Panel, { PanelActions, PanelButton, PanelRow } from "./Panel";

/**
 * 방 클리어 후 분석 팝업. (MVP_PLAN §7)
 *
 * 필수 표시: 감지된 스타일 / 근거리·원거리 비율 / 대시 의존도 / 신뢰도 / Director 대사
 * 표기는 기록자의 장부라는 설정을 따른다. 영문 헤더 대신 「기록」 계열 한국어를 쓴다.
 *
 * OQ-012 미결정 — 카운터 예고 공개 범위. 지금은 대응 방향 문장까지만 보여준다.
 */

/** 기만·결과 패널도 같은 말로 불러야 해서 여기서 한 번만 정의한다. */
export const STYLE_LABEL: Record<PlayStyle, string> = {
  MELEE: "근거리",
  RANGED: "원거리",
  MOBILE: "기동",
  MIXED: "혼합",
};

/**
 * 이 패널에서 가장 먼저 읽혀야 하는 한 줄.
 * 숫자를 먼저 보여주면 무엇을 봤다는 건지 전달되지 않는다.
 */
const Title = styled.p`
  margin: 0 0 ${theme.space(2)};
  font-family: ${theme.font.ui};
  font-weight: 300;
  font-size: 27px;
  letter-spacing: 0.04em;
  color: #fff;
`;

const TitleNote = styled.p`
  margin: 0 0 ${theme.space(6)};
  padding-bottom: ${theme.space(5)};
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  font-family: ${theme.font.ui};
  font-weight: 300;
  font-size: 14px;
  color: ${theme.color.textMuted};
`;

/** 다음 방이 어떻게 바뀌는지. 이게 없으면 분석만 하고 아무 일도 안 하는 것으로 보인다. */
const Counter = styled.p`
  margin: ${theme.space(6)} 0 0;
  padding: ${theme.space(4)} ${theme.space(5)};
  border-left: 2px solid #e05055;
  background: linear-gradient(90deg, rgba(112, 34, 35, 0.5) 0%, rgba(112, 34, 35, 0) 100%);
  font-family: ${theme.font.ui};
  font-weight: 300;
  font-size: 16px;
  color: #fff;
`;

const Dialogue = styled.p`
  margin: ${theme.space(5)} 0 0;
  color: ${theme.color.warning};
  font-size: 15px;
  line-height: 1.7;
`;

export interface AnalysisPanelProps {
  analysis: DirectorAnalysis;
  dashCount: number;
  onContinue: () => void;
  /**
   * 방 1 클리어 후(→방 2, 축소판)는 "soft", 방 2 클리어 후(→방 3, 하드 카운터)는 "hard"다.
   * 같은 문구를 두 번 쓰면 방 2에서 이미 판결이 난 것처럼 들려 방 3의 무게가 죽는다. (DEC-014)
   */
  counterStrength: "soft" | "hard";
}

export default function AnalysisPanel({
  analysis,
  dashCount,
  onContinue,
  counterStrength,
}: AnalysisPanelProps) {
  const percent = (ratio: number) => `${Math.round(ratio * 100)}%`;
  const soft = counterStrength === "soft";
  const counterSummary = soft ? COUNTER_SUMMARY_SOFT : COUNTER_SUMMARY;
  const counterLine = soft
    ? COUNTER_DIALOGUE_SOFT[analysis.style]
    : DIRECTOR_DIALOGUE[counterDialogueId(analysis.style)];

  return (
    <Panel title="너는 이렇게 싸웠다">
      <Title>{STYLE_TITLE[analysis.style]}</Title>
      <TitleNote>
        {STYLE_LABEL[analysis.style]} 위주로 싸웠다고 {Math.round(analysis.confidence)}% 확신한다
      </TitleNote>

      <PanelRow>
        <span>가까이서 맞힌 비율</span>
        <span>{percent(analysis.meleeRatio)}</span>
      </PanelRow>
      <PanelRow>
        <span>멀리서 맞힌 비율</span>
        <span>{percent(analysis.rangedRatio)}</span>
      </PanelRow>
      <PanelRow>
        <span>물러선 정도</span>
        <span>{dashReliance(dashCount)}</span>
      </PanelRow>

      {/* 분석보다 이 줄이 중요하다. 다음 방이 왜 달라지는지가 여기서만 전해진다. */}
      <Counter>다음 방 — {counterSummary[analysis.style]}</Counter>

      <Dialogue>
        “{DIRECTOR_DIALOGUE[analysis.dialogueId]}”
        <br />“{counterLine}”
      </Dialogue>

      <PanelActions>
        <PanelButton type="button" onClick={onContinue} autoFocus>
          더 나아간다
        </PanelButton>
      </PanelActions>
    </Panel>
  );
}
