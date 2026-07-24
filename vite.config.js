import { defineConfig } from 'vite';

export default defineConfig({
  base: '/drone-aero-lab/',
  build: {
    // Three.js 核心是单一大模块；独立缓存，并按其实际体积设置合理告警线。
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules\/three/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
