"use client";

import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { useServerInsertedHTML } from "next/navigation";
import { useState, type ReactNode } from "react";

/**
 * Emotion 스타일을 프리렌더 HTML에 함께 심는다.
 *
 * 이게 없으면 정적 내보내기 결과물에는 스타일이 없고 클라이언트에서만 주입되므로
 * 하이드레이션 불일치(React #418)가 나고, 첫 프레임에 스타일 없는 화면이 스친다.
 * App Router에서는 `useServerInsertedHTML`이 유일한 주입 지점이다.
 */
export default function EmotionRegistry({ children }: { children: ReactNode }) {
  const [{ cache, flush }] = useState(() => {
    const cache = createCache({ key: "pnull" });
    cache.compat = true;

    const originalInsert = cache.insert;
    let inserted: string[] = [];

    cache.insert = (...args) => {
      const serialized = args[1];
      if (cache.inserted[serialized.name] === undefined) {
        inserted.push(serialized.name);
      }
      return originalInsert(...args);
    };

    const flush = () => {
      const names = inserted;
      inserted = [];
      return names;
    };

    return { cache, flush };
  });

  useServerInsertedHTML(() => {
    const names = flush();
    if (names.length === 0) return null;

    let styles = "";
    for (const name of names) {
      const rule = cache.inserted[name];
      if (typeof rule === "string") styles += rule;
    }

    return (
      <style
        data-emotion={`${cache.key} ${names.join(" ")}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    );
  });

  return <CacheProvider value={cache}>{children}</CacheProvider>;
}
