import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { anthropicProxy } from './server/vite-anthropic-proxy';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
  return {
    plugins: [react(), anthropicProxy()],
    resolve: {
      alias: { '@': path.resolve(__dirname, 'src') },
    },
  };
});
