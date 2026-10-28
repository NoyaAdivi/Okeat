import type { MetadataRoute } from 'next';

// Lets people add Okeat to their phone's home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Okeat',
    short_name: 'Okeat',
    description: 'מפה של מקומות כשרים, טבעוניים וללא גלוטן, שהקהילה מאשרת',
    start_url: '/map',
    display: 'standalone',
    background_color: '#FFF7F3',
    theme_color: '#FFB4A2',
    lang: 'he',
    dir: 'rtl',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
