"use client";

import styled from "@emotion/styled";
import dynamic from "next/dynamic";

import HUDOverlay from "./HUDOverlay";
import CursorFollower from "./ui/CursorFollower";

/**
 * 캔버스와 UI 오버레이를 겹쳐 놓는 껍데기.
 *
 * Phaser는 `window`를 요구하므로 서버 렌더링에서 제외한다. (DEC-005)
 */
const GameCanvas = dynamic(() => import("./GameCanvas"), { ssr: false });

const Stage = styled.main`
  position: relative;
  width: 100vw;
  height: 100dvh;
  overflow: hidden;
  background: #12151c;
`;

export default function GameShell() {
  return (
    <Stage>
      <GameCanvas />
      <HUDOverlay />
      <CursorFollower />
    </Stage>
  );
}
