/** 화면과 런타임 설정. 수치를 씬 내부에 흩뿌리지 않는다. (CLAUDE.md 게임 수치 관리) */

/** OQ-003 미결정 — 내부 해상도 임시값. 결정되면 이 두 값만 바꾼다. */
export const VIEWPORT = {
  width: 1280,
  height: 720,
} as const;

/**
 * 튜토리얼 방(방 1)만 카메라 스크롤을 테스트하려고 화면보다 넓게 잡은 임시값. (OQ-029)
 * 다른 방은 여전히 `VIEWPORT.width`와 같아 카메라가 움직이지 않는다.
 */
export const TUTORIAL_ROOM_WIDTH = VIEWPORT.width * 2;

/**
 * GitHub Pages 하위 경로 대응. (DEC-005)
 * Phaser 로더는 Next.js의 basePath를 모르므로 에셋 경로에 직접 붙여야 한다.
 */
export const ASSET_BASE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/assets`;

export const assetPath = (relativePath: string): string =>
  `${ASSET_BASE}/${relativePath.replace(/^\//, "")}`;

/**
 * 개발·시연용 URL 플래그. `?fast=1`, `?boss=1`처럼 쓴다.
 *
 * 배포본에서도 주소만 알면 켤 수 있으므로, 흐름을 건너뛰는 용도로만 쓰고
 * 밸런스나 판정에는 절대 연결하지 않는다. 서버 렌더 시에는 항상 false다.
 */
export const debugFlag = (name: string): boolean =>
  typeof window !== "undefined" && new URLSearchParams(window.location.search).has(name);
