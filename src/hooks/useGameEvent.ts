"use client";

import { useEffect, useRef } from "react";

import { eventBus, type GameEventMap } from "@/game/EventBus";

/**
 * 이벤트 버스 구독을 React 생명주기에 묶는다.
 *
 * 핸들러를 ref에 담아두기 때문에 인라인 함수를 넘겨도 매 렌더마다
 * 구독이 해제·재등록되지 않는다.
 */
export const useGameEvent = <K extends keyof GameEventMap>(
  event: K,
  handler: (payload: GameEventMap[K]) => void,
): void => {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    return eventBus.on(event, (payload) => handlerRef.current(payload));
  }, [event]);
};

export const emitGameEvent = <K extends keyof GameEventMap>(
  event: K,
  payload: GameEventMap[K],
): void => eventBus.emit(event, payload);
