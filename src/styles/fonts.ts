import localFont from "next/font/local";

/** 대화 본문 서체(정체, Regular). 대화창과 UI 모노스페이스 자리에서 함께 쓴다. */
export const chosunKg = localFont({
  src: "../assets/fonts/ChosunKg.ttf",
  display: "swap",
});

/**
 * 보스 이름·지역명·아이템명 등 라벨 서체(대화·메인 타이틀은 제외). (사용자 결정)
 * `@kfonts/neodgm`(OFL-1.1, item4)에서 ttf만 내려받아 로컬로 둔다 — 도트 폰트라
 * `display: swap`을 켜면 전환 순간 다른 서체로 들쭉날쭉해 보여 대신 block으로 둔다.
 */
export const neoDunggeunmo = localFont({
  src: "../assets/fonts/NeoDunggeunmo.ttf",
  display: "block",
});
