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
  // Per-page <meta> CSP: Astro hashes every inline script and style it emits, so
  // nothing else can run or style the page. Header-only directives such as
  // frame-ancestors live in public/_headers.
  // No Markdown here; Shiki's inline styles would also break the CSP.
  markdown: { syntaxHighlight: false },
  security: {
    csp: {
      algorithm: 'SHA-256',
      directives: [
        "default-src 'none'",
        "img-src 'self'",
        "font-src 'self'",
        // Homepage fetches today's /liturgy/<date>.json.
        "connect-src 'self'",
        "base-uri 'none'",
        "form-action 'none'",
        "upgrade-insecure-requests",
      ],
    },
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
