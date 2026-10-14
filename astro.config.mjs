// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

/** Latin font files from an installed @fontsource package (all Bible text is Latin-1). */
const variants = (pkg, list) =>
  list.map(([weight, style]) => ({
    src: [`@fontsource/${pkg}/files/${pkg}-latin-${weight}-${style}.woff2`],
    weight,
    style,
  }));

// https://astro.build/config
export default defineConfig({
  redirects: {
    '/bible': '/bible/webc/',
  },
  // Self-hosted from npm packages: no font CDN at build time or in the browser.
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Cormorant Garamond',
      cssVariable: '--font-display',
      fallbacks: ['Georgia', 'serif'],
      options: {
        variants: variants('cormorant-garamond', [
          [500, 'normal'],
          [600, 'normal'],
          [500, 'italic'],
        ]),
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Literata',
      cssVariable: '--font-text',
      fallbacks: ['Georgia', 'serif'],
      options: {
        variants: variants('literata', [
          [400, 'normal'],
          [600, 'normal'],
          [400, 'italic'],
        ]),
      },
    },
  ],
});
