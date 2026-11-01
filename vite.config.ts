import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' — чтобы сборка работала из любой папки (GitHub Pages, свой хостинг)
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173 },
});
