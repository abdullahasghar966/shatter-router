import type { NextConfig } from 'next';

/**
 * Security headers on every route (Milestone 21). The content security policy
 * allows what the site itself needs: Next.js hydration (inline scripts and
 * styles), the fonts it loads from Google Fonts, and the library's own chunks,
 * WebAssembly (Rapier) and the capture's `data:` and `blob:` images. The
 * library's requirements are on /docs/csp.
 */
const SECURITY_HEADERS = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  headers: () => Promise.resolve([{ source: '/:path*', headers: SECURITY_HEADERS }]),
  experimental: {
    // The stylesheet is small: inline it so the first paint (and the
    // headline, the largest one) does not wait for a CSS request (Lighthouse:
    // render-blocking resources, est. 860 ms on mobile).
    inlineCss: true,
  },
};

export default config;
