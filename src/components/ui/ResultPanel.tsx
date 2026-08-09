"use client";

import styled from "@emotion/styled";

import { FIXED_ROOM_SEQUENCE } from "@/game/data/rooms";
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
  dash: "돌진",
  projectile: "투사체",
  slam: "내려찍기",
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

/** 보스는 번호가 붙는 시험이 아니라 그 끝이다 — 줄 하나로 갈라 놓아야 목록이 그렇게 읽힌다. */
const BossRow = styled(PanelRow)`
  margin-top: ${theme.space(2)};
  padding-top: ${theme.space(3)};
  border-top: 1px solid ${theme.color.border};

  span:first-of-type {
    color: ${theme.color.danger};
  }
`;

export interface ResultPanelProps {
  result: RunResult;
  onRestart: () => void;
}

export default function ResultPanel({ result, onRestart }: ResultPanelProps) {
  /**
   * 로비(방 1)는 전투가 없어 남긴 기록도 없다 — 목록에 두면 늘 "-"인 줄이 하나 생기고,
   * 플레이어가 세는 방식(로비 → 1번째 → 2번째)과 번호도 어긋난다. 빼고 다시 매긴다.
   */
  const trials = result.rooms.filter((room) => room.roomId !== FIXED_ROOM_SEQUENCE[0]);

  /**
   * 마지막 시험의 성향은 분석이 아니라 역기만 판정에서 확정된다 — 그 방은
   * `attachAnalysis`를 거치지 않아 `analysis`가 비어 있다. 거기서 끌어와야
   * "속였다"고 적어 놓고 정작 무엇으로 속였는지는 "-"인 상태가 되지 않는다.
   */
  const styleOf = (room: (typeof trials)[number], index: number) =>
    room.analysis?.style ?? (index === trials.length - 1 ? result.deception?.actualStyle : undefined);

  const totalSeconds = Math.round(result.totalTimeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");

  return (
    <Panel title="「남겨진 기록」">
      <Verdict cleared={result.cleared}>
        {result.cleared ? "이름을 남겼다" : "기록이 여기서 끊겼다"}
      </Verdict>

      <PanelRow>
        <span>생존 시간</span>
        <span>
          {minutes}분 {seconds}초
        </span>
      </PanelRow>
      {/*
        "마지막 전투 방식"이 아니다 — 마지막에 싸운 건 보스이고, 그건 아래 목록에 따로 있다.
        이 줄은 기록자가 보스 패턴을 어떤 성향으로 짰는지, 즉 그 시험이 왜 그렇게
        생겼는지를 말한다. 아래 "보스가 쓴 패턴"의 비중이 이 값에서 나온다.
      */}
      <PanelRow>
        <span>기록자가 읽은 성향</span>
        <span>{STYLE_LABEL[result.finalStyle]}</span>
      </PanelRow>
      <PanelRow>
        <span>기록자를 속였는가</span>
        <span>
          {result.deception
            ? result.deception.succeeded
              ? "속였다"
              : "읽혔다"
            : "판단되지 않음"}
        </span>
      </PanelRow>

      <Section>
        <SectionTitle>시험마다 남긴 기록</SectionTitle>
        {trials.length === 0 && <PanelRow><span>남긴 기록이 없다</span><span>-</span></PanelRow>}
        {trials.map((room, index) => {
          const style = styleOf(room, index);
          return (
            <PanelRow key={room.roomIndex}>
              <span>{index + 1}번째 시험</span>
              <span>{style ? STYLE_LABEL[style] : "-"}</span>
            </PanelRow>
          );
        })}
        {/* 보스전에서 실제로 어떻게 싸웠는지. 판정에는 안 쓰이고 기록으로만 남는다. */}
        {result.bossStyle && (
          <BossRow>
            <span>보스</span>
            <span>{STYLE_LABEL[result.bossStyle]}</span>
          </BossRow>
        )}
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
          다시 기록한다
        </PanelButton>
      </PanelActions>
    </Panel>
  );
}
