"use client";

import styled from "@emotion/styled";
import gsap from "gsap";
import localFont from "next/font/local";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { KEY_BINDINGS } from "@/game/config/inputConfig";
import { theme } from "@/styles/theme";

import { DIALOGUE_ASSETS } from "./dialogueAssets";

/** 대화 본문 전용 서체(정체, Regular). 다른 UI는 손대지 않는다 — 지금은 이 대화창 본문에만 쓴다. */
const chosunKg = localFont({
  src: "../../assets/fonts/ChosunKg.ttf",
  display: "swap",
});

/**
 * 기록자 대화창.
 *
 * 방 1(튜토리얼)에 처음 들어설 때 뜬다. 씬은 이미 멈춰 있다(`CombatScene`이 자기 자신을
 * 일시정지한다). 이 컴포넌트는 그 위에 뜨는 것만 책임지고, 재개는 `onDone`이 맡는다.
 *
 * 검은 화면을 또 까는 프롤로그와 달리 캐릭터가 서 있는 방을 그대로 보여 준다.
 * "깨어나 보니 여기더라"는 감각은 실제로 그 자리에 있어야 산다.
 *
 * 조작 안내는 하드코딩하지 않는다. `KEY_BINDINGS`를 그대로 읽어서,
 * 설정에서 키를 바꾼 사용자에게도 맞는 안내가 나온다.
 */

const TUTORIAL_SEEN_KEY = "null:tutorialSeen";

export const hasSeenTutorial = (): boolean => {
  try {
    return window.localStorage.getItem(TUTORIAL_SEEN_KEY) === "1";
  } catch {
    // 저장소를 못 읽으면 매번 보여준다. 안내가 빠지는 편보다 낫다.
    return false;
  }
};

export const markTutorialSeen = (): void => {
  try {
    window.localStorage.setItem(TUTORIAL_SEEN_KEY, "1");
  } catch {
    // 저장에 실패해도 이번 세션은 그대로 진행한다.
  }
};

/** 화자는 방 클리어 후 뜨는 그 목소리와 같다. (DEC-011 기록자 톤) */
const SPEAKER = "기록자";

const buildLines = (): string[] => [
  "눈을 뜨는가.",
  "여기는 NULL. 돌아오지 못한 자들의 시험장이다.",
  `${KEY_BINDINGS.MOVE_LEFT} / ${KEY_BINDINGS.MOVE_RIGHT}로 움직여라.`,
  `${KEY_BINDINGS.JUMP}로 뛰어넘어라.`,
  `${KEY_BINDINGS.DASH}로 몸을 피하라. 짧은 순간, 닿지 않는다.`,
  `${KEY_BINDINGS.ATTACK}로 벤다.`,
  `${KEY_BINDINGS.SWITCH_MODE}로 검과 총을 바꿔 쥔다. 나는 그 차이를 지켜본다.`,
  "이제, 움직여 보아라.",
];

/**
 * 한 글자가 찍히는 간격.
 * 가장 긴 줄(24자 안팎)도 0.2~0.3초 안에 다 찍히도록 잡는다. 튜토리얼은 줄이 많아서
 * 프롤로그만큼 느긋하게 두면 전체가 늘어진다.
 */
const PER_CHAR_SEC = 0.01;
const LINE_OUT_SEC = 0.15;
const LINE_GAP_SEC = 0.08;

const prefersReducedMotion = (): boolean =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const Screen = styled.div`
  position: absolute;
  inset: 0;
  z-index: ${theme.z.dialogue};
  cursor: pointer;
`;

/** 방은 그대로 보여야 한다. 대화창 자리만 아래에서 살짝 어두워진다. */
const Scrim = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(6, 5, 6, 0) 55%, rgba(6, 5, 6, 0.55) 100%);
  pointer-events: none;
`;

const Frame = styled.div`
  position: absolute;
  left: 50%;
  bottom: 6%;
  transform: translateX(-50%);
  width: min(760px, 88vw);
`;

const Box = styled.div`
  position: relative;
  /* 박스가 이름표보다 늦게 그려지면 겹치는 자리에서 이름표를 덮는다. 순서를 명시로 고정한다. */
  z-index: 1;
  width: 100%;
  aspect-ratio: 867 / 201;
  background: url(${DIALOGUE_ASSETS.box}) center / 100% 100% no-repeat;
  display: flex;
  align-items: flex-start;
  /*
   * 이름표가 겹치는 위쪽 구간을 비켜서, 본문이 그 아래 왼쪽에서 시작한다.
   * 세로 패딩(top/bottom)도 CSS 규칙상 %는 항상 "너비" 기준이다.
   * 이 박스는 높이가 너비의 23%뿐이라, 19%를 넣으면 실제로는 박스 높이의 80%를 먹어
   * 글자가 바닥까지 밀렸다. 이름표가 박스 안으로 들어오는 만큼(대략 박스 높이의 17%)만
   * 살짝 넘겨 7%로 잡는다.
   */
  padding: 6% 9% 0 7%;
`;

/** 이름표는 박스 왼쪽 위 모서리에 걸쳐 올라간다. 원본 그림(말풍선1)이 이렇게 겹쳐 있다. */
const Tag = styled.div`
  position: absolute;
  left: 4%;
  top: 0;
  z-index: 2;
  transform: translateY(-62%);
  /*
   * 원본이 180×54px뿐이라 크게 띄우면 확대 배율이 커져 흐려 보인다.
   * 원본 크기에 가깝게 눌러서 흐림을 줄인다.
   */
  width: 22%;
  aspect-ratio: 180 / 54;
  background: url(${DIALOGUE_ASSETS.tag}) center / 100% 100% no-repeat;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SpeakerName = styled.span`
  font-family: ${chosunKg.style.fontFamily};
  font-weight: 600;
  font-size: clamp(16px, 1.6vw, 22px);
  letter-spacing: 0.08em;
  color: #f2e4c6;
  user-select: none;
`;

const LineRow = styled.div`
  position: relative;
  width: 100%;
`;

const Line = styled.p`
  margin: 0;
  font-family: ${chosunKg.style.fontFamily};
  font-weight: 300;
  font-size: clamp(13px, 1.2vw, 18px);
  letter-spacing: 0.02em;
  line-height: 1.6;
  color: #f5ece0;
  user-select: none;
`;

/**
 * 다음을 기다린다는 신호. 프롤로그와 같은 모양을 써서 같은 체계로 읽히게 한다.
 * 글줄 옆이 아니라 박스 오른쪽 아래 모서리에 고정한다 — 줄 길이와 상관없이 늘 같은 자리다.
 */
const Caret = styled.span`
  position: absolute;
  right: 6%;
  bottom: 9%;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 7px solid rgba(200, 56, 60, 0.9);
  opacity: 0;
`;

export default function DialogueBox({ onDone }: { onDone: () => void }) {
  const lines = useMemo(() => buildLines(), []);

  const screenRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);

  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(0);

  const readyRef = useRef(false);
  const busyRef = useRef(false);
  const lineTweenRef = useRef<gsap.core.Tween | null>(null);
  const doneRef = useRef(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;

    gsap.killTweensOf([screenRef.current, caretRef.current, lineRef.current]);
    gsap.to(screenRef.current, {
      autoAlpha: 0,
      duration: prefersReducedMotion() ? 0 : 0.4,
      ease: "power2.out",
      onComplete: onDone,
    });
  }, [onDone]);

  const advance = useCallback(() => {
    if (doneRef.current || busyRef.current) return;

    // 아직 찍히는 중이면 그것부터 끝낸다. 두 번 눌러야 다음으로 가면 답답하다.
    if (!readyRef.current) {
      lineTweenRef.current?.progress(1);
      return;
    }

    const last = index >= lines.length - 1;
    busyRef.current = true;
    readyRef.current = false;
    gsap.killTweensOf(caretRef.current);

    const out = prefersReducedMotion() ? 0 : LINE_OUT_SEC;
    gsap
      .timeline({
        onComplete: () => {
          busyRef.current = false;
          if (last) finish();
          else setIndex((current) => current + 1);
        },
      })
      .to(caretRef.current, { autoAlpha: 0, duration: out * 0.4 }, 0)
      .to(lineRef.current, { autoAlpha: 0, duration: out, ease: "power1.in" }, 0)
      .to({}, { duration: prefersReducedMotion() ? 0 : LINE_GAP_SEC });
  }, [finish, index, lines.length]);

  useLayoutEffect(() => {
    gsap.set(screenRef.current, { autoAlpha: 1 });
  }, []);

  // 줄이 바뀔 때마다 한 글자씩 찍고, 다 찍히면 다음 신호(역삼각형)를 깜빡인다.
  useLayoutEffect(() => {
    if (!lineRef.current) return;

    readyRef.current = false;
    setTyped(0);
    gsap.killTweensOf(caretRef.current);
    gsap.set(caretRef.current, { autoAlpha: 0 });
    gsap.set(lineRef.current, { autoAlpha: 1 });

    const reduced = prefersReducedMotion();
    const text = lines[index];

    const markReady = () => {
      readyRef.current = true;
      if (reduced) {
        gsap.set(caretRef.current, { autoAlpha: 1 });
        return;
      }
      gsap.fromTo(
        caretRef.current,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.6, ease: "sine.inOut", repeat: -1, yoyo: true },
      );
    };

    const counter = { chars: 0 };
    let shown = 0;

    lineTweenRef.current = gsap.to(counter, {
      chars: text.length,
      duration: reduced ? 0 : text.length * PER_CHAR_SEC,
      ease: "none",
      onUpdate: () => {
        const next = Math.floor(counter.chars);
        if (next === shown) return;
        shown = next;
        setTyped(next);
      },
      onComplete: () => {
        setTyped(text.length);
        markReady();
      },
    });

    return () => {
      lineTweenRef.current?.kill();
    };
  }, [index, lines]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === " ") event.preventDefault();
      advance();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advance]);

  return (
    <Screen ref={screenRef} onPointerDown={advance}>
      <Scrim />
      <Frame>
        <Tag>
          <SpeakerName>{SPEAKER}</SpeakerName>
        </Tag>
        <Box>
          <LineRow>
            <Line ref={lineRef}>{lines[index].slice(0, typed)}</Line>
          </LineRow>
          <Caret ref={caretRef} />
        </Box>
      </Frame>
    </Screen>
  );
}
