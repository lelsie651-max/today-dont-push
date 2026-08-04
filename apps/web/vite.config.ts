import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { createSceneLayoutDevPlugin } from './build/scene-layout-dev-plugin';

const webRoot = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = path.resolve(webRoot, '../..');

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    ...(command === 'serve'
      ? [
          createSceneLayoutDevPlugin({
            projectRoot,
          }),
        ]
      : []),
  ],
  server: {
    port: 5173,
    proxy: {
      '/v1': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
}));
