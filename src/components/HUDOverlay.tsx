"use client";

import styled from "@emotion/styled";
import { useCallback, useEffect, useState } from "react";

import { DEFAULT_BOSS_WEIGHTS } from "@/game/data/directorRules";
import { emitGameEvent, useGameEvent } from "@/hooks/useGameEvent";
import type {
  BossPatternWeights,
  CombatTelemetry,
  DeceptionResult,
  DirectorAnalysis,
  GamePhase,
  HudState,
  RoomId,
  RunResult,
  UpgradeDefinition,
} from "@/game/types/game";
import { theme } from "@/styles/theme";

import AnalysisPanel from "./ui/AnalysisPanel";
import DebugPanel from "./ui/DebugPanel";
import DeceptionPanel from "./ui/DeceptionPanel";
import ResultPanel from "./ui/ResultPanel";
import UpgradePanel from "./ui/UpgradePanel";

/**
 * React UI 레이어의 단일 진입점. (DEC-006)
 *
 * 이벤트 버스만 보고 어떤 패널을 띄울지 정한다. Phaser 객체를 직접 참조하지 않는다.
 * 패널이 하나만 뜨도록 여기서 배타적으로 관리한다. 두 개가 겹치면 입력이 이중으로 들어간다.
 */

type ActivePanel = "none" | "analysis" | "upgrade" | "deception" | "result";

const Layer = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;

  /* 패널과 버튼만 입력을 받는다. 그 외 영역의 클릭은 캔버스로 내려간다. */
  > * {
    pointer-events: auto;
  }
`;

const CombatHud = styled.div`
  position: absolute;
  top: ${theme.space(4)};
  left: ${theme.space(4)};
  z-index: ${theme.z.hud};
  display: flex;
  align-items: center;
  gap: ${theme.space(4)};
  font-family: ${theme.font.mono};
  font-size: 13px;
  color: ${theme.color.textMuted};
  pointer-events: none;
`;

const HealthBar = styled.div`
  width: 200px;
  height: 10px;
  border: 1px solid ${theme.color.border};
  border-radius: 999px;
  overflow: hidden;
`;

const HealthFill = styled.div<{ ratio: number }>`
  width: ${({ ratio }) => Math.max(0, Math.min(1, ratio)) * 100}%;
  height: 100%;
  background: ${({ ratio }) => (ratio > 0.3 ? theme.color.accent : theme.color.danger)};
  transition: width 0.2s ease;
`;

export default function HUDOverlay() {
  const [phase, setPhase] = useState<GamePhase>("BOOT");
  const [hud, setHud] = useState<HudState | null>(null);
  const [roomId, setRoomId] = useState<RoomId>("");
  const [telemetry, setTelemetry] = useState<CombatTelemetry | null>(null);
  const [analysis, setAnalysis] = useState<DirectorAnalysis | null>(null);
  const [choices, setChoices] = useState<UpgradeDefinition[]>([]);
  const [deception, setDeception] = useState<DeceptionResult | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);
  const [bossWeights, setBossWeights] = useState<BossPatternWeights>(DEFAULT_BOSS_WEIGHTS);
  const [activePanel, setActivePanel] = useState<ActivePanel>("none");
  const [debugVisible, setDebugVisible] = useState(false);

  useGameEvent("phase:change", ({ phase: next }) => setPhase(next));
  useGameEvent("hud:update", ({ hud: next }) => setHud(next));

  useGameEvent("room:start", ({ roomId: next }) => {
    setRoomId(next);
    setActivePanel("none");
  });

  useGameEvent("room:clear", ({ telemetry: next }) => setTelemetry(next));

  useGameEvent("analysis:ready", ({ analysis: next }) => {
    setAnalysis(next);
    setActivePanel("analysis");
  });

  useGameEvent("upgrade:offer", ({ choices: next }) => {
    setChoices(next);
    setActivePanel("upgrade");
  });

  useGameEvent("deception:result", ({ result: next }) => {
    setDeception(next);
    setActivePanel("deception");
  });

  useGameEvent("boss:weights", ({ weights }) => setBossWeights(weights));

  useGameEvent("run:result", ({ result: next }) => {
    setResult(next);
    setActivePanel("result");
  });

  // F1 디버그 토글. 브라우저 기본 도움말이 뜨지 않도록 막는다.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "F1") return;
      event.preventDefault();
      setDebugVisible((visible) => !visible);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const continueFromPanel = useCallback(() => {
    setActivePanel("none");
    emitGameEvent("ui:continue", {});
  }, []);

  const restartRun = useCallback(() => {
    setActivePanel("none");
    setHud(null);
    setRoomId("");
    setAnalysis(null);
    setTelemetry(null);
    setDeception(null);
    setResult(null);
    setBossWeights(DEFAULT_BOSS_WEIGHTS);
    emitGameEvent("run:restart", {});
  }, []);

  // 전투 중에만 HUD를 띄운다. 시작 화면과 결과 화면에 이전 런의 값이 남으면 안 된다.
  const inCombat = phase === "COMBAT" || phase === "BOSS";
  const showCombatHud = hud !== null && inCombat && activePanel === "none";

  return (
    <Layer>
      {showCombatHud && (
        <CombatHud>
          <HealthBar>
            <HealthFill ratio={hud.hp / hud.maxHp} />
          </HealthBar>
          <span>{hud.mode === "MELEE" ? "근거리" : "원거리"}</span>
          {phase === "BOSS" ? (
            <span>BOSS</span>
          ) : (
            <>
              <span>ROOM {hud.roomIndex}</span>
              <span>적 {hud.enemiesRemaining}</span>
            </>
          )}
        </CombatHud>
      )}

      {debugVisible && (
        <DebugPanel
          phase={phase}
          roomIndex={hud?.roomIndex ?? 0}
          roomId={roomId}
          telemetry={telemetry}
          analysis={analysis}
          bossWeights={bossWeights}
        />
      )}

      {activePanel === "analysis" && analysis && (
        <AnalysisPanel
          analysis={analysis}
          dashCount={telemetry?.dashCount ?? 0}
          onContinue={continueFromPanel}
        />
      )}

      {activePanel === "upgrade" && (
        <UpgradePanel
          choices={choices}
          onSelect={(upgradeId) => {
            setActivePanel("none");
            emitGameEvent("upgrade:select", { upgradeId });
          }}
        />
      )}

      {activePanel === "deception" && deception && (
        <DeceptionPanel result={deception} onContinue={continueFromPanel} />
      )}

      {activePanel === "result" && result && (
        <ResultPanel result={result} onRestart={restartRun} />
      )}
    </Layer>
  );
}
