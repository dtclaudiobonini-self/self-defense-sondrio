import type { APIRoute } from 'astro';

const routes = [
 '/',
 '/staff',
 '/corsi',
 '/metodo',
 '/associazione',
 '/news',
 '/faq',
 '/contatti',
 '/privacy',
 '/cookie-policy'
];

export const GET: APIRoute = ({ site }) => {
 const baseUrl = site ?? new URL('https://www.selfdefensesondrio.it');
 const urls = routes
  .map((route) => `  <url><loc>${new URL(route, baseUrl).href}</loc></url>`)
  .join('\n');

 return new Response(
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  { headers: { 'Content-Type': 'application/xml; charset=utf-8' } }
 );
};
