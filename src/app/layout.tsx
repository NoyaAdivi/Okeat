import type { Metadata, Viewport } from 'next';
import { Fredoka, Rubik } from 'next/font/google';
import A11yMenu from '@/components/A11yMenu';
import CookieNotice from '@/components/CookieNotice';
import { PREFS_BOOT_SCRIPT } from '@/lib/prefs';
import './globals.css';

// Fredoka: rounded display face that matches the scalloped logo. Rubik: readable Hebrew body.
const display = Fredoka({
  subsets: ['hebrew', 'latin'],
  weight: ['500', '600', '700'],
  variable: '--f-display',
  display: 'swap',
});

const ui = Rubik({
  subsets: ['hebrew', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--f-ui',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Okeat',
  description: 'מפה של מקומות כשרים, טבעוניים וללא גלוטן, שהקהילה מאשרת',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFF7F3' },
    { media: '(prefers-color-scheme: dark)', color: '#1D1729' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${ui.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        {/* apply saved theme / text size before the first paint */}
        <script dangerouslySetInnerHTML={{ __html: PREFS_BOOT_SCRIPT }} />
        {/* open connections early: map tiles and the database */}
        <link rel="preconnect" href="https://api.mapbox.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://events.mapbox.com" />
        {process.env.NEXT_PUBLIC_SUPABASE_URL && <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} crossOrigin="anonymous" />}
      </head>
      <body>
        <a href="#main" className="skip">דילוג לתוכן</a>
        {children}
        <A11yMenu />
        <CookieNotice />
      </body>
    </html>
  );
}
