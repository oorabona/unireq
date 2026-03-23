import { defineConfig } from "vitepress";

const enNav = [
  {
    text: "Guide",
    items: [
      { text: "Quick Start", link: "/guide/quick-start" },
      { text: "Architecture", link: "/guide/architecture" },
    ],
  },
  {
    text: "Tutorials",
    items: [
      { text: "Getting Started", link: "/tutorials/getting-started" },
      { text: "Advanced Usage", link: "/tutorials/advanced" },
    ],
  },
  {
    text: "Concepts",
    items: [
      { text: "Composition", link: "/concepts/composition" },
      { text: "HTTP Semantics", link: "/concepts/http-semantics" },
      { text: "Body Parsing", link: "/concepts/body-parsing" },
    ],
  },
  {
    text: "Packages",
    items: [
      { text: "Core", link: "/packages/core" },
      { text: "HTTP", link: "/packages/http" },
      { text: "OAuth", link: "/packages/oauth" },
      { text: "GraphQL", link: "/packages/graphql" },
      { text: "Cookies", link: "/packages/cookies" },
      { text: "All Packages", link: "/packages/core" },
    ],
  },
  {
    text: "Examples",
    items: [
      { text: "Basic HTTP", link: "/examples/basic" },
      { text: "Authentication", link: "/examples/auth" },
      { text: "Streaming", link: "/examples/streaming" },
      { text: "GraphQL", link: "/examples/graphql" },
      { text: "File Uploads", link: "/examples/uploads" },
      { text: "Retry & Backoff", link: "/examples/retry" },
      { text: "Validation", link: "/examples/validation" },
      { text: "SSE", link: "/examples/sse" },
    ],
  },
  {
    text: "GitHub",
    link: "https://github.com/oorabona/unireq",
  },
];

const frNav = [
  {
    text: "Guide",
    items: [
      { text: "Démarrage Rapide", link: "/fr/guide/quick-start" },
      { text: "Architecture", link: "/fr/guide/architecture" },
    ],
  },
  {
    text: "Tutoriels",
    items: [
      { text: "Premiers Pas", link: "/fr/tutorials/getting-started" },
      { text: "Usage Avancé", link: "/fr/tutorials/advanced" },
    ],
  },
  {
    text: "Concepts",
    items: [
      { text: "Composition", link: "/fr/concepts/composition" },
      { text: "Sémantique HTTP", link: "/fr/concepts/http-semantics" },
      { text: "Parsing du Body", link: "/fr/concepts/body-parsing" },
    ],
  },
  {
    text: "Packages",
    items: [
      { text: "Core", link: "/fr/packages/core" },
      { text: "HTTP", link: "/fr/packages/http" },
      { text: "OAuth", link: "/fr/packages/oauth" },
      { text: "GraphQL", link: "/fr/packages/graphql" },
      { text: "Cookies", link: "/fr/packages/cookies" },
      { text: "Tous les Packages", link: "/fr/packages/core" },
    ],
  },
  {
    text: "Exemples",
    items: [
      { text: "HTTP Basique", link: "/fr/examples/basic" },
      { text: "Authentification", link: "/fr/examples/auth" },
      { text: "Streaming", link: "/fr/examples/streaming" },
      { text: "GraphQL", link: "/fr/examples/graphql" },
      { text: "Upload de Fichiers", link: "/fr/examples/uploads" },
      { text: "Retry & Backoff", link: "/fr/examples/retry" },
      { text: "Validation", link: "/fr/examples/validation" },
      { text: "SSE", link: "/fr/examples/sse" },
    ],
  },
  {
    text: "GitHub",
    link: "https://github.com/oorabona/unireq",
  },
];

const enSidebar = [
  {
    text: "Introduction",
    items: [
      { text: "Overview", link: "/guide/overview" },
      { text: "Quick Start", link: "/guide/quick-start" },
      { text: "Cheat Sheet", link: "/guide/cheat-sheet" },
      { text: "Philosophy", link: "/concepts/philosophy" },
      { text: "Architecture", link: "/guide/architecture" },
      { text: "Core vs Builder", link: "/guide/core-vs-builder" },
      { text: "Comparison", link: "/guide/comparison" },
    ],
  },
  {
    text: "Tutorials",
    items: [
      { text: "Getting Started", link: "/tutorials/getting-started" },
      { text: "Advanced Usage", link: "/tutorials/advanced" },
    ],
  },
  {
    text: "Core Concepts",
    items: [
      { text: "Composition", link: "/concepts/composition" },
      { text: "Unified Protocols", link: "/concepts/unified-protocols" },
      { text: "Body & Parsing", link: "/concepts/body-parsing" },
      { text: "HTTP Semantics", link: "/concepts/http-semantics" },
    ],
  },
  {
    text: "Packages",
    items: [
      { text: "Core", link: "/packages/core" },
      { text: "HTTP", link: "/packages/http" },
      { text: "HTTP2", link: "/packages/http2" },
      { text: "OAuth", link: "/packages/oauth" },
      { text: "Cookies", link: "/packages/cookies" },
      { text: "XML", link: "/packages/xml" },
      { text: "GraphQL", link: "/packages/graphql" },
      { text: "IMAP", link: "/packages/imap" },
      { text: "SMTP", link: "/packages/smtp" },
      { text: "FTP", link: "/packages/ftp" },
      { text: "Presets", link: "/packages/presets" },
      { text: "OpenTelemetry", link: "/packages/otel" },
      { text: "Config", link: "/packages/config" },
    ],
  },
  {
    text: "Examples",
    items: [
      { text: "Basic Usage", link: "/examples/basic" },
      { text: "Authentication", link: "/examples/auth" },
      { text: "File Uploads", link: "/examples/uploads" },
      { text: "GraphQL", link: "/examples/graphql" },
      { text: "Interceptors", link: "/examples/interceptors" },
      { text: "HTTP Verbs", link: "/examples/http-verbs" },
      { text: "Streaming", link: "/examples/streaming" },
      { text: "Retry & Backoff", link: "/examples/retry" },
      { text: "Validation", link: "/examples/validation" },
      { text: "SSE", link: "/examples/sse" },
    ],
  },
  {
    text: "Guides",
    items: [
      { text: "Custom Connectors (BYOC)", link: "/guides/custom-connectors" },
      { text: "Testing with MSW", link: "/guides/testing" },
      { text: "Performance Tuning", link: "/guides/performance" },
      { text: "Migrate from axios", link: "/guides/migrate-axios" },
      { text: "Migrate from got", link: "/guides/migrate-got" },
      { text: "Migrate from ky", link: "/guides/migrate-ky" },
    ],
  },
  {
    text: "Project Info",
    items: [
      { text: "Contributing", link: "/contributing" },
      { text: "License", link: "/license" },
    ],
  },
];

const frSidebar = [
  {
    text: "Introduction",
    items: [
      { text: "Vue d'ensemble", link: "/fr/guide/overview" },
      { text: "Démarrage Rapide", link: "/fr/guide/quick-start" },
      { text: "Aide-mémoire", link: "/fr/guide/cheat-sheet" },
      { text: "Philosophie", link: "/fr/concepts/philosophy" },
      { text: "Architecture", link: "/fr/guide/architecture" },
      { text: "Core vs Builder", link: "/fr/guide/core-vs-builder" },
      { text: "Comparaison", link: "/fr/guide/comparison" },
    ],
  },
  {
    text: "Tutoriels",
    items: [
      { text: "Premiers Pas", link: "/fr/tutorials/getting-started" },
      { text: "Usage Avancé", link: "/fr/tutorials/advanced" },
    ],
  },
  {
    text: "Concepts Clés",
    items: [
      { text: "Composition", link: "/fr/concepts/composition" },
      { text: "Protocoles Unifiés", link: "/fr/concepts/unified-protocols" },
      { text: "Parsing du Body", link: "/fr/concepts/body-parsing" },
      { text: "Sémantique HTTP", link: "/fr/concepts/http-semantics" },
    ],
  },
  {
    text: "Packages",
    items: [
      { text: "Core", link: "/fr/packages/core" },
      { text: "HTTP", link: "/fr/packages/http" },
      { text: "HTTP2", link: "/fr/packages/http2" },
      { text: "OAuth", link: "/fr/packages/oauth" },
      { text: "Cookies", link: "/fr/packages/cookies" },
      { text: "XML", link: "/fr/packages/xml" },
      { text: "GraphQL", link: "/fr/packages/graphql" },
      { text: "IMAP", link: "/fr/packages/imap" },
      { text: "SMTP", link: "/fr/packages/smtp" },
      { text: "FTP", link: "/fr/packages/ftp" },
      { text: "Presets", link: "/fr/packages/presets" },
      { text: "OpenTelemetry", link: "/fr/packages/otel" },
      { text: "Config", link: "/fr/packages/config" },
    ],
  },
  {
    text: "Exemples",
    items: [
      { text: "Usage Basique", link: "/fr/examples/basic" },
      { text: "Authentification", link: "/fr/examples/auth" },
      { text: "Upload de Fichiers", link: "/fr/examples/uploads" },
      { text: "GraphQL", link: "/fr/examples/graphql" },
      { text: "Intercepteurs", link: "/fr/examples/interceptors" },
      { text: "Verbes HTTP", link: "/fr/examples/http-verbs" },
      { text: "Streaming", link: "/fr/examples/streaming" },
      { text: "Retry & Backoff", link: "/fr/examples/retry" },
      { text: "Validation", link: "/fr/examples/validation" },
      { text: "SSE", link: "/fr/examples/sse" },
    ],
  },
  {
    text: "Guides",
    items: [
      {
        text: "Connecteurs Personnalisés (BYOC)",
        link: "/fr/guides/custom-connectors",
      },
      { text: "Tests avec MSW", link: "/fr/guides/testing" },
      { text: "Optimisation Performance", link: "/fr/guides/performance" },
      { text: "Migrer depuis axios", link: "/fr/guides/migrate-axios" },
      { text: "Migrer depuis got", link: "/fr/guides/migrate-got" },
      { text: "Migrer depuis ky", link: "/fr/guides/migrate-ky" },
    ],
  },
  {
    text: "Info Projet",
    items: [
      { text: "Contribuer", link: "/fr/contributing" },
      { text: "Licence", link: "/fr/license" },
    ],
  },
];

export default defineConfig({
  title: "Unireq",
  description:
    "Pipe-first, tree-shakeable, multi-protocol I/O toolkit for Node.js",
  base: "/unireq/",

  locales: {
    root: {
      label: "English",
      lang: "en-US",
      themeConfig: {
        nav: enNav,
        sidebar: enSidebar,
      },
    },
    fr: {
      label: "Français",
      lang: "fr-FR",
      themeConfig: {
        nav: frNav,
        sidebar: frSidebar,
      },
    },
  },

  themeConfig: {
    logo: undefined,

    socialLinks: [
      { icon: "github", link: "https://github.com/oorabona/unireq" },
    ],

    search: {
      provider: "local",
    },

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2024-present Olivier Orabona",
    },
  },

  ignoreDeadLinks: true,

  srcExclude: [
    "plans/**",
    "_sidebar.md",
    "_navbar.md",
    "_coverpage.md",
    "_404.md",
    "fr/_sidebar.md",
    "fr/_navbar.md",
    "fr/_coverpage.md",
    "fr/_404.md",
    "style.css",
  ],

  markdown: {
    math: false,
  },
});
