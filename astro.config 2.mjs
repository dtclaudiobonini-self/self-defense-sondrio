import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.difesapersonalesondrio.it',
  integrations: [sitemap()],
  output: 'static'
});
