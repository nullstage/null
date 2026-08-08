import { assetPath } from "@/game/config/gameConfig";

/** 대화창 프레임. 사용자가 그린 두 장을 조합해 쓴다(박스 + 이름표). */
export const DIALOGUE_ASSETS = {
  box: assetPath("dialogue/box.png"),
  tag: assetPath("dialogue/tag.png"),
} as const;
