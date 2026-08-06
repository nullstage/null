"use client";

import styled from "@emotion/styled";
import gsap from "gsap";
import { useLayoutEffect, useRef } from "react";

import { theme } from "@/styles/theme";

/**
 * 화면 전환용 검은 커버.
 *
 * 마운트되면 검게 덮고(`onCovered`에서 실제 전환을 시킨다) 다시 걷힌다.
 * 전환 시점을 여기 한 곳에 두어야 화면마다 페이드 길이가 제각각이 되지 않는다.
 */

const Cover = styled.div`
  position: absolute;
  inset: 0;
  z-index: ${theme.z.transition};
  background: #000;
  pointer-events: none;
`;

export default function ScreenFade({
  onCovered,
  onDone,
}: {
  /** 화면이 완전히 검어진 순간. 여기서 다음 화면으로 넘긴다. */
  onCovered: () => void;
  /** 커버가 다 걷힌 순간. 부모가 이 컴포넌트를 내리면 된다. */
  onDone: () => void;
}) {
  const coverRef = useRef<HTMLDivElement>(null);

  // 콜백은 첫 렌더의 것을 그대로 쓴다. 타임라인을 다시 만들면 전환이 중간에 끊긴다.
  useLayoutEffect(() => {
    const mm = gsap.matchMedia();

    mm.add(
      {
        motion: "(prefers-reduced-motion: no-preference)",
        reduced: "(prefers-reduced-motion: reduce)",
      },
      (context) => {
        const { reduced } = context.conditions as { motion: boolean; reduced: boolean };
        const scale = reduced ? 0 : 1;

        gsap
          .timeline()
          .set(coverRef.current, { autoAlpha: 0 })
          .to(coverRef.current, { autoAlpha: 1, duration: 0.45 * scale, ease: "power2.in" })
          .call(onCovered)
          .to(coverRef.current, {
            autoAlpha: 0,
            duration: 0.6 * scale,
            delay: 0.3 * scale,
            ease: "power2.out",
            onComplete: onDone,
          });
      },
    );

    return () => mm.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Cover ref={coverRef} />;
}
