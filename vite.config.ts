import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
);

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
  server: {
    watch: {
      ignored: ['**/release/**'],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (
            id.includes('@huggingface') ||
            id.includes('onnxruntime') ||
            id.includes('transformers')
          ) {
            return 'background-removal';
          }

          if (
            id.includes('jspdf') ||
            id.includes('html2canvas') ||
            id.includes('pdfjs') ||
            id.includes('pdf-lib')
          ) {
            return 'pdf-tools';
          }

          if (id.includes('react') || id.includes('react-dom')) {
            return 'react-vendor';
          }

          if (id.includes('lucide-react')) {
            return 'icons';
          }

          return 'vendor';
        },
      },
    },
  },
});
