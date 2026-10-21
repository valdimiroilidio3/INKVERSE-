import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import './globals.css';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { ToastProvider } from '@/components/ui/Toast';

export const metadata: Metadata = {
  metadataBase: new URL('https://inkverse.studio'),
  title: {
    default: 'INKVERSE® — 3D Tattoo Studio',
    template: '%s · INKVERSE®',
  },
  description:
    'Explore extraordinary tattoo art on a real 3D body. Rotate the character, select a zone and preview original designs on skin — in the INKVERSE digital studio.',
  keywords: ['tattoo', '3D tattoo', 'tattoo try-on', 'tattoo gallery', '3D studio', 'blackwork'],
  authors: [{ name: 'INKVERSE Studio' }],
  openGraph: {
    title: 'INKVERSE® — Your body. Your canvas.',
    description:
      'A premium 3D tattoo studio: explore original artwork and preview it on a real human mesh.',
    type: 'website',
    images: [{ url: '/editorial/hero-atlas.webp', width: 1240, height: 1620, alt: 'INKVERSE 3D tattoo studio' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'INKVERSE® — 3D Tattoo Studio',
    description: 'Original tattoo art, previewed on a real 3D body.',
    images: ['/editorial/hero-atlas.webp'],
  },
  icons: {
    icon: [{ url: '/brand/favicon.svg', type: 'image/svg+xml' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#080808',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-dvh bg-ink-900 text-paper antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:bg-acid focus:px-4 focus:py-2 focus:font-mono focus:text-xs focus:uppercase focus:tracking-widest focus:text-ink-950"
        >
          Skip to content
        </a>
        <ToastProvider>
          <Header />
          <div id="main">{children}</div>
          <Footer />
        </ToastProvider>
      </body>
    </html>
  );
}
