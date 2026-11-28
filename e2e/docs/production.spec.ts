import { APPS } from '../../playwright.config';
import { expect, test } from '../fixtures';

/** Production foundations (Milestone 21): headers, robots and the sitemap. */

const BASE = APPS.docs;

test('every page sends the security headers', async ({ request }) => {
  const response = await request.get(`${BASE}/`);
  expect(response.ok()).toBe(true);
  const headers = response.headers();
  expect(headers['content-security-policy']).toContain("default-src 'self'");
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['permissions-policy']).toContain('camera=()');
  expect(headers['strict-transport-security']).toContain('max-age=');
  expect(headers['x-frame-options']).toBe('DENY');
});

test('robots.txt allows the site and points at the sitemap', async ({ request }) => {
  const body = await (await request.get(`${BASE}/robots.txt`)).text();
  expect(body).toContain('User-Agent: *');
  expect(body).toContain('Allow: /');
  expect(body).toContain('/sitemap.xml');
});

test('the sitemap lists the public pages and every effect', async ({ request }) => {
  const body = await (await request.get(`${BASE}/sitemap.xml`)).text();
  expect(body).toContain('/effects/shatter');
  expect(body).toContain('/docs/getting-started');
  expect(body).toContain('/playground');
});
