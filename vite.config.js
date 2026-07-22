import { defineConfig } from 'vite';

export default defineConfig({
  base: '/drone-aero-lab/',
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
