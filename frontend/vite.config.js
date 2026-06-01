import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

import { loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env.REACT_APP_SERVER_BASE_URL': JSON.stringify(env.REACT_APP_SERVER_BASE_URL || 'http://localhost:5678'),
      'process.env.REACT_APP_SOCKET_URL': JSON.stringify(env.REACT_APP_SOCKET_URL || 'http://localhost:5678')
    },
  resolve: {
    alias: {
      '@features': path.resolve(__dirname, './src/features'),
      '@components': path.resolve(__dirname, './src/components'),
      '@pages': path.resolve(__dirname, './src/pages'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@services': path.resolve(__dirname, './src/services'),
      '@store': path.resolve(__dirname, './src/store'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@config': path.resolve(__dirname, './src/config'),
      '@helpers': path.resolve(__dirname, './src/helpers'),
      '@contexts': path.resolve(__dirname, './src/contexts'),
    },
    },
  };
});
