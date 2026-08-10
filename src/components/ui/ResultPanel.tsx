"use client";

import styled from "@emotion/styled";

import { FIXED_ROOM_SEQUENCE } from "@/game/data/rooms";
import { assetPath } from "@/game/config/gameConfig";
import type { BossPattern, RunResult } from "@/game/types/game";
import { theme } from "@/styles/theme";

import { STYLE_LABEL } from "./AnalysisPanel";
import { Backdrop } from "./Panel";

/**
 * 결과 리포트.
 *
 * 기록자가 이 시험의 장부를 덮는 장면이다. 통계표가 아니라 남겨진 기록으로 읽히게 쓴다.
 *
 * OQ-019 미결정 — 표시 항목이 확정되지 않았다.
 * 현재는 "분석 → 카운터 → 역기만"이 실제로 일어났음을 보여주는 최소 항목만 넣었다.
 *
 * 제공받은 장식 프레임(`ui/result-frame.png`, 1024×1536)을 그대로 잘라 썼다 — 위쪽 명패
 * 칸·가운데 큰 칸·아래 작은 칸(패턴별 태그)·하단 버튼 띠, 네 자리가 이미 그림에 그려져
 * 있어서 `Panel`의 9-slice 테두리 방식(칸이 하나뿐인 프레임 전용)으로는 못 담는다.
 * 대신 그림을 배경으로 깔고, 이미지에서 측정한 네 자리의 비율(원본 대비 %)로 내용을
 * 절대 위치시킨다 — `Boss.ts`의 체력바 프레임과 같은 방식이다.
 */

/** 패턴 키를 그대로 노출하면 기록이 아니라 로그로 보인다. */
const PATTERN_LABEL: Record<BossPattern, string> = {
  slash: "베기",
  dash: "돌진",
  projectile: "투사체",
  slam: "내려찍기",
};

/** `ui/result-frame.png` 실측값(원본 1024×1536 대비 비율). */
const FRAME = {
  aspect: 1024 / 1536,
  title: { left: 130 / 1024, right: 895 / 1024, top: 225 / 1536, bottom: 308 / 1536 },
  body: { left: 130 / 1024, right: 895 / 1024, top: 350 / 1536, bottom: 855 / 1536 },
  lower: { left: 150 / 1024, right: 895 / 1024, top: 905 / 1536, bottom: 1210 / 1536 },
  button: { left: 95 / 1024, right: 930 / 1024, top: 1250 / 1536, bottom: 1330 / 1536 },
} as const;

const zoneStyle = (zone: { left: number; right: number; top: number; bottom: number }) => `
  position: absolute;
  left: ${(zone.left * 100).toFixed(3)}%;
  right: ${((1 - zone.right) * 100).toFixed(3)}%;
  top: ${(zone.top * 100).toFixed(3)}%;
  height: ${((zone.bottom - zone.top) * 100).toFixed(3)}%;
`;

const FrameRoot = styled.div`
  position: relative;
  width: min(480px, 92vw);
  aspect-ratio: ${FRAME.aspect};
  background: url(${assetPath("ui/result-frame.png")}) center / 100% 100% no-repeat;
  color: ${theme.color.text};
  /* 이 프레임의 라벨은 대화가 아니라 보스 이름표 같은 고유명사 톤이라 네오둥근모를 쓴다. */
  font-family: ${theme.font.ui};
`;

const TitleZone = styled.div`
  ${zoneStyle(FRAME.title)}
  display: flex;
  align-items: center;
  justify-content: center;
`;

const TitleText = styled.h2<{ cleared: boolean }>`
  margin: 0;
  font-family: ${theme.font.ui};
  font-weight: 300;
  font-size: clamp(14px, 3.2vw, 17px);
  letter-spacing: 0.14em;
  color: ${({ cleared }) => (cleared ? theme.color.success : theme.color.danger)};
`;

const BodyZone = styled.div`
  ${zoneStyle(FRAME.body)}
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: ${theme.space(1)} ${theme.space(3)};
  overflow: hidden;
`;

const LowerZone = styled.div`
  ${zoneStyle(FRAME.lower)}
  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  padding: 0 ${theme.space(3)};
  overflow: hidden;
`;

const ButtonZone = styled.div`
  ${zoneStyle(FRAME.button)}
  display: flex;
  align-items: center;
  justify-content: center;
`;

const FrameButton = styled.button`
  width: 100%;
  height: 100%;
  border: 0;
  background: transparent;
  font-family: ${theme.font.ui};
  font-weight: 300;
  font-size: clamp(12px, 2.6vw, 14px);
  letter-spacing: 0.12em;
  color: #fff5f0;
  cursor: pointer;
  transition: letter-spacing 0.18s ease;

  &:hover {
    letter-spacing: 0.2em;
  }
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${theme.space(3)};
  font-size: clamp(10px, 2.3vw, 12px);
  line-height: 1.3;

  span:last-of-type {
    color: ${theme.color.textMuted};
  }
`;

/** 보스는 번호가 붙는 시험이 아니라 그 끝이다 — 색을 다르게 줘야 목록이 그렇게 읽힌다. */
const BossRow = styled(Row)`
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
    <Backdrop role="dialog" aria-modal="true" aria-label="「남겨진 기록」">
      <FrameRoot>
        <TitleZone>
          <TitleText cleared={result.cleared}>
            {result.cleared ? "이름을 남겼다" : "기록이 여기서 끊겼다"}
          </TitleText>
        </TitleZone>

        <BodyZone>
          <Row>
            <span>생존 시간</span>
            <span>
              {minutes}분 {seconds}초
            </span>
          </Row>
          {/*
            "마지막 전투 방식"이 아니다 — 마지막에 싸운 건 보스이고, 그건 아래 목록에 따로 있다.
            이 줄은 기록자가 보스 패턴을 어떤 성향으로 짰는지, 즉 그 시험이 왜 그렇게
            생겼는지를 말한다. 아래 "보스가 쓴 패턴"의 비중이 이 값에서 나온다.
          */}
          <Row>
            <span>기록자가 읽은 성향</span>
            <span>{STYLE_LABEL[result.finalStyle]}</span>
          </Row>
          <Row>
            <span>기록자를 속였는가</span>
            <span>
              {result.deception
                ? result.deception.succeeded
                  ? "속였다"
                  : "읽혔다"
                : "판단되지 않음"}
            </span>
          </Row>
          {trials.length === 0 && (
            <Row>
              <span>남긴 기록이 없다</span>
              <span>-</span>
            </Row>
          )}
          {trials.map((room, index) => {
            const style = styleOf(room, index);
            return (
              <Row key={room.roomIndex}>
                <span>{index + 1}번째 시험</span>
                <span>{style ? STYLE_LABEL[style] : "-"}</span>
              </Row>
            );
          })}
          {/* 보스전에서 실제로 어떻게 싸웠는지. 판정에는 안 쓰이고 기록으로만 남는다. */}
          {result.bossStyle && (
            <BossRow>
              <span>보스</span>
              <span>{STYLE_LABEL[result.bossStyle]}</span>
            </BossRow>
          )}
        </BodyZone>

        <LowerZone>
          {(Object.entries(result.bossPatternUsage) as [BossPattern, number][]).map(
            ([pattern, count]) => (
              <Row key={pattern}>
                <span>{PATTERN_LABEL[pattern]}</span>
                <span>
                  {count}회 · 비중 {result.bossWeights[pattern]}
                </span>
              </Row>
            ),
          )}
        </LowerZone>

        <ButtonZone>
          <FrameButton type="button" onClick={onRestart} autoFocus>
            다시 기록한다
          </FrameButton>
        </ButtonZone>
      </FrameRoot>
    </Backdrop>
  );
}
