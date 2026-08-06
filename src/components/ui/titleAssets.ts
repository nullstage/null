import { assetPath } from "@/game/config/gameConfig";

/** 시작 화면 에셋. 로딩 화면이 미리 받아 두고, 시작 화면이 그대로 쓴다. */
export const TITLE_ASSETS = {
  background: assetPath("title/background.png"),
  logo: assetPath("title/title-logo.png"),
  subtitle: assetPath("title/subtitle.png"),
  ornament: assetPath("title/ornament.png"),
} as const;

export const TITLE_ASSET_LIST = Object.values(TITLE_ASSETS);
