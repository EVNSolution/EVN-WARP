import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  deploymentId: process.env.WARP_RELEASE_ID,
  generateBuildId: async () => process.env.WARP_RELEASE_ID ?? null,
  experimental: {
    proxyClientMaxBodySize: '50mb',
    // 뒤로가기로 돌아왔을 때 아코디언/펼침 등 클라이언트 상태가 유지되도록
    // 동적 페이지의 클라이언트 캐시 유지시간을 기본값(0초)보다 늘림
    staleTimes: {
      dynamic: 30,
    },
  },
};

export default nextConfig;
