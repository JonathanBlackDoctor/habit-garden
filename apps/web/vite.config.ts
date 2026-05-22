import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages project site is served from /<repo>/.
// Repo: JonathanBlackDoctor/habit-garden → https://jonathanblackdoctor.github.io/habit-garden/
//
// 모바일에 박혀 있던 옛 서비스워커가 새 번들을 못 받게 막아 빈 화면이 발생함.
// vite-plugin-pwa 의 `selfDestroying: true` 모드를 켜면, 동일 경로(/habit-garden/sw.js)에
// "모든 캐시 삭제 + self unregister" 만 하는 자폭 SW 가 배포됨.
// 옛 SW 가 이걸 install/activate 하는 순간 자기 자신과 모든 캐시가 제거되므로
// 두 번째 새로고침부터는 깨끗한 네트워크 상태로 동작함.
export default defineConfig({
  base: '/habit-garden/',
  plugins: [
    react(),
    VitePWA({
      selfDestroying: true,
      registerType: 'autoUpdate',
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'shared': path.resolve(__dirname, '../../shared'),
    },
  },
});
