import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load env file from root (not apps/isekai-frontend)
  const env = loadEnv(mode, path.resolve(__dirname, '../../'), '');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // Map non-VITE_ vars to VITE_ vars
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || 'http://localhost:4000/api'),
      'import.meta.env.VITE_DEVIANTART_CLIENT_ID': JSON.stringify(env.DEVIANTART_CLIENT_ID || ''),
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true,
          cookieDomainRewrite: 'localhost',
          cookiePathRewrite: '/',
        },
      },
    },
  };
});
