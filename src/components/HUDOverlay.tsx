"use client";

import styled from "@emotion/styled";
import { useCallback, useEffect, useState } from "react";

import { loadKeyBindings } from "@/game/config/inputConfig";
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
import FirstVisitPrompt, { hasVisitedBefore } from "./ui/FirstVisitPrompt";
import LoadingScreen from "./ui/LoadingScreen";
import PrologueText from "./ui/PrologueText";
import ResultPanel from "./ui/ResultPanel";
import ScreenFade from "./ui/ScreenFade";
import { setSfxVolume } from "./ui/sfx";
import {
  DEFAULT_AUDIO,
  loadAudioSettings,
  saveAudioSettings,
  type AudioSettings,
} from "./ui/settingsStore";
import TitleBgm from "./ui/TitleBgm";
import TitleScreen from "./ui/TitleScreen";
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

  /** 시작 화면 에셋 프리로드 완료 여부. 로딩 화면이 걷히기 시작할 때 켠다. */
  const [assetsReady, setAssetsReady] = useState(false);
  /** 로딩 화면 자체의 존재 여부. 다 걷힌 뒤에 내린다. */
  const [loadingVisible, setLoadingVisible] = useState(true);
  /**
   * 시작 화면 → 전투 전환 단계.
   * `cover`에서 검게 덮고, `load`에서 로딩 화면을, `prologue`에서 도입 문구를 보여 준 뒤 전투로 넘어간다.
   */
  const [transition, setTransition] = useState<"none" | "cover" | "load" | "prologue">("none");

  /**
   * 첫 방문 안내를 띄울지. 서버 렌더 결과와 어긋나지 않도록 마운트 후에 판단한다.
   * 안내가 떠 있는 동안에는 로딩을 끝내지 않는다. 버튼 클릭이 소리를 여는 입력이기 때문이다.
   */
  const [needsFirstVisit, setNeedsFirstVisit] = useState(false);
  const [audio, setAudio] = useState<AudioSettings>(DEFAULT_AUDIO);

  useEffect(() => {
    // 정적 프리렌더에는 localStorage가 없다. 초기값으로 읽으면 하이드레이션이 어긋나므로
    // 마운트 뒤에 한 번 읽는다. (DEC-005 정적 내보내기)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNeedsFirstVisit(!hasVisitedBefore());
    setAudio(loadAudioSettings());
    // 씬이 만들어지기 전에 바인딩을 올려둬야 첫 방부터 바뀐 키가 먹는다.
    loadKeyBindings();
  }, []);

  // 효과음은 컴포넌트 밖에서도 울리므로 모듈 쪽 음량을 따로 맞춰 둔다.
  useEffect(() => {
    setSfxVolume(audio.master * audio.sfx);
  }, [audio]);

  const changeAudio = useCallback((next: AudioSettings) => {
    setAudio(next);
    saveAudioSettings(next);
  }, []);

  const confirmFirstVisit = useCallback(() => setNeedsFirstVisit(false), []);

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

  // ScreenFade는 마운트 시점의 콜백을 그대로 쓰므로 참조가 흔들리면 안 된다.
  const markAssetsReady = useCallback(() => setAssetsReady(true), []);
  const hideLoading = useCallback(() => setLoadingVisible(false), []);
  const beginRun = useCallback(() => setTransition("cover"), []);
  const startPrologue = useCallback(() => setTransition("prologue"), []);
  const endTransition = useCallback(() => setTransition("none"), []);
  const noop = useCallback(() => {}, []);

  // 완전히 검어진 시점. 전투로 넘기고, 그 위에 로딩 화면을 띄운다.
  const enterRun = useCallback(() => {
    emitGameEvent("ui:continue", {});
    setTransition("load");
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

  // 로딩 화면에서 시작해 시작 화면까지 흐르고, 전투로 넘어가는 순간 꺼진다.
  // 첫 방문 안내가 떠 있는 동안은 어차피 브라우저가 소리를 막으므로 켜지 않는다.
  const titleBgmPlaying =
    !needsFirstVisit && (loadingVisible || (phase === "READY" && transition === "none"));

  return (
    <Layer>
      {/* 마스터는 다른 소리에도 곱해질 값이라 여기서 함께 반영한다. */}
      <TitleBgm playing={titleBgmPlaying} volume={audio.master * audio.bgm} />

      {needsFirstVisit && <FirstVisitPrompt onConfirm={confirmFirstVisit} />}

      {/* 첫 방문 안내가 먼저다. 뒤에서 로딩이 돌면 안내 화면이 지저분해진다. */}
      {loadingVisible && !needsFirstVisit && (
        <LoadingScreen ready={phase !== "BOOT"} onReveal={markAssetsReady} onDone={hideLoading} />
      )}

      {assetsReady && phase === "READY" && (
        <TitleScreen onStart={beginRun} audio={audio} onAudioChange={changeAudio} />
      )}

      {transition !== "none" && <ScreenFade onCovered={enterRun} onDone={noop} />}

      {/* 전환용 로딩. 커버 위에 뜨므로 검정에서 흰 로딩으로 바로 넘어간다. */}
      {transition === "load" && (
        <LoadingScreen key="transition" ready onReveal={noop} onDone={startPrologue} />
      )}

      {transition === "prologue" && <PrologueText onDone={endTransition} />}

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
