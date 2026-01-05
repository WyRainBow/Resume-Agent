/* eslint-disable import/no-extraneous-dependencies */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    fs: {
      allow: ['..'],
    },
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    preserveSymlinks: false,
  },
  optimizeDeps: {
    include: ['intersection-observer', 'clsx', 'dompurify'],
    force: true,
  },
  build: {
    outDir: '../dist/demo',
    rollupOptions: {
      output: {
        entryFileNames: `[name].js`,
        chunkFileNames: `[name].js`,
        assetFileNames: `[name].[ext]`,
      },
    },
  },
});
