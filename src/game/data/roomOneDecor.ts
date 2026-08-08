/**
 * (실험) 방 1(튜토리얼) 전용 배경 장식.
 *
 * 사용자가 준 참고 시트에서 잘라낸 조각들(`public/assets/decor/`) 중 일부를 골라
 * 고정 좌표에 배치한다. 충돌은 없다 — 순전히 눈에 보이는 장식이다.
 * 새 시트가 더 오면 이 배열에 항목만 추가하면 된다.
 */
export interface RoomOneDecorItem {
  /** 텍스처 키. BootScene이 이 값으로 로드한다. */
  key: string;
  /** `public/assets/` 기준 상대 경로. */
  path: string;
  /** 방 안 x좌표(바닥 기준 중앙 하단 정렬). */
  x: number;
  /** 1보다 작으면 축소, 크면 확대. */
  scale?: number;
}

export const ROOM_ONE_DECOR: RoomOneDecorItem[] = [
  { key: "decor_pillar_04", path: "decor/pillars/pillar_04.png", x: 220 },
  { key: "decor_arch_l1", path: "decor/arches/arch-large_01.png", x: 560, scale: 1.2 },
  { key: "decor_prop_09", path: "decor/arches/prop_09.png", x: 800 },
  { key: "decor_pillar_08", path: "decor/pillars/pillar_08.png", x: 1550 },
  { key: "decor_prop_10", path: "decor/arches/prop_10.png", x: 1720 },
  { key: "decor_arch_l3", path: "decor/arches/arch-large_03.png", x: 1900, scale: 1.2 },
  { key: "decor_pillar_14", path: "decor/pillars/pillar_14.png", x: 2080 },
  { key: "decor_gate_pillar", path: "decor/gate/piece-01.png", x: 2200 },
] as const;
