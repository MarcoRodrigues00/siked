import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    port: 5173,
    // em dev, encaminha o WebSocket para o servidor do dashboard
    proxy: { '/ws': { target: 'ws://localhost:8080', ws: true } },
  },
});
