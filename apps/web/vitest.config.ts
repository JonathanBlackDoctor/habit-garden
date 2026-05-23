import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      shared: path.resolve(__dirname, '../../shared'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', '../../shared/**/*.test.ts'],
  },
});
