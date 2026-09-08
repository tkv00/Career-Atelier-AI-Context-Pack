import type { NextConfig } from 'next';
import { resolve } from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 루트와 web에 잠금 파일이 모두 있어도 실제 앱 경계를 명시해 추론 경고를 없앤다.
  turbopack: { root: resolve(import.meta.dirname, '..') },
  experimental: { serverActions: { bodySizeLimit: '12mb' } },
};

export default nextConfig;
