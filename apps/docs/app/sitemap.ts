import type { MetadataRoute } from 'next';
import { EFFECTS } from '../lib/effects';
import { siteUrl } from '../lib/site';

/** Every public page of the site (SEO, Milestone 21). */
const PAGES = [
  '/',
  '/effects',
  '/playground',
  '/benchmark',
  '/docs/getting-started',
  '/docs/api',
  '/docs/custom-effects',
  '/docs/performance',
  '/docs/csp',
  '/docs/browser-support',
  '/docs/accessibility',
  '/docs/troubleshooting',
  '/docs/changelog',
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    ...PAGES.map((path) => ({ url: `${base}${path}` })),
    ...EFFECTS.map((effect) => ({ url: `${base}/effects/${effect.name}` })),
  ];
}
