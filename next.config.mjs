/**
 * GitHub Pages는 정적 호스팅이므로 Next.js를 정적 내보내기로 빌드한다. (DEC-005)
 * basePath는 저장소 하위 경로(`/null`)를 가리켜야 하며, 로컬 개발에서는 비운다.
 * CI에서 NEXT_PUBLIC_BASE_PATH=/null 을 주입한다.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  compiler: { emotion: true },
};

export default nextConfig;
