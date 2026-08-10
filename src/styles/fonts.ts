import localFont from "next/font/local";

/*
 * 대화 본문 서체였던 ChosunKg(조선굵은고딕, Copyright(c) 2020 조선일보사)를 제거했다.
 * 조선일보 서체는 무료지만 "공식 배포처 이외에서의 배포 금지" 조건이 붙어 있고,
 * 이 프로젝트는 ttf를 번들해 GitHub Pages에서 직접 서빙하므로 그 조건에
 * 걸리는지가 불분명했다. 대화·시스템 UI는 이미 CDN으로 받는 Pretendard(OFL-1.1)로
 * 통일했다. 근거는 CREDITS.md 참조.
 */

/**
 * 보스 이름·지역명·아이템명 등 라벨 서체(대화·메인 타이틀은 제외). (사용자 결정)
 * `@kfonts/neodgm`(OFL-1.1, item4)에서 ttf만 내려받아 로컬로 둔다 — 도트 폰트라
 * `display: swap`을 켜면 전환 순간 다른 서체로 들쭉날쭉해 보여 대신 block으로 둔다.
 */
export const neoDunggeunmo = localFont({
  src: "../assets/fonts/NeoDunggeunmo.ttf",
  display: "block",
});
