import type { MetadataRoute } from 'next';
import { TATTOO_LIBRARY } from '@/lib/tattoos';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://inkverse.studio';
  const now = new Date();
  const staticRoutes = ['', '/explore', '/studio', '/saved', '/about'].map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: path === '' ? 1 : 0.7,
  }));
  const designs = TATTOO_LIBRARY.map((design) => ({
    url: `${base}/tattoos/${design.slug}`,
    lastModified: now,
    changeFrequency: 'yearly' as const,
    priority: 0.5,
  }));
  return [...staticRoutes, ...designs];
}
