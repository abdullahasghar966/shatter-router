import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Martian_Mono } from 'next/font/google';
import type { ReactNode } from 'react';
import { ShatterLink } from 'shatter-router/next';
import { GlassScrollbar } from './glass-scrollbar';
import { Header } from './header';
import { Lab } from './lab';
import { Providers } from './providers';
import './globals.css';

// "Material lab" type (ADR-050): a grotesk for display and text, a technical
// mono for labels and readouts, self-hosted by next/font with the weight axis
// only (every capture inlines the fonts, ADR-043). Only the display face is
// preloaded: it sets every page's headline (the largest paint). A capture
// taken while the mono is still swapping in leaves it out too, so the copy
// shows the same fallback as the page (ADR-051).
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});
const mono = Martian_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  preload: false,
});

/**
 * Applies the remembered theme and material before the first paint, so the
 * page never flashes the default (ADR-050). Kept tiny and dependency-free.
 */
const THEME_SCRIPT = `(function(){try{var r=document.documentElement,t=localStorage.getItem('lab-theme'),m=localStorage.getItem('lab-material');if(t==='light'||t==='dark')r.setAttribute('data-theme',t);if(m==='glass'||m==='ice'||m==='obsidian'||m==='paper')r.setAttribute('data-material',m);}catch(e){}})();`;

export const metadata: Metadata = {
  title: { default: 'Shatter Router — break the page', template: '%s — Shatter Router' },
  description:
    'WebGL2 glass-shatter page transitions for single-page apps: vanilla, React, React Router and Next.js.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2eee5' },
    { media: '(prefers-color-scheme: dark)', color: '#11110f' },
  ],
  colorScheme: 'light dark',
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html
      lang="en"
      data-material="glass"
      className={`${display.variable} ${mono.variable}`}
      // The theme script sets attributes before React hydrates.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
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
            <p>MIT licensed · WebGL2, Voronoi cells and a little gravity</p>
            <p>
              <ShatterLink href="/docs/performance">Measured, not promised →</ShatterLink>
            </p>
          </footer>
          <GlassScrollbar />
          <Lab />
        </Providers>
      </body>
    </html>
  );
}
