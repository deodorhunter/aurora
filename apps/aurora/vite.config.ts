import { reactRouter } from '@react-router/dev/vite';
import path from 'node:path';
import { defineConfig, PluginOption } from 'vite';
import { PloneRegistryVitePlugin } from '@plone/registry/vite-plugin';
import { PloneSVGRVitePlugin } from '@plone/icons/vite-plugin-svgr';
import applyAddonViteConfiguration from './.plone/vite.loader.js';
import babel from 'vite-plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import devtoolsJson from 'vite-plugin-devtools-json';
import { reactRouterDevTools } from 'react-router-devtools';

export default defineConfig(({ command, mode, isSsrBuild }) => {
  const analyze = process.env.ANALYZE === 'true';
  const target = isSsrBuild ? 'server' : 'client';
  const statsDir = path.resolve(import.meta.dirname, 'build', 'stats');

  const baseConfig = {
    plugins: [
      // Source tagging (data-tsd-source) stamps each element with the file
      // path of its originating component. Some components are resolved
      // through pnpm-symlinked add-on packages, where the SSR and client
      // builds can resolve a shadowed/customized component's path
      // differently, mismatching the attribute and breaking hydration.
      reactRouterDevTools({
        tanstackViteConfig: {
          injectSource: { enabled: false },
          eventBusConfig: { enabled: false },
          // Console piping between client/server creates a feedback loop
          // here (each piped [Server] log gets re-captured and re-piped),
          // spamming the dev server log unboundedly.
          enhancedLogs: { enabled: false },
          consolePiping: { enabled: false },
        },
      }),
      PloneSVGRVitePlugin(),
      PloneRegistryVitePlugin(),
      tailwindcss(),
      reactRouter(),
      babel({
        include: /\.tsx?$/,
        exclude: /node_modules/,
        babelConfig: {
          presets: ['@babel/preset-typescript'],
          plugins: ['babel-plugin-react-compiler'],
        },
      }),
      devtoolsJson(),
      ...(analyze
        ? [
            visualizer({
              filename: path.join(statsDir, `stats-${target}.html`),
              template: 'treemap',
              gzipSize: true,
              brotliSize: true,
            }),
            visualizer({
              filename: path.join(statsDir, `stats-${target}.json`),
              template: 'raw-data',
              gzipSize: true,
              brotliSize: true,
            }),
          ]
        : []),
    ] as PluginOption[],
    optimizeDeps: {
      // Server-only deps that Vite would otherwise still pick up for the
      // client bundle — keep in sync with ssr.optimizeDeps.include below
      exclude: [
        'i18next-fs-backend',
        'i18next-fs-backend/cjs',
        'remix-i18next',
        // fsevents is a macOS-only optional dependency pulled in transitively
        // by react-router-devtools' vite peer dep. On Linux the package.json's
        // os field keeps pnpm from building it, but the pre-bundled darwin
        // binary still ships and Vite's optimizer chokes trying to parse it.
        'fsevents',
      ],
      include: [
        // App-level deps (in apps/aurora/package.json)
        'i18next',
        'i18next-browser-languagedetector',
        'i18next-http-backend',
        'react-i18next',
        // Injected by babel-plugin-react-compiler, not in any package.json
        'react/compiler-runtime',
        // @plone/components, @plone/icons, @plone/quanta and @plone/helpers are
        // not registered add-ons, so their deps can't be declared in
        // vite.extend.js — list them here
        '@plone/components > clsx',
        '@plone/components > react-aria',
        '@plone/components > react-aria-components',
        '@plone/components > react-aria-components/DropZone',
        '@plone/icons > @react-aria/utils',
        '@plone/icons > @react-spectrum/utils',
        '@plone/icons > clsx',
        '@plone/icons > tailwind-variants',
        '@plone/quanta > @internationalized/date',
        '@plone/quanta > @react-aria/utils',
        '@plone/quanta > clsx',
        '@plone/quanta > react-aria',
        '@plone/quanta > react-aria-components',
        '@plone/quanta > react-aria-components/DropZone',
        '@plone/quanta > react-aria-components/Form',
        '@plone/quanta > react-aria-components/Group',
        '@plone/quanta > react-aria-components/Modal',
        '@plone/quanta > react-aria-components/Table',
        '@plone/quanta > react-aria-components/Tooltip',
        '@plone/quanta > react-aria-components/composeRenderProps',
        '@plone/quanta > react-stately',
        '@plone/quanta > tailwind-merge',
        '@plone/quanta > tailwind-variants',
        '@plone/helpers > jotai',
        '@plone/helpers > jotai/utils',
        '@plone/helpers > jotai/vanilla',
        '@plone/helpers > jotai-optics',
      ],
    },
    ssr: {
      optimizeDeps: {
        include: ['i18next-fs-backend/cjs', 'isbot', 'remix-i18next'],
      },
    },
    resolve: {
      tsconfigPaths: true,
    },
    server: {
      port: 3000,
      fs: {
        // Allow serving files from one level up to the project root
        // (required by the Cookieplone setup)
        allow: ['../../../.'],
      },
    },
  };

  return applyAddonViteConfiguration(baseConfig, {
    command,
    mode,
    isSsrBuild,
  });
});
