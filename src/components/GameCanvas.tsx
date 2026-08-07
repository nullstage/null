"use client";

import styled from "@emotion/styled";
import { useEffect, useRef } from "react";

import type Phaser from "phaser";

import { theme } from "@/styles/theme";

/**
 * Phaser를 마운트하는 유일한 지점.
 *
 * Phaser 모듈 자체를 동적 임포트한다. 정적 내보내기 빌드 시 서버에서 평가되면
 * `window is not defined`로 실패하기 때문이다. (DEC-005)
 */
const Mount = styled.div`
  position: absolute;
  inset: 0;
  z-index: ${theme.z.canvas};
  /*
   * Phaser의 Scale.FIT은 창 비율이 16:9와 다르면 위아래에 여백을 남긴다. 캔버스를
   * 세로로 중앙 정렬하지 않고 맨 위에 붙였으므로(createGame.ts) 남는 여백은 전부
   * 아래쪽에만 생긴다 — 위쪽엔 더 이상 배경색이 보일 자리가 없다.
   * 그 여백이 기본 배경색(#12151c, 짙은 남색)이면 화면 톤과 안 맞고 파랗게 도드라져
   * 보였다 — 검은색으로 채운다.
   */
  background: #000000;

  canvas {
    display: block;
    margin: 0 auto;
  }
`;

export default function GameCanvas() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let game: Phaser.Game | null = null;
    let disposed = false;

    void (async () => {
      const { createGame } = await import("@/game/createGame");
      // React StrictMode의 이중 마운트로 게임이 두 개 생기는 것을 막는다.
      if (disposed) return;
      game = createGame(mount);
    })();

    return () => {
      disposed = true;
      // 씬 구독은 각 씬의 SHUTDOWN에서 해제된다. 여기서 버스를 통째로 비우면
      // 아직 마운트되어 있는 React 패널의 구독까지 끊어진다.
      game?.destroy(true);
      game = null;
    };
  }, []);

  return <Mount ref={mountRef} />;
}
