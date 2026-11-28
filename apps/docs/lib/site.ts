/**
 * The site's public origin, for canonical URLs, the sitemap and Open Graph.
 * Set `SITE_URL` at build time (the production domain); the default is the
 * Vercel project's address, so builds without it still produce valid URLs.
 */
export function siteUrl(): string {
  const configured = process.env['SITE_URL'];
  return (
    configured && configured.length > 0 ? configured : 'https://shatter-router.vercel.app'
  ).replace(/\/$/, '');
}
