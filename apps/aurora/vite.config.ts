import { reactRouter } from '@react-router/dev/vite';
import path from 'node:path';
import { defineConfig, PluginOption } from 'vite';
import { PloneRegistryVitePlugin } from '@plone/registry/vite-plugin';
import { PloneSVGRVitePlugin } from '@plone/components/vite-plugin-svgr';
import applyAddonViteConfiguration from './.plone/vite.loader';
import babel from 'vite-plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';
import devtoolsJson from 'vite-plugin-devtools-json';
import { reactRouterDevTools } from 'react-router-devtools';

export default defineConfig(({ command, mode, isSsrBuild }) => {
  const analyze = process.env.ANALYZE === 'true';
  const target = isSsrBuild ? 'server' : 'client';
  const statsDir = path.resolve(__dirname, 'build', 'stats');

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
    resolve: {
      tsconfigPaths: true,
    },
    optimizeDeps: {
      // fsevents is a macOS-only optional dependency pulled in transitively
      // by react-router-devtools' vite peer dep. On Linux the package.json's
      // os field keeps pnpm from building it, but the pre-bundled darwin
      // binary still ships and Vite's optimizer chokes trying to parse it.
      exclude: ['fsevents'],
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
