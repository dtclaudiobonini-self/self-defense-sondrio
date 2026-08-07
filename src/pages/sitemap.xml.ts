import type { APIRoute } from 'astro';

const routes = [
 { path: '/', priority: '1.0', changefreq: 'weekly' },
 { path: '/corsi/', priority: '0.9', changefreq: 'monthly' },
 { path: '/metodo/', priority: '0.8', changefreq: 'monthly' },
 { path: '/staff/', priority: '0.8', changefreq: 'monthly' },
 { path: '/associazione/', priority: '0.7', changefreq: 'monthly' },
 { path: '/news/', priority: '0.8', changefreq: 'weekly' },
 { path: '/faq/', priority: '0.7', changefreq: 'monthly' },
 { path: '/contatti/', priority: '0.8', changefreq: 'monthly' },
 { path: '/privacy/', priority: '0.2', changefreq: 'yearly' },
 { path: '/cookie-policy/', priority: '0.2', changefreq: 'yearly' }
];

export const GET: APIRoute = ({ site }) => {
 const baseUrl = site ?? new URL('https://selfdefensesondrio.it');
 const urls = routes
  .map(({ path, priority, changefreq }) => `  <url><loc>${new URL(path, baseUrl).href}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`)
  .join('\n');

 return new Response(
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  { headers: { 'Content-Type': 'application/xml; charset=utf-8' } }
 );
};
