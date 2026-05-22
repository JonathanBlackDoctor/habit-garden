import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// GitHub Pages project site is served from /<repo>/.
// Repo: JonathanBlackDoctor/habit-garden  →  https://jonathanblackdoctor.github.io/habit-garden/
//
// 주의: PWA(서비스워커)는 모바일에서 옛 캐시가 계속 살아남아 빈 화면을 유발하는 사례가
// 반복됐으므로 일시적으로 끕니다. main.tsx 에서 기존 SW/캐시는 강제 언레지스터합니다.
export default defineConfig({
  base: '/habit-garden/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'shared': path.resolve(__dirname, '../../shared'),
    },
  },
});
