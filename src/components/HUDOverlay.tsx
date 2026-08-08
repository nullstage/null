"use client";

import styled from "@emotion/styled";
import { useCallback, useEffect, useState } from "react";

import { assetPath, debugFlag } from "@/game/config/gameConfig";
import { loadKeyBindings } from "@/game/config/inputConfig";
import { DEFAULT_BOSS_WEIGHTS, STYLE_TITLE } from "@/game/data/directorRules";
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

/**
 * 제공받은 장식 프레임(체력ui.png → ui/hp-frame.png, 1479x320). 마젠타 배경과
 * 흰 게이지 창은 투명 처리했고, 창 위치는 원본에서 측정한 비율로 아래 HealthWindow가 잡는다.
 */
const HealthBar = styled.div`
  position: relative;
  width: 440px;
  aspect-ratio: 1479 / 320;

  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    image-rendering: pixelated;
    pointer-events: none;
  }
`;

/** 프레임의 게이지 창 영역. 원본 픽셀 좌표(394~1393, 96~158)를 비율로 환산한 값이다. */
const HealthWindow = styled.div`
  position: absolute;
  left: 26.64%;
  top: 30%;
  width: 67.61%;
  height: 19.69%;
  background: rgba(8, 6, 7, 0.78);
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

/**
 * 체력 게이지. 위 하이라이트 → 중간 본색 → 아래 어두운 그림자로 흐르는 세로
 * 그라데이션에 가로 광택을 겹쳐 금속 프레임과 톤을 맞춘다. 눈금은 프레임이
 * 장식적이라 오히려 지저분해 보여 없앴다(사용자 요청).
 */
const HealthFill = styled.div<{ ratio: number }>`
  position: absolute;
  inset: 0;
  width: ${({ ratio }) => Math.max(0, Math.min(1, ratio)) * 100}%;
  background: ${({ ratio }) =>
    ratio > 0.3
      ? `linear-gradient(180deg, #ff9297 0%, #e05055 28%, #a3242a 70%, #5e1216 100%)`
      : `linear-gradient(180deg, #ffc48a 0%, #ff8a3d 30%, #c8383c 72%, #6e1c14 100%)`};
  transition: width 0.18s ease;

  /* 게이지 표면을 지나는 은은한 광택 — 단색 띠보다 액체처럼 차 있어 보인다. */
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0.18) 45%,
      rgba(255, 255, 255, 0) 100%
    );
  }
`;

/** 사망·포기 직후의 검은 결과창. 일시정지 메뉴와 같은 톤(중앙 붉은 그라데이션)을 쓴다. */
const RespawnScreen = styled.div`
  position: absolute;
  inset: 0;
  z-index: ${theme.z.prompt};
  display: grid;
  place-items: center;
  background:
    radial-gradient(90% 70% at 50% 0%, rgba(112, 34, 35, 0.35) 0%, rgba(6, 5, 6, 0) 72%),
    rgba(3, 2, 3, 0.94);
`;

const RespawnPanel = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  font-family: ${theme.font.ui};
  color: #fff;

  h1 {
    margin: 0;
    font-weight: 200;
    font-size: 40px;
    letter-spacing: 0.3em;
    text-indent: 0.3em;
    color: #e05055;
  }

  dl {
    display: grid;
    grid-template-columns: auto auto;
    gap: 8px 22px;
    margin: 10px 0 0;
    font-weight: 300;
    font-size: 17px;
    letter-spacing: 0.06em;
  }

  dt {
    color: rgba(255, 255, 255, 0.55);
  }

  dd {
    margin: 0;
    text-align: right;
  }

  p {
    margin: 22px 0 0;
    font-family: ${theme.font.mono};
    font-size: 12px;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.4);
  }
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

  /** 사망·포기 직후 뜨는 이번 시도 요약. 닫으면 튜토리얼 부활이 이어진다. */
  const [respawnSummary, setRespawnSummary] = useState<{
    survivedMs: number;
    kills: number;
  } | null>(null);

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
    // `?boss=1`은 배포본에서도 켠다 — 심사·시연 때 보스전만 바로 보여줄 수 있어야 한다.
    // 어느 쪽이든 시작 화면과 프롤로그만 건너뛸 뿐, 밸런스에는 관여하지 않는다.
    if (process.env.NODE_ENV !== "production" || debugFlag("boss")) {
      setFastStart(debugFlag("fast") || debugFlag("boss"));
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
    emitGameEvent("audio:change", next);
  }, []);

  const confirmFirstVisit = useCallback(() => setNeedsFirstVisit(false), []);

  useGameEvent("phase:change", ({ phase: next }) => setPhase(next));
  useGameEvent("hud:update", ({ hud: next }) => setHud(next));

  useGameEvent("room:start", ({ roomId: next, showIntro }) => {
    setRoomId(next);
    setActivePanel("none");
    // 다음 방이 실제로 시작됐다. 이제 로딩을 걷어도 아래가 비지 않는다.
    setRoomReady(true);

    // 방 1 기록자 대화창. 새 런의 첫 진입에만 연다 — 사망·포기 복귀에는 씬도
    // 멈추지 않고(RunState.skipTutorialIntro) 대화창도 열지 않는다.
    if (showIntro) setDialogueOpen(true);
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

  useGameEvent("respawn:summary", (summary) => setRespawnSummary(summary));

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
    if (
      !pausable ||
      activePanel !== "none" ||
      transition !== "none" ||
      roomLoading ||
      dialogueOpen ||
      respawnSummary !== null
    )
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
  }, [activePanel, dialogueOpen, phase, respawnSummary, roomLoading, transition]);

  /** 사망 결과창. Enter로 닫으면 튜토리얼 부활이 이어진다. */
  const dismissRespawnSummary = useCallback(() => {
    setRespawnSummary(null);
    emitGameEvent("ui:continue", {});
  }, []);

  useEffect(() => {
    if (!respawnSummary) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      dismissRespawnSummary();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dismissRespawnSummary, respawnSummary]);

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

  /** 포기하기. 사망과 같은 흐름 — 런을 유지한 채 튜토리얼 마을로 되돌아간다. */
  const giveUpRun = useCallback(() => {
    setPaused(false);
    setActivePanel("none");
    // 메뉴가 씬을 멈춰 뒀다. 먼저 풀어야 전환 연출(트윈)이 돌아간다.
    emitGameEvent("game:resume", {});
    emitGameEvent("run:giveup", {});
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
            <HealthWindow>
              {/* 흰 층이 먼저 남고 붉은 층이 앞서 줄어든다. 순서가 바뀌면 깎인 양이 안 보인다. */}
              <HealthGhost ratio={hud.hp / hud.maxHp} />
              <HealthFill ratio={hud.hp / hud.maxHp} />
            </HealthWindow>
            {/* 정적 내보내기라 next/image 최적화가 안 붙는다. 픽셀아트 프레임 한 장이라 img로 충분하다. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetPath("ui/hp-frame.png")} alt="" />
          </HealthBar>

          <StatusRow>
            <ModeTag mode={hud.mode}>{hud.mode === "MELEE" ? "검" : "총"}</ModeTag>
            <HpText>
              {hud.hp} / {hud.maxHp}
            </HpText>
          </StatusRow>
        </CombatHud>
      )}

      {respawnSummary && (
        <RespawnScreen onPointerDown={dismissRespawnSummary}>
          <RespawnPanel>
            <h1>쓰러졌다</h1>
            <dl>
              <dt>생존 시간</dt>
              <dd>
                {Math.floor(respawnSummary.survivedMs / 60000)}분{" "}
                {Math.floor((respawnSummary.survivedMs % 60000) / 1000)}초
              </dd>
              <dt>처치한 적</dt>
              <dd>{respawnSummary.kills}</dd>
            </dl>
            <p>ENTER — 마을에서 다시 일어난다</p>
          </RespawnPanel>
        </RespawnScreen>
      )}

      {paused && (
        <PauseMenu
          audio={audio}
          onAudioChange={changeAudio}
          onResume={resumeGame}
          onGiveUp={giveUpRun}
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
