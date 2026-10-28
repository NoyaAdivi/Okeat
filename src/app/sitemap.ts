import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ['', '/map', '/about', '/accessibility', '/terms', '/privacy', '/contact'].map((path) => ({
    url: `${SITE.url}${path}`,
    lastModified: now,
    changeFrequency: path === '/map' ? 'daily' : 'monthly',
    priority: path === '' ? 1 : path === '/map' ? 0.9 : 0.5,
  }));
}
