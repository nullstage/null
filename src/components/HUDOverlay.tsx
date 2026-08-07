"use client";

import styled from "@emotion/styled";
import { useCallback, useEffect, useState } from "react";

import { loadKeyBindings } from "@/game/config/inputConfig";
import { DEFAULT_BOSS_WEIGHTS, STYLE_TITLE } from "@/game/data/directorRules";
import { FIXED_ROOM_SEQUENCE } from "@/game/data/rooms";
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
import DialogueBox from "./ui/DialogueBox";
import FirstVisitPrompt, { hasVisitedBefore } from "./ui/FirstVisitPrompt";
import LoadingScreen from "./ui/LoadingScreen";
import PauseMenu from "./ui/PauseMenu";
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

/**
 * 전투 HUD.
 *
 * 시작 화면과 같은 붉은 다크 판타지 톤을 쓴다. 둥근 모서리와 하늘색 강조는
 * 기본 테마에서 온 값이라 게임 화면과 따로 놀았다. 각지게 두고 색을 붉게 맞춘다.
 */
const CombatHud = styled.div`
  position: absolute;
  top: 22px;
  left: 26px;
  z-index: ${theme.z.hud};
  display: flex;
  flex-direction: column;
  gap: 9px;
  pointer-events: none;
`;

const HealthBar = styled.div`
  position: relative;
  width: 268px;
  height: 14px;
  /* 도트 화면이라 모서리를 깎지 않는다. 안쪽 그림자로 판 위에 얹힌 금속처럼 보이게 한다. */
  border: 1px solid rgba(200, 56, 60, 0.45);
  background: rgba(8, 6, 7, 0.72);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.6);
  overflow: hidden;
`;

/**
 * 줄어드는 체력을 뒤에서 늦게 따라오는 층.
 * 얼마나 깎였는지가 한 박자 남아 있어야 맞은 것이 눈에 들어온다.
 */
const HealthGhost = styled.div<{ ratio: number }>`
  position: absolute;
  inset: 0;
  width: ${({ ratio }) => Math.max(0, Math.min(1, ratio)) * 100}%;
  background: rgba(255, 255, 255, 0.28);
  transition: width 0.55s ease 0.12s;
`;

const HealthFill = styled.div<{ ratio: number }>`
  position: absolute;
  inset: 0;
  width: ${({ ratio }) => Math.max(0, Math.min(1, ratio)) * 100}%;
  background: ${({ ratio }) =>
    ratio > 0.3
      ? "linear-gradient(180deg, #e05055 0%, #a3242a 100%)"
      : "linear-gradient(180deg, #ff8a3d 0%, #c8383c 100%)"};
  transition: width 0.18s ease;
`;

/** 체력바 위를 지나는 눈금. 남은 칸 수를 셀 수 있어야 위험한 순간이 읽힌다. */
const HealthTicks = styled.div`
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(
    90deg,
    rgba(0, 0, 0, 0) 0 24px,
    rgba(0, 0, 0, 0.55) 24px 26px
  );
`;

const StatusRow = styled.div`
  display: flex;
  align-items: center;
  gap: 14px;
  font-family: ${theme.font.mono};
  font-size: 11px;
  letter-spacing: 0.14em;
  color: rgba(255, 255, 255, 0.5);
`;

/** 지금 무엇을 들고 있는지. 모드 전환이 핵심 조작이라 가장 눈에 띄어야 한다. */
const ModeTag = styled.span<{ mode: "MELEE" | "RANGED" }>`
  padding: 3px 10px;
  border-left: 2px solid ${({ mode }) => (mode === "MELEE" ? "#e05055" : "#9a5f86")};
  background: ${({ mode }) =>
    mode === "MELEE"
      ? "linear-gradient(90deg, rgba(224,80,85,0.3) 0%, rgba(224,80,85,0) 100%)"
      : "linear-gradient(90deg, rgba(154,95,134,0.32) 0%, rgba(154,95,134,0) 100%)"};
  font-family: ${theme.font.ui};
  font-weight: 300;
  font-size: 13px;
  letter-spacing: 0.1em;
  color: #fff;
`;

const HpText = styled.span`
  color: rgba(255, 255, 255, 0.72);
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
  /** Esc로 연 일시정지 메뉴. 열려 있는 동안 전투 씬은 멈춰 있다. */
  const [paused, setPaused] = useState(false);

  /**
   * 방 사이 로딩. 강화를 고른 순간 켜고, 다음 방이 시작되면(`roomReady`) 걷는다.
   * 두 값을 나눈 이유는 로딩 화면이 "떠 있는가"와 "걷혀도 되는가"가 다른 시점이기 때문이다.
   */
  const [roomLoading, setRoomLoading] = useState(false);

  /**
   * 방 1 진입 시 뜨는 기록자 대화창.
   * `CombatScene`이 방 1에서는 스스로를 멈춰 두므로, 여기서 열지 말지만 정하면 된다.
   * 이미 봤으면 열지 않고 곧바로 씬을 풀어 준다.
   */
  const [dialogueOpen, setDialogueOpen] = useState(false);
  const [roomReady, setRoomReady] = useState(false);

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

  /**
   * 개발 검증용 빠른 진입. `?fast=1`이면 로딩·시작 화면·프롤로그를 건너뛰고 곧장 전투로 간다.
   *
   * 전투 한 번 보려고 매번 인트로를 끝까지 앉아 있을 수는 없다.
   * 배포본에는 남기지 않는다. 플레이어가 도입부를 건너뛰는 길이 되면 안 된다.
   *
   * 켜 두면 일시정지의 나가기가 시작 화면에서 멈추지 않는다.
   * READY가 되는 즉시 다시 런을 시작하기 때문이다. 그 흐름은 fast 없이 확인해야 한다.
   */
  const [fastStart, setFastStart] = useState(false);

  useEffect(() => {
    // 정적 프리렌더에는 localStorage가 없다. 초기값으로 읽으면 하이드레이션이 어긋나므로
    // 마운트 뒤에 한 번 읽는다. (DEC-005 정적 내보내기)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNeedsFirstVisit(!hasVisitedBefore());
    setAudio(loadAudioSettings());
    if (process.env.NODE_ENV !== "production") {
      setFastStart(new URLSearchParams(window.location.search).has("fast"));
    }
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
    // 다음 방이 실제로 시작됐다. 이제 로딩을 걷어도 아래가 비지 않는다.
    setRoomReady(true);

    // 방 1은 씬이 스스로 멈춰 있다. 매번 새로 시작한 것처럼 대화창을 연다.
    // 재방문 여부를 저장해 갈랐던 적이 있는데, 그 분기가 실제 버그였다(위 컴포넌트 주석 참고).
    if (next === FIXED_ROOM_SEQUENCE[0]) setDialogueOpen(true);
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

  /**
   * Esc 일시정지. 여는 것도 닫는 것도 여기 한 곳에서만 처리한다.
   * PauseMenu가 따로 Esc를 들으면 한 번 눌러 연 즉시 닫힌다.
   *
   * 분석·강화 같은 패널이 떠 있을 때는 이미 게임이 멈춰 있으므로 받지 않는다.
   * 설정 창은 capture 단계에서 Esc를 가로채므로 여기까지 오지 않는다.
   */
  useEffect(() => {
    const pausable = phase === "COMBAT" || phase === "BOSS";
    if (!pausable || activePanel !== "none" || transition !== "none" || roomLoading || dialogueOpen)
      return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setPaused((open) => {
        emitGameEvent(open ? "game:resume" : "game:pause", {});
        return !open;
      });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activePanel, dialogueOpen, phase, roomLoading, transition]);

  /**
   * READY가 되면 바로 넘긴다.
   *
   * 한 박자 미루는 이유가 있다. phase는 BootScene이 먼저 READY로 바꾸고,
   * 그 입력을 받을 ReadyScene은 그다음 프레임에야 구독을 건다.
   * 즉시 쏘면 아무도 듣지 않아 검은 화면에서 멈춘다.
   */
  useEffect(() => {
    if (!fastStart || phase !== "READY") return;
    const timer = window.setTimeout(() => emitGameEvent("ui:continue", {}), 300);
    return () => window.clearTimeout(timer);
  }, [fastStart, phase]);

  // ScreenFade는 마운트 시점의 콜백을 그대로 쓰므로 참조가 흔들리면 안 된다.
  const markAssetsReady = useCallback(() => setAssetsReady(true), []);
  const hideLoading = useCallback(() => setLoadingVisible(false), []);
  const beginRun = useCallback(() => setTransition("cover"), []);
  const startPrologue = useCallback(() => setTransition("prologue"), []);
  const endTransition = useCallback(() => setTransition("none"), []);
  const hideRoomLoading = useCallback(() => setRoomLoading(false), []);
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

  /** 런 관련 화면 상태를 전부 비운다. 이전 런 값이 다음 화면에 남으면 안 된다. */
  const clearRunState = useCallback(() => {
    setActivePanel("none");
    setHud(null);
    setRoomId("");
    setAnalysis(null);
    setTelemetry(null);
    setDeception(null);
    setResult(null);
    setBossWeights(DEFAULT_BOSS_WEIGHTS);
    // 방 전환 도중에 죽거나 나가면 흰 로딩이 그대로 남는다.
    setRoomLoading(false);
    setRoomReady(false);
    setDialogueOpen(false);
  }, []);

  const restartRun = useCallback(() => {
    clearRunState();
    emitGameEvent("run:restart", {});
  }, [clearRunState]);

  const resumeGame = useCallback(() => {
    setPaused(false);
    emitGameEvent("game:resume", {});
  }, []);

  /** 나가기. 진행 중인 런을 버리고 시작 화면으로 되돌린다. */
  const exitToTitle = useCallback(() => {
    setPaused(false);
    clearRunState();
    setTransition("none");
    emitGameEvent("run:abort", {});
  }, [clearRunState]);

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
      {loadingVisible && !needsFirstVisit && !fastStart && (
        <LoadingScreen ready={phase !== "BOOT"} onReveal={markAssetsReady} onDone={hideLoading} />
      )}

      {!fastStart && assetsReady && phase === "READY" && (
        <TitleScreen onStart={beginRun} audio={audio} onAudioChange={changeAudio} />
      )}

      {transition !== "none" && <ScreenFade onCovered={enterRun} onDone={noop} />}

      {/*
        전환용 로딩. 커버 위에 뜨므로 검정에서 흰 로딩으로 바로 넘어간다.
        걷히기 시작할 때(onReveal) 프롤로그를 붙인다. 다 걷힌 뒤에 붙이면
        걷히는 0.6초 동안 아래의 전투 씬이 그대로 드러난다.
        로딩은 프롤로그 아래에서 페이드아웃을 마치고 함께 내려간다.
      */}
      {(transition === "load" || transition === "prologue") && (
        <LoadingScreen key="transition" ready onReveal={startPrologue} onDone={noop} />
      )}

      {transition === "prologue" && <PrologueText onDone={endTransition} />}

      {/*
        방 1 진입 시 뜨는 기록자 대화창. 씬은 이미 멈춰 있다(CombatScene 자체 일시정지).
        대화가 끝나야 씬을 풀어 준다. 재방문 여부는 기록하지 않는다 — 매번 새로 튼다.
      */}
      {dialogueOpen && (
        <DialogueBox
          onDone={() => {
            setDialogueOpen(false);
            emitGameEvent("game:resume", {});
          }}
        />
      )}

      {/*
        방 사이 로딩. 강화를 고른 순간부터 다음 방이 시작될 때까지 덮는다.
        직전 판정을 한 줄로 다시 보여 주는 자리이기도 하다.
        씬 재시작이 한 프레임에 끝나 화면이 툭 바뀌던 것을 이걸로 이어 준다.
      */}
      {roomLoading && (
        <LoadingScreen
          key="room"
          ready={roomReady}
          verdict={analysis ? STYLE_TITLE[analysis.style] : undefined}
          onReveal={noop}
          onDone={hideRoomLoading}
        />
      )}

      {showCombatHud && (
        <CombatHud>
          <HealthBar>
            {/* 흰 층이 먼저 남고 붉은 층이 앞서 줄어든다. 순서가 바뀌면 깎인 양이 안 보인다. */}
            <HealthGhost ratio={hud.hp / hud.maxHp} />
            <HealthFill ratio={hud.hp / hud.maxHp} />
            <HealthTicks />
          </HealthBar>

          <StatusRow>
            <ModeTag mode={hud.mode}>{hud.mode === "MELEE" ? "검" : "총"}</ModeTag>
            <HpText>
              {hud.hp} / {hud.maxHp}
            </HpText>
            {phase === "BOSS" ? (
              <span>BOSS</span>
            ) : (
              <>
                <span>ROOM {hud.roomIndex}</span>
                <span>남은 적 {hud.enemiesRemaining}</span>
              </>
            )}
          </StatusRow>
        </CombatHud>
      )}

      {paused && (
        <PauseMenu
          audio={audio}
          onAudioChange={changeAudio}
          onResume={resumeGame}
          onExit={exitToTitle}
        />
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
            // 로딩을 먼저 덮고 나서 방을 바꾼다. 순서가 반대면 바뀌는 장면이 그대로 보인다.
            setRoomReady(false);
            setRoomLoading(true);
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
