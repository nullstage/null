/** 화면과 런타임 설정. 수치를 씬 내부에 흩뿌리지 않는다. (CLAUDE.md 게임 수치 관리) */

/** OQ-003 미결정 — 내부 해상도 임시값. 결정되면 이 두 값만 바꾼다. */
export const VIEWPORT = {
  width: 1280,
  height: 720,
} as const;

/**
 * GitHub Pages 하위 경로 대응. (DEC-005)
 * Phaser 로더는 Next.js의 basePath를 모르므로 에셋 경로에 직접 붙여야 한다.
 */
export const ASSET_BASE = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/assets`;

export const assetPath = (relativePath: string): string =>
  `${ASSET_BASE}/${relativePath.replace(/^\//, "")}`;
