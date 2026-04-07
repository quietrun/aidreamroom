import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      unfetch: 'unfetch/dist/unfetch.js',
      '@': '/src/assets',
    },
  },
  server: {
    proxy: {
      '/main': {
        target: 'http://aidr.infinityplanet.world:8380',
        changeOrigin: true,
        rewrite: (path) => path.replace('/main', ''),
      },
    },
  },
});
