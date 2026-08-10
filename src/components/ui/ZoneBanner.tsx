"use client";

import { keyframes } from "@emotion/react";
import styled from "@emotion/styled";
import { useEffect, useState } from "react";

import { assetPath } from "@/game/config/gameConfig";
import { theme } from "@/styles/theme";

/**
 * 지역 진입 배너 — 새 지역에 들어설 때 잠깐 떴다 사라진다.
 *
 * `name`이 바뀔 때마다(이전 지역과 다를 때만) 다시 재생한다. 조회 전용이라
 * 입력을 막지 않는다 — 클릭도 키 입력도 그대로 아래로 통과한다.
 */

const SHOW_MS = 2800;

const fadeInOut = keyframes`
  0% { opacity: 0; transform: translateY(-8px); }
  12% { opacity: 1; transform: translateY(0); }
  78% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-6px); }
`;

const Wrap = styled.div`
  position: absolute;
  /*
   * "화면 높이의 8%"가 아니라 "캔버스 높이의 8%"다. Phaser는 Scale.FIT + 가로만
   * 중앙 정렬(createGame.ts)이라 창 비율이 16:9보다 세로로 길면 남는 여백이 전부
   * 캔버스 아래쪽에 생긴다 — 이 컨테이너(HUDOverlay)는 창 전체 높이를 차지하므로
   * top: 8%는 그 여백까지 포함해 계산돼 캔버스 기준 배너 자리보다 아래로 밀린다.
   * 캔버스는 항상 가로를 꽉 채우므로(가로 여백 없음) 캔버스 높이는 100vw*9/16 =
   * 56.25vw로 정확히 구해진다 — 그 8%인 4.5vw를 쓰면 창 비율과 무관하게 캔버스
   * 기준으로 정확히 맞는다. (사용자 지적: 지역 배너 위치가 안 맞음)
   */
  top: 4.5vw;
  left: 50%;
  transform: translateX(-50%);
  z-index: ${theme.z.hud + 5};
  pointer-events: none;
  width: min(760px, 78vw);
  aspect-ratio: 1774 / 887;
  background: url(${assetPath("ui/zone-banner.png")}) center / 100% 100% no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: ${fadeInOut} ${SHOW_MS}ms ease forwards;
`;

const Name = styled.span`
  margin-top: 6%;
  padding: 0 6%;
  font-family: ${theme.font.ui};
  font-weight: 500;
  font-size: clamp(15px, 2.6vw, 24px);
  letter-spacing: 0.14em;
  color: #ffd9c8;
  text-shadow: 0 0 12px rgba(224, 38, 63, 0.85), 0 2px 3px rgba(0, 0, 0, 0.9);
  white-space: nowrap;
`;

export default function ZoneBanner({ name }: { name: string | null }) {
  // "prop이 바뀌면 상태를 조정한다" — 렌더 중 처리(React 공식 권장 패턴). effect 안에서
  // 매번 setState하면 케스케이딩 렌더 경고가 뜬다. `visible`이 null→문자열로 바뀌는
  // 것 자체가 새 마운트를 보장하므로, key에 타임스탬프 같은 별도 값은 필요 없다.
  const [prevName, setPrevName] = useState(name);
  const [visible, setVisible] = useState<string | null>(null);

  if (name !== prevName) {
    setPrevName(name);
    if (name) setVisible(name);
  }

  // 진짜 effect(외부 타이머)는 여기 하나뿐 — visible이 생길 때만 사라질 시점을 예약한다.
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(null), SHOW_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <Wrap key={visible}>
      <Name>{visible}</Name>
    </Wrap>
  );
}
