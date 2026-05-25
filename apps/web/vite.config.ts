import fs from 'fs';
import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const FCM_SW = 'firebase-messaging-sw.js';
const FCM_CONFIG_TOKEN = '__FIREBASE_MESSAGING_CONFIG__';
// public/ 에 두면 Vite 가 토큰 미치환 원본을 dist 로 복사해 덮어쓰므로 sw/ 에 둔다.
const FCM_SW_SRC = path.resolve(__dirname, 'sw', FCM_SW);

// firebase-messaging-sw.js 는 정적 파일이라 import.meta.env 가 주입되지 않는다.
// 빌드(emit)와 dev(미들웨어) 양쪽에서 플레이스홀더를 실제 config JSON 으로 치환한다.
// (Firebase 웹 config 는 공개값 — 클라이언트 번들에도 이미 포함되어 있다.)
function fcmSwConfig(env: Record<string, string>): Plugin {
  const json = JSON.stringify({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });
  const render = () => fs.readFileSync(FCM_SW_SRC, 'utf8').replaceAll(FCM_CONFIG_TOKEN, json);
  return {
    name: 'fcm-sw-config',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.split('?')[0].endsWith(FCM_SW)) {
          res.setHeader('Content-Type', 'application/javascript');
          res.end(render());
          return;
        }
        next();
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: FCM_SW, source: render() });
    },
  };
}

// GitHub Pages project site is served from /<repo>/.
// Repo: JonathanBlackDoctor/habit-garden → https://jonathanblackdoctor.github.io/habit-garden/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, 'VITE_');
  return {
  base: '/habit-garden/',
  plugins: [
    react(),
    fcmSwConfig(env),
    VitePWA({
      registerType: 'autoUpdate',
      // 자동 등록 비활성화: vite-plugin-pwa 의 Workbox SW 가 main.tsx 가 등록하는
      // firebase-messaging-sw.js 와 같은 스코프(/habit-garden/)에서 충돌하지 않도록.
      // 푸시 핸들러가 있는 firebase-messaging-sw.js 가 단독으로 스코프를 제어한다.
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: '습관 정원 (Habit Garden)',
        short_name: '습관정원',
        description: '함께하는 습관 체크와 정원 가꾸기',
        start_url: '/habit-garden/',
        scope: '/habit-garden/',
        display: 'standalone',
        theme_color: '#F4F6EE',
        background_color: '#F4F6EE',
        lang: 'ko',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/habit-garden/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'shared': path.resolve(__dirname, '../../shared'),
    },
  },
  };
});
