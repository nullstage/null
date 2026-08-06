import gsap from "gsap";

/**
 * 번개처럼 순간적으로 내리꽂히는 세로 픽셀 글리치.
 *
 * 로딩 화면과 프롤로그가 같은 연출을 쓴다. 두 화면이 같은 세계의 일부로 보이게 하려는 것이다.
 * 배경색이 달라 색과 빈도만 호출 쪽에서 정한다.
 */

export interface GlitchOptions {
  /** 뽑아 쓸 색 목록. 배경이 밝으면 어두운 색, 어두우면 밝은 색을 넘긴다. */
  tints: string[];
  /** 다음 글리치까지 쉬는 시간(초). 이 구간이 없으면 계속 지직거려 눈이 아프다. */
  restMin: number;
  restMax: number;
  /** 줄기 길이(px). */
  lengthMin: number;
  lengthMax: number;
}

/**
 * 줄기 하나의 수명: 위에서 아래로 내리꽂히고 → 두 번 깜빡이고 → 사라진다.
 * 사라진 뒤에는 다른 자리에서 다시 친다. 위치·길이·굵기·색은 매 반복 새로 뽑는다.
 */
export const glitchBolt = (element: HTMLElement, options: GlitchOptions): gsap.core.Timeline =>
  gsap
    .timeline({ repeat: -1, repeatRefresh: true, delay: gsap.utils.random(0, options.restMax) })
    .set(element, {
      left: () => `${gsap.utils.random(2, 98)}%`,
      top: () => `${gsap.utils.random(0, 68)}%`,
      height: () => gsap.utils.random(options.lengthMin, options.lengthMax),
      width: () => gsap.utils.random(1, 3),
      backgroundColor: () => gsap.utils.random(options.tints),
      scaleY: 0,
      opacity: 1,
    })
    // 감속을 주면 번개보다 빗줄기처럼 보여서 등속으로 둔다.
    .to(element, { scaleY: 1, duration: 0.05, ease: "none" })
    .to(element, { opacity: 0.2, duration: 0.03 })
    .to(element, { opacity: 1, duration: 0.03 })
    .to(element, { opacity: 0, duration: 0.07 })
    .to({}, { duration: () => gsap.utils.random(options.restMin, options.restMax) });
