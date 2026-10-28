// Site-wide details.
export const SITE = {
  name: 'Okeat',
  /** the public address of the site once it's online, e.g. https://okeat.co.il */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? (process.env.NODE_ENV === 'production' ? 'https://okeat.vercel.app' : 'http://localhost:3000'),
  /** date the legal pages were last updated */
  updated: '27.10.2026',
};
