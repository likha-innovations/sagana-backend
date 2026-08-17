import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

export default withMermaid(
  defineConfig({
    title: 'Sagana Backend',
    description: 'Architecture, System Logic, and Developer Documentation',
    base: '/',
    cleanUrls: true,
    ignoreDeadLinks: true,
    themeConfig: {
      logo: '/logo.svg',
      siteTitle: 'Sagana Backend Docs',
      nav: [
        { text: 'Overview', link: '/overview/system-architecture' },
        { text: 'Core Concepts', link: '/core-concepts/auth-lifecycle' },
        { text: 'Modules', link: '/modules/users' },
        { text: 'Database', link: '/database/schema-and-design' },
        { text: 'Dev Guide', link: '/development/getting-started' },
      ],
      sidebar: [
        {
          text: '📖 Overview & Architecture',
          collapsed: false,
          items: [
            {
              text: 'System Architecture',
              link: '/overview/system-architecture',
            },
            {
              text: 'Folder Structure Blueprint',
              link: '/overview/folder-structure',
            },
          ],
        },
        {
          text: '⚙️ Core Mechanics & Logic',
          collapsed: false,
          items: [
            {
              text: 'Authentication & Security Lifecycle',
              link: '/core-concepts/auth-lifecycle',
            },
            {
              text: 'Response & Error Handling Contract',
              link: '/core-concepts/response-and-errors',
            },
            {
              text: 'Logging & Environment Config',
              link: '/core-concepts/logging-and-config',
            },
          ],
        },
        {
          text: '📦 Business Modules',
          collapsed: false,
          items: [
            { text: 'Users & Profile Management', link: '/modules/users' },
            {
              text: 'Clerk Webhook Synchronization',
              link: '/modules/webhooks',
            },
          ],
        },
        {
          text: '🗄️ Database & Models',
          collapsed: false,
          items: [
            {
              text: 'PostgreSQL & Prisma 7 Schema',
              link: '/database/schema-and-design',
            },
          ],
        },
        {
          text: '🛠️ Developer Guide',
          collapsed: false,
          items: [
            {
              text: 'Getting Started & Testing',
              link: '/development/getting-started',
            },
          ],
        },
      ],
      search: {
        provider: 'local',
      },
      socialLinks: [{ icon: 'github', link: 'https://github.com' }],
      footer: {
        message: 'Sagana Backend System & Architecture Guide',
        copyright: 'Built with VitePress',
      },
    },
    markdown: {
      lineNumbers: true,
    },
    mermaid: {
      themeVariables: {
        fontSize: '13px',
      },
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
      },
    },
    vite: {
      optimizeDeps: {
        include: [
          'mermaid',
          'dayjs',
          '@braintree/sanitize-url',
          'debug',
          'cytoscape',
          'cytoscape-cose-bilkent',
        ],
      },
      ssr: {
        noExternal: ['mermaid', 'vitepress-plugin-mermaid', 'dayjs'],
      },
    },
  }),
);
