/**
 * HUD 전용 인라인 SVG 아이콘. (에셋 없이 코드로만 그린다)
 *
 * 전부 `currentColor`를 쓰므로 색은 부모(styled 슬롯)가 정한다 —
 * 준비/쿨다운 상태 색 전환이 CSS만으로 끝난다.
 */

const base = {
  viewBox: "0 0 24 24",
  width: 20,
  height: 20,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** 근접 모드 — 검. */
export const SwordIcon = () => (
  <svg {...base}>
    <path d="M19 3 21 5 11.5 14.5 9.5 12.5 Z" fill="currentColor" stroke="none" opacity={0.55} />
    <path d="M19 3 9.5 12.5" />
    <path d="M7 13 11 17" />
    <path d="M5.5 18.5 8 16" />
    <circle cx="4.5" cy="19.5" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);

/** 원거리 모드 — 총. */
export const GunIcon = () => (
  <svg {...base}>
    <path
      d="M3 9 H20 V12 H12 L10 17 H6.5 L8.5 12 H3 Z"
      fill="currentColor"
      stroke="none"
      opacity={0.85}
    />
    <path d="M20 10.5 H22" />
  </svg>
);

/** 그림자 조각. */
export const ShardIcon = () => (
  <svg {...base}>
    <path d="M12 3 18 12 12 21 6 12 Z" fill="currentColor" stroke="none" opacity={0.9} />
    <path d="M12 6.5 15.2 12 12 17.5 8.8 12 Z" fill="#fff" stroke="none" opacity={0.35} />
  </svg>
);

/** 재장전 — 도는 화살표. 회전 애니메이션은 부모가 건다. */
export const ReloadIcon = () => (
  <svg {...base}>
    <path d="M19.5 12 a7.5 7.5 0 1 1 -2.2 -5.3" />
    <path d="M19.8 3.6 V8 H15.4" />
  </svg>
);

/** 검기(Q) — 날아가는 초승달 참격. */
export const WaveIcon = () => (
  <svg {...base}>
    <path
      d="M8 3 a13 13 0 0 1 0 18 a9.5 9.5 0 0 0 0 -18 Z"
      fill="currentColor"
      stroke="none"
      opacity={0.85}
    />
    <path d="M14 7 19 7 M14 12 21 12 M14 17 19 17" strokeWidth={1.3} opacity={0.6} />
  </svg>
);

/** 검극(R) — 바닥에서 솟는 가시들. */
export const SpikeIcon = () => (
  <svg {...base}>
    <path d="M4 21 6.5 12 9 21 Z" fill="currentColor" stroke="none" opacity={0.7} />
    <path d="M9.5 21 12 5 14.5 21 Z" fill="currentColor" stroke="none" opacity={0.95} />
    <path d="M15 21 17.5 12 20 21 Z" fill="currentColor" stroke="none" opacity={0.7} />
    <path d="M3 21 H21" strokeWidth={1.4} opacity={0.6} />
  </svg>
);

/** 체력 계열 아티팩트. */
export const HeartIcon = () => (
  <svg {...base}>
    <path
      d="M12 20 C6 15 3.5 11.5 3.5 8.5 A4.2 4.2 0 0 1 12 6.5 A4.2 4.2 0 0 1 20.5 8.5 C20.5 11.5 18 15 12 20 Z"
      fill="currentColor"
      stroke="none"
      opacity={0.9}
    />
  </svg>
);

/** 기동 계열 아티팩트 — 잔상이 남는 대시. */
export const BootIcon = () => (
  <svg {...base}>
    <path d="M4 12 L14 12 M2.5 16 L11 16" opacity={0.45} strokeWidth={1.4} />
    <path
      d="M9 4 H14 V10 L20 13 V19 H8 V13 L9 10 Z"
      fill="currentColor"
      stroke="none"
      opacity={0.85}
    />
  </svg>
);

/** 검무(F) — 회전하는 칼바람. */
export const CycloneIcon = () => (
  <svg {...base}>
    <g fill="currentColor" stroke="none" opacity={0.85}>
      <path d="M12 12 12 3 17 8 Z" />
      <path d="M12 12 19.8 16.5 13 18.3 Z" />
      <path d="M12 12 4.2 16.5 6.2 9.7 Z" />
    </g>
    <circle cx="12" cy="12" r="2" fill="#fff" stroke="none" opacity={0.5} />
  </svg>
);
