import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Header } from './header';
import { Providers } from './providers';
import './style.css';

export const metadata: Metadata = {
  title: 'Home — Shatter Router Next.js example',
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="en">
      <head>
        <meta name="color-scheme" content="dark" />
      </head>
      <body>
        <Providers>
          <Header />
          <main id="app" tabIndex={-1}>
            {children}
          </main>
          <p className="fixed-note">position: fixed</p>
        </Providers>
      </body>
    </html>
  );
}
