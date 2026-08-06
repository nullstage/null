import type { Metadata, Viewport } from "next";

import EmotionRegistry from "@/components/EmotionRegistry";

import "./globals.css";

export const metadata: Metadata = {
  title: "Project NULL",
  description: "플레이어의 전투 습관을 분석해 다음 방과 보스를 바꾸는 2D 액션 로그라이크",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#12151c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <EmotionRegistry>{children}</EmotionRegistry>
      </body>
    </html>
  );
}
