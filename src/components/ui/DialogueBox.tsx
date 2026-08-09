"use client";

import styled from "@emotion/styled";
import gsap from "gsap";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { chosunKg } from "@/styles/fonts";
import { theme } from "@/styles/theme";

import { DIALOGUE_ASSETS } from "./dialogueAssets";

/**
 * 기록자 대화창.
 *
 * 방 1(튜토리얼)에 들어설 때마다 뜬다. 씬은 이미 멈춰 있다(`CombatScene`이 자기 자신을
 * 일시정지한다). 이 컴포넌트는 그 위에 뜨는 것만 책임지고, 재개는 `onDone`이 맡는다.
 *
 * 재방문 시 건너뛰는 로컬스토리지 기록은 두지 않는다. 그 분기가 실제로 버그였다 —
 * "이미 봤으면 곧바로 재개" 이벤트가 `CombatScene`의 자기 일시정지보다 먼저 도착해서
 * (씬이 아직 안 멈췄으니 재개는 허공에 날아가고) 그 뒤에 걸리는 일시정지만 남아
 * 씬이 영원히 멈추는 경우가 있었다. 매번 새 게임을 시작한 것처럼 보여주면 이 경합 자체가 없다.
 *
 * 검은 화면을 또 까는 프롤로그와 달리 캐릭터가 서 있는 방을 그대로 보여 준다.
 * "깨어나 보니 여기더라"는 감각은 실제로 그 자리에 있어야 산다.
 *
 * 조작 키를 나열하는 튜토리얼이 아니라 세계관을 여는 서사다(사용자 결정) —
 * 키 안내는 설정 화면의 조작 목록이 맡는다. 대사에는 키 이름을 넣지 않는다.
 */

/** 화자는 방 클리어 후 뜨는 그 목소리와 같다. (DEC-011 기록자 톤) */
const SPEAKER = "기록자";

const buildLines = (): string[] => [
  // 소울류 문법을 따른다 — 짧은 단문, 명사형 종결, 관찰자의 거리감, 마지막 줄의 낙차.
  "……또 하나가 눈을 떴군.",
  "이곳은 NULL. 이름을 잃은 것들이 마지막으로 흘러드는 곳이다.",
  "붉은 달 아래에서는 기억도, 몸도 오래 버티지 못한다.",
  "저 밖을 떠도는 것들도 처음부터 괴물이었던 것은 아니다.",
  "침식은 먼저 기억을 흐리고, 다음에는 이름을 지운다. ……너 역시 많은 것을 잊었겠지.",
  "놈들이 남기는 그림자 조각에는 지워지기 전의 기억이 조금 남아 있다. 필요하다면 거두어라.",
  "나는 이곳에서 지나간 자들을 기록한다.",
  "어떻게 싸웠는지. 무엇을 탐냈는지. 무엇을 두려워했는지.",
  "기록이 쌓이면 이곳도 너를 알게 된다.",
  "그리고 너를 알게 된 세계는, 더 이상 같은 시험을 내리지 않는다.",
  "그래도 앞으로 갈 생각이라면 문을 열어라.",
  "네 이름이 끝까지 남는지, 지켜보겠다.",
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

/** ESC를 꾹 누르는 동안 채워지는 스킵 게이지. 화면 왼쪽 위, 대화 상자와는 독립된 자리다. */
const SkipGauge = styled.div`
  position: absolute;
  top: 28px;
  left: 28px;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0;
  pointer-events: none;
`;

const SkipLabel = styled.span`
  font-family: ${chosunKg.style.fontFamily};
  font-size: clamp(11px, 1vw, 13px);
  letter-spacing: 0.06em;
  color: #f5ece0;
  user-select: none;
`;

const SKIP_RING_RADIUS = 15;
const SKIP_RING_CIRCUMFERENCE = 2 * Math.PI * SKIP_RING_RADIUS;
/** 다 채우는 데 걸리는 시간(초). 실수로 스치는 입력을 걸러낼 만큼은 있어야 한다. */
const SKIP_HOLD_SEC = 0.85;

export default function DialogueBox({ onDone }: { onDone: () => void }) {
  const lines = useMemo(() => buildLines(), []);

  const screenRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const skipGaugeRef = useRef<HTMLDivElement>(null);
  const skipRingRef = useRef<SVGCircleElement>(null);
  const skipTweenRef = useRef<gsap.core.Tween | null>(null);

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

  /** 게이지를 원래 자리로 되돌린다 — 중간에 손을 떼거나 대화가 이미 끝났을 때 쓴다. */
  const resetSkipGauge = useCallback(() => {
    skipTweenRef.current?.kill();
    skipTweenRef.current = null;
    gsap.to(skipGaugeRef.current, { autoAlpha: 0, duration: 0.2 });
    gsap.set(skipRingRef.current, { strokeDashoffset: SKIP_RING_CIRCUMFERENCE });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // ESC는 한 줄씩 넘기는 게 아니라 꾹 눌러 전체를 건너뛴다 — 다른 진행 방식이라
      // advance()가 아니라 별도의 홀드 게이지로 다룬다. 키 반복 이벤트는 무시한다.
      if (event.key === "Escape") {
        if (event.repeat || doneRef.current || skipTweenRef.current) return;
        gsap.to(skipGaugeRef.current, { autoAlpha: 1, duration: 0.15 });
        skipTweenRef.current = gsap.fromTo(
          skipRingRef.current,
          { strokeDashoffset: SKIP_RING_CIRCUMFERENCE },
          {
            strokeDashoffset: 0,
            duration: SKIP_HOLD_SEC,
            ease: "none",
            onComplete: () => {
              skipTweenRef.current = null;
              finish();
            },
          },
        );
        return;
      }

      if (event.key === " ") event.preventDefault();
      advance();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Escape") resetSkipGauge();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      skipTweenRef.current?.kill();
    };
  }, [advance, finish, resetSkipGauge]);

  return (
    <Screen ref={screenRef} onPointerDown={advance}>
      <Scrim />
      <SkipGauge ref={skipGaugeRef}>
        <svg width={36} height={36} viewBox="0 0 36 36">
          <circle cx={18} cy={18} r={SKIP_RING_RADIUS} fill="none" stroke="rgba(245,236,224,0.25)" strokeWidth={3} />
          <circle
            ref={skipRingRef}
            cx={18}
            cy={18}
            r={SKIP_RING_RADIUS}
            fill="none"
            stroke="#c8383c"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={SKIP_RING_CIRCUMFERENCE}
            strokeDashoffset={SKIP_RING_CIRCUMFERENCE}
            transform="rotate(-90 18 18)"
          />
        </svg>
        <SkipLabel>ESC 꾹 눌러 건너뛰기</SkipLabel>
      </SkipGauge>
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
