/**
 * 각인 저장·해금 로직. (데이터는 `data/engravings.ts`)
 *
 * localStorage에 남는 유일한 영구 성장이다 — 런 데이터는 메모리, 영구 해금만
 * 저장한다는 규칙(CLAUDE.md 배포 원칙)에 맞춘다.
 *
 * `RunState`를 import하지 않는다(효과를 읽는 쪽이 이 모듈을 import하므로 순환이 된다).
 * 조각 차감은 호출부(CombatScene)가 콜백으로 넘긴다.
 */

import {
  ENGRAVINGS,
  type EngravingDef,
  type EngravingId,
  type EngravingView,
} from "../data/engravings";

const STORAGE_KEY = "null:engravings";

/** ROOT는 서사상 처음부터 새겨져 있다 — 트리의 시작점이 비어 보이면 안 된다. */
const unlocked = new Set<EngravingId>(["ROOT"]);
let loaded = false;

const validIds = new Set<string>(ENGRAVINGS.map((def) => def.id));

const load = (): void => {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    for (const id of parsed) {
      // 저장 당시와 노드 목록이 달라졌을 수 있다. 아는 값만 받아들인다.
      if (typeof id === "string" && validIds.has(id)) unlocked.add(id as EngravingId);
    }
  } catch {
    // 값이 깨졌으면 기본(ROOT만)으로 시작한다.
  }
};

const persist = (): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...unlocked]));
  } catch {
    // 저장 실패해도 이번 세션의 해금은 유지된다.
  }
};

const defOf = (id: EngravingId): EngravingDef | undefined =>
  ENGRAVINGS.find((def) => def.id === id);

export const hasEngraving = (id: EngravingId): boolean => {
  load();
  return unlocked.has(id);
};

export const canUnlockEngraving = (id: EngravingId): boolean => {
  load();
  const def = defOf(id);
  if (!def || unlocked.has(id)) return false;
  return def.requires.every((required) => unlocked.has(required));
};

/**
 * 해금 시도. 선행 조건 검사 → 비용 차감(콜백) → 저장.
 * 차감 콜백이 false를 돌려주면(잔액 부족) 아무것도 바뀌지 않는다.
 */
export const unlockEngraving = (
  id: EngravingId,
  spendShards: (cost: number) => boolean,
): boolean => {
  if (!canUnlockEngraving(id)) return false;
  const def = defOf(id);
  if (!def || !spendShards(def.cost)) return false;
  unlocked.add(id);
  persist();
  return true;
};

/** 패널이 그릴 스냅샷. 매 호출 최신 상태를 다시 계산한다. */
export const engravingSnapshot = (): EngravingView[] =>
  ENGRAVINGS.map((def) => ({
    ...def,
    unlocked: hasEngraving(def.id),
    available: canUnlockEngraving(def.id),
  }));
