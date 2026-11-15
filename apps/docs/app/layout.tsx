import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Newsreader } from 'next/font/google';
import type { ReactNode } from 'react';
import { ShatterLink } from 'shatter-router/next';
import { Header } from './header';
import { Providers } from './providers';
import './globals.css';

// One display typeface (also the text face) and one mono, self-hosted by
// next/font. Newsreader without its optical-size axis: every capture inlines
// the fonts into the picture, and the axis tripled their size (ADR-043).
// Only the roman face is preloaded: it sets every page's headline (the
// largest paint). The italic and the mono swap in when they arrive.
const display = Newsreader({
  subsets: ['latin'],
  style: 'normal',
  variable: '--font-display',
  display: 'swap',
});
const displayItalic = Newsreader({
  subsets: ['latin'],
  style: 'italic',
  variable: '--font-display-italic',
  display: 'swap',
  preload: false,
});
const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: { default: 'Shatter Router — break the page', template: '%s — Shatter Router' },
  description:
    'WebGL2 glass-shatter page transitions for single-page apps: vanilla, React, React Router and Next.js.',
};

export const viewport: Viewport = {
  themeColor: '#0a0b0d',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="en" className={`${display.variable} ${displayItalic.variable} ${mono.variable}`}>
      <body>
        <Providers>
          <a className="skip-link" href="#content">
            Skip to content
          </a>
          <Header />
          <main id="content" tabIndex={-1}>
            {children}
          </main>
          <footer className="site-footer">
            <p>
              MIT licensed. Made with WebGL2, Voronoi cells and a little gravity.{' '}
              <ShatterLink href="/docs/performance">Measured, not promised.</ShatterLink>
            </p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
