import type { NextConfig } from 'next';

const isGhPages = process.env.GITHUB_PAGES === 'true';

const nextConfig: NextConfig = {
  output: isGhPages ? 'export' : undefined,
  basePath: isGhPages ? '/booksharev2' : undefined,
  trailingSlash: isGhPages,
  images: { unoptimized: true },
};

export default nextConfig;
