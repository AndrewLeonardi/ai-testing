import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  server: { port: parseInt(process.env.PORT) || 3000 },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        balance: resolve(__dirname, 'balance.html'),
      },
    },
  },
});
