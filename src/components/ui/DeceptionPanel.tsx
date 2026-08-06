"use client";

import styled from "@emotion/styled";

import { DIRECTOR_DIALOGUE } from "@/game/data/directorRules";
import type { DeceptionResult } from "@/game/types/game";
import { theme } from "@/styles/theme";

import Panel, { PanelActions, PanelButton, PanelRow } from "./Panel";

/**
 * 역기만 판정 결과. (MVP_PLAN §6)
 *
 * 예측이 빗나갔고 방을 통과했으면 성공이다. 의도적 기만인지는 추론하지 않는다.
 */

const Verdict = styled.p<{ succeeded: boolean }>`
  margin: 0 0 ${theme.space(5)};
  font-size: 22px;
  letter-spacing: 0.1em;
  color: ${({ succeeded }) => (succeeded ? theme.color.success : theme.color.textMuted)};
`;

const Note = styled.p`
  margin: ${theme.space(5)} 0 0;
  padding-top: ${theme.space(5)};
  border-top: 1px solid ${theme.color.border};
  color: ${theme.color.warning};
  font-size: 15px;
  line-height: 1.7;
`;

export interface DeceptionPanelProps {
  result: DeceptionResult;
  onContinue: () => void;
}

export default function DeceptionPanel({ result, onContinue }: DeceptionPanelProps) {
  return (
    <Panel title="DIRECTOR PREDICTION">
      <Verdict succeeded={result.succeeded}>
        {result.succeeded ? "PREDICTION FAILED" : "PREDICTION CONFIRMED"}
      </Verdict>

      <PanelRow>
        <span>예측한 방식</span>
        <span>{result.predictedStyle}</span>
      </PanelRow>
      <PanelRow>
        <span>실제 사용한 방식</span>
        <span>{result.actualStyle}</span>
      </PanelRow>
      {result.succeeded && (
        <PanelRow>
          <span>보상</span>
          <span>체력 {result.healedAmount} 회복</span>
        </PanelRow>
      )}

      <Note>
        “{DIRECTOR_DIALOGUE[result.succeeded ? "deception_success" : "deception_failed"]}”
      </Note>

      <PanelActions>
        <PanelButton type="button" onClick={onContinue} autoFocus>
          보스전으로
        </PanelButton>
      </PanelActions>
    </Panel>
  );
}
