// @ts-check
// Docusaurus site configuration for the public reTS knowledge base + devblog.
// Static output; host-agnostic. Initial deploy target: GitHub Pages (project site).
const { themes } = require('prism-react-renderer');

const lightCodeTheme = themes.github;
const darkCodeTheme = themes.dracula;

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'reTS',
  tagline: 'An in-development, faithful reimplementation of the Command & Conquer TS/RA2 engine',
  favicon: 'img/favicon.ico',

  // Production URL + base path.
  // Custom domain (GitHub Pages, see static/CNAME): serves from the domain
  // root, so baseUrl is '/'. The old project-site form was
  // url 'https://dassheep.github.io' + baseUrl '/reTS/'.
  url: 'https://rets.dassheep.tech',
  baseUrl: '/',

  organizationName: 'DasSheep',
  projectName: 'reTS',
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  // Placeholder content is still landing; keep link checking non-fatal for now.
  onBrokenLinks: 'throw',

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  themes: [
    // Diagrams-as-code. Mermaid (dagre default; ELK opt-in per-diagram via
    // %%{init: {"flowchart": {"defaultRenderer": "elk"}}}%% for dense graphs).
    '@docusaurus/theme-mermaid',
    // Offline, zero-infra client-side search — indexed at build time (right
    // fit for a static GH-Pages site; no server, unlike Typesense/Algolia).
    // Covers BOTH docs instances (docs + reference), the devblog, and pages.
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        hashed: true,
        language: ['en'],
        indexDocs: true,
        indexBlog: true,
        indexPages: true,
        docsRouteBasePath: ['docs', 'reference'],
        docsDir: ['docs', 'reference'],
        blogRouteBasePath: 'devblog',
        blogDir: 'blog',
        highlightSearchTermsOnTargetPage: true,
      },
    ],
  ],

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/DasSheep/reTS/tree/main/website/',
        },
        blog: {
          path: 'blog',
          routeBasePath: 'devblog',
          blogTitle: 'reTS Devblog',
          blogDescription: 'The reverse-engineering to modernization journey.',
          blogSidebarTitle: 'Recent posts',
          showReadingTime: true,
          editUrl: 'https://github.com/DasSheep/reTS/tree/main/website/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
        // Google tag via gtag.js (@docusaurus/plugin-google-gtag). trackingID
        // is the "Google tag" GT- id — the newer unified destination that
        // routes to the GA4 property Google-side. It supersedes the raw GA4
        // measurement id (G-GXNXP7CS82): loading BOTH into gtag would
        // double-count the same property, so only the GT- tag is configured.
        gtag: {
          trackingID: 'GT-5NXSXLXK',
          anonymizeIP: true,
        },
        // Google Tag Manager container — fires whatever tags are set up in the
        // GTM UI. If GTM is also configured to send to the GA4 property the
        // gtag above reports to, hits double-count; keep GA4 on one path only.
        googleTagManager: {
          containerId: 'GTM-M7R3FJJD',
        },
        // SVG-as-React-component support (@docusaurus/plugin-svgr) is already
        // bundled and active via preset-classic since Docusaurus 3.6 — no
        // separate plugins[] entry needed (adding one would double-register).
      }),
    ],
  ],

  plugins: [
    // Separate "Original Engine Reference" docs instance — digital archaeology
    // of the original engine (documents the original game as-is, distinct from
    // reTS's own docs; the "Original" qualifier keeps it from being read as a
    // reference for reTS's engine, and leaves that name free for future
    // reTS-side architecture/contributor docs).
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'reference',
        path: 'reference',
        routeBasePath: 'reference',
        sidebarPath: require.resolve('./sidebarsReference.js'),
        editUrl: 'https://github.com/DasSheep/reTS/tree/main/website/',
      },
    ],
    // Responsive/lazy images: wrap with <Image> from '@theme/IdealImage'.
    // Inert for plain markdown images; active in production builds only.
    '@docusaurus/plugin-ideal-image',
    // "Copy page (as markdown)" button — lets readers hand a page straight to
    // an LLM. Auto-placed in the ToC rail (falls back to article top).
    'docusaurus-plugin-copy-page-button',
    // Emits /llms.txt (+ per-page markdown) so LLMs can crawl the docs.
    // NOTE: the maintained @signalwire fork — din0s/docusaurus-plugin-llms-txt
    // is a stale Dec-2024 build predating the Docusaurus 3.x plugin API.
    [
      '@signalwire/docusaurus-plugin-llms-txt',
      {
        siteTitle: 'reTS',
        siteDescription:
          'A faithful, clean-room reimplementation of the Command & Conquer TS/RA2 engine — docs, Engine Reference, and devblog.',
        content: {
          includeBlog: true,
          includePages: true,
          enableLlmsFullTxt: true,
        },
      },
    ],
    // Offline/installable PWA. Service worker + manifest; offline mode
    // activates per the strategies below (standalone/queryString/mobile).
    [
      '@docusaurus/plugin-pwa',
      {
        offlineModeActivationStrategies: ['appInstalled', 'standalone', 'queryString'],
        pwaHead: [
          { tagName: 'link', rel: 'manifest', href: '/manifest.json' },
          { tagName: 'meta', name: 'theme-color', content: '#2e8555' },
          { tagName: 'link', rel: 'apple-touch-icon', href: '/img/pwa-icon-192.png' },
          { tagName: 'meta', name: 'apple-mobile-web-app-capable', content: 'yes' },
          {
            tagName: 'meta',
            name: 'apple-mobile-web-app-status-bar-style',
            content: 'black-translucent',
          },
        ],
      },
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/social-card.png',
      mermaid: {
        theme: { light: 'neutral', dark: 'dark' },
      },
      colorMode: {
        defaultMode: 'dark',
        respectPrefersColorScheme: true,
      },
      navbar: {
        title: 'reTS',
        logo: {
          alt: 'reTS logo',
          src: 'img/brand/rets-wordmark-compact.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docsSidebar',
            position: 'left',
            label: 'Docs',
          },
          { to: '/docs/modders/overview', label: 'Modding', position: 'left' },
          {
            type: 'docSidebar',
            sidebarId: 'referenceSidebar',
            docsPluginId: 'reference',
            position: 'left',
            label: 'Original Engine Reference',
          },
          { to: '/devblog', label: 'Devblog', position: 'left' },
          {
            href: 'https://github.com/DasSheep/reTS',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Docs',
            items: [
              { label: 'Introduction', to: '/docs/intro' },
              { label: 'For players', to: '/docs/users/overview' },
              { label: 'For modders', to: '/docs/modders/overview' },
              { label: 'For contributors', to: '/docs/contributing/overview' },
            ],
          },
          {
            title: 'Project',
            items: [
              { label: 'Original Engine Reference', to: '/reference' },
              { label: 'Devblog', to: '/devblog' },
              { label: 'GitHub', href: 'https://github.com/DasSheep/reTS' },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} the reTS project. Licensing to be finalized before public release.`,
      },
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
        additionalLanguages: ['lua', 'toml', 'rust', 'ini', 'bash'],
      },
    }),
};

module.exports = config;
