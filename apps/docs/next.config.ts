import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // The stylesheet is small: inline it so the first paint (and the
    // headline, the largest one) does not wait for a CSS request (Lighthouse:
    // render-blocking resources, est. 860 ms on mobile).
    inlineCss: true,
  },
};

export default config;
