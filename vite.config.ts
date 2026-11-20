import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

function stripMissingSourceMaps(): Plugin {
  const sourceMapCommentRegex = /\/\/[#@]\s*sourceMappingURL=([^\s'"]+)/;
  const stripTrailingCommentRegex = /\r?\n?\/\/[#@]\s*sourceMappingURL=[^\s'"]+\s*$/;

  return {
    name: 'strip-missing-source-maps',
    enforce: 'pre',
    load(id) {
      const [filePath, query] = id.split('?');
      if (query && !/^(?:v=|t=|import(?:&|$))/.test(query)) return null;
      if (!filePath.includes('node_modules') || !/\.(?:m?js)$/.test(filePath)) return null;
      if (!fs.existsSync(filePath)) return null;

      const code = fs.readFileSync(filePath, 'utf-8');
      const match = code.match(sourceMapCommentRegex);
      if (!match || match[1].startsWith('data:')) return null;

      const mapPath = path.resolve(path.dirname(filePath), match[1]);
      if (fs.existsSync(mapPath)) return null;

      return code.replace(stripTrailingCommentRegex, '');
    },
    generateBundle(_options, bundle) {
      for (const item of Object.values(bundle)) {
        if (
          item.type === 'asset' &&
          /maplibre-gl-worker.*\.(?:m?js)$/.test(item.fileName)
        ) {
          const text =
            typeof item.source === 'string'
              ? item.source
              : Buffer.from(item.source).toString('utf-8');
          item.source = text.replace(stripTrailingCommentRegex, '');
        }
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [stripMissingSourceMaps(), react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'expo-glass-effect': path.resolve(__dirname, './src/lib/expo-glass-effect.tsx'),
      },
      dedupe: [
        'firebase',
        '@firebase/app',
        '@firebase/auth',
        '@firebase/firestore',
        '@firebase/component',
        '@firebase/util',
      ],
    },
    optimizeDeps: {
      include: [
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
      ],
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
              return 'vendor-react';
            }
            if (id.includes('node_modules/maplibre-gl')) {
              return 'vendor-maplibre';
            }
            if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
              return 'vendor-firebase';
            }
            if (id.includes('node_modules/@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) {
              return 'vendor-motion';
            }
          },
        },
      },
    },
  };
});
