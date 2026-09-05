import { chromium } from 'playwright';  // 없으면: npm i -D playwright
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:5173/habit-garden/#';
const OUT = new URL('./screens', import.meta.url).pathname;
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const shots = [];
const log = (...a) => console.log(...a);

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  locale: 'ko-KR', timezoneId: 'Asia/Seoul', colorScheme: 'light',
  isMobile: true, hasTouch: true,
});
// Firestore IndexedDB 영속성 레이어가 헤들리스에서 INTERNAL ASSERTION 으로 죽고,
// 한 번 깨지면 그 오리진의 이후 모든 로드가 에러 화면이 된다.
// 앱은 enableIndexedDbPersistence 실패를 catch 하므로 IDB 를 막으면 메모리 캐시로 정상 동작한다.
// (Auth 는 browserLocalPersistence = localStorage 라 로그인 상태는 유지된다.)
await ctx.addInitScript(() => {
  try { Object.defineProperty(window, 'indexedDB', { get: () => undefined, configurable: true }); } catch {}
});

const page = await ctx.newPage();

async function snap(id, label, note = '') {
  if (await isBroken()) { log('  ✗ 건너뜀(에러 화면):', id); return; }
  await page.screenshot({ path: `${OUT}/${id}.png` });
  shots.push({ id, file: `${id}.png`, label, note });
  log('  ✓', id, '—', label);
}

const scrollPanel = (frac) => page.evaluate((f) => {
  const pick = () => {
    const active = document.querySelector('[data-active-panel]');
    const cands = [active, ...document.querySelectorAll('main, div')].filter(Boolean)
      .filter(e => e.scrollHeight > e.clientHeight + 24 && e.clientHeight > 200);
    return cands.sort((a, b) => b.clientHeight - a.clientHeight)[0] || null;
  };
  const el = pick();
  if (!el) return { moved: false, atEnd: true };
  const before = el.scrollTop;
  el.scrollTop = before + el.clientHeight * f;
  const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
  return { moved: el.scrollTop > before + 8, atEnd };
}, frac);

async function snapScroll(id, label, maxFrames = 4) {
  await snap(id, label);
  for (let i = 1; i < maxFrames; i++) {
    const { moved, atEnd } = await scrollPanel(0.85);
    if (!moved) break;
    await page.waitForTimeout(800);
    await snap(`${id}-${i + 1}`, `${label} — 이어서 ${i + 1}`);
    if (atEnd) break;
  }
}

const BROKEN = '화면을 표시하지 못했습니다';

async function isBroken() {
  return await page.evaluate(t => document.body.innerText.includes(t), BROKEN);
}

/** 전체 리로드로 이동한다. SPA 내 hash 전환은 Firestore SDK 언마운트 버그를 유발한다. */
async function go(hash, wait = 2600) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(BASE + hash, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(wait);
    if (!(await isBroken())) return true;
    log('  ↻ 에러 화면 — 재시도', hash);
    await page.waitForTimeout(1500);
  }
  log('  ✗ 계속 에러:', hash);
  return false;
}

async function dismissOverlays(rounds = 8) {
  for (let i = 0; i < rounds; i++) {
    const b = page.getByRole('button', { name: /^(다음|시작하기|시작|계속|완료|닫기|건너뛰기|넘기기|확인)$/ }).first();
    if (!(await b.count())) return;
    try { await b.click({ timeout: 2000 }); } catch { return; }
    await page.waitForTimeout(800);
  }
}

// ── 로그인 ────────────────────────────────────────────────
log('· 로그인');
await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);
await snap('01-login', '로그인', '구글 로그인 · 게스트 시작 · 인앱 브라우저 감지');

// ── 게스트 진입 → 온보딩 ──────────────────────────────────
log('· 게스트 진입 · 온보딩');
await page.getByText('가입 없이 바로 시작하기', { exact: false }).first().click({ timeout: 15000 });
await page.waitForTimeout(4500);
await snap('02-onboarding-welcome', '온보딩 — 웰컴 캐러셀', '첫 실행 시 자동 실행');
const nx = page.getByRole('button', { name: /^(다음|시작하기)$/ }).first();
if (await nx.count()) { try { await nx.click({ timeout: 2500 }); await page.waitForTimeout(1200); } catch {} }
await snap('03-onboarding-tour', '온보딩 — 스팟라이트 투어', 'data-tour 타깃을 하나씩 강조');
await dismissOverlays();
await page.waitForTimeout(1500);

// ── 탭 화면 (신앙 OFF · 탭 4개) ───────────────────────────
log('· 오늘');   await go('/');       await snapScroll('10-main',   '오늘 — 게스트 첫 진입 (탭 4개)', 5);
log('· 습관');   await go('/habits'); await snapScroll('11-habits', '습관 — 시간대별 0~5점 체크', 3);

// 습관 체크 인터랙션
log('· 습관 체크 인터랙션');
try {
  await page.getByRole('button', { name: '완료', exact: true }).first().click({ timeout: 4000 });
  await page.waitForTimeout(1800);
  await snap('11b-habit-checked', '습관 체크 직후 — 달성 상태 · 포인트 적립');
} catch (e) { log('  ! 체크 실패'); }

log('· 정원');   await go('/garden'); await snapScroll('12-garden', '정원 — 내 정원 · 상점 · 도감', 5);
log('· 정원 둘러보기'); await go('/garden?view=browse'); await snap('12c-garden-browse', '정원 — 둘러보기 (탭 재탭으로 토글)');

log('· 더보기'); await go('/more');   await snapScroll('13-more', '더보기', 4);

// ── 더보기 하위 화면 ──────────────────────────────────────
for (const [id, hash, label, frames] of [
  ['20-progress',   '/progress',  '진척 현황 — 레벨 · 배지 · 히트맵', 4],
  ['21-points',     '/points',    '포인트 내역 — 획득/사용 원장', 3],
  ['22-condition',  '/condition', '컨디션 — 슬라이더 · 수면 시각 다이얼', 3],
  ['23-planner',    '/planner',   '플래너 — 할 일 · 우선순위 · 장기 목표', 4],
  ['24-tutorial',   '/tutorial',  '사용 설명서 — 아코디언 규칙 설명', 4],
  ['25-reflection', '/reflection','회고 — 질문 답변 · 내일의 다짐', 3],
  ['26-notif',      '/settings/notifications', '알림 설정', 2],
]) { log('·', label); await go(hash); await snapScroll(id, label, frames); }

// ── 위젯 편집 모드 ────────────────────────────────────────
log('· 위젯 편집');
try {
  await go('/more');
  for (let i = 0; i < 12; i++) { const r = await scrollPanel(0.8); if (!r.moved) break; await page.waitForTimeout(250); }
  const weBtn = page.locator('button', { hasText: '오늘 탭 위젯 편집' }).first();
  await weBtn.scrollIntoViewIfNeeded({ timeout: 8000 });
  await weBtn.click({ timeout: 6000 });
  await page.waitForTimeout(2500);
  await snapScroll('27-widget-edit', '오늘 탭 위젯 편집 — 순서 변경 · 숨김', 3);
} catch (e) { log('  ! 위젯 편집 실패:', String(e).slice(0, 90)); }

// ── 신앙 기능 ON → 탭 5개 ────────────────────────────────
log('· 신앙 기능 ON');
try {
  await go('/more');
  for (let i = 0; i < 12; i++) { const r = await scrollPanel(0.8); if (!r.moved) break; await page.waitForTimeout(250); }
  await snap('30-more-settings', '더보기 — 설정 토글 (햅틱 · 사운드 · 신앙 기능)', '신앙 기능은 기본 OFF');
  const faithBtn = page.locator('button', { hasText: '신앙 기능' }).first();
  await faithBtn.scrollIntoViewIfNeeded({ timeout: 8000 });
  await faithBtn.click({ timeout: 6000 });
  await page.waitForTimeout(3000);
  await dismissOverlays();
  await go('/');
  await snap('31-tabs-five', '신앙 ON — 하단 탭이 5개가 된 상태');
  await go('/prayers');  await snapScroll('32-prayers', '신앙 — 기도제목 로테이션', 4);
  await go('/prayers?view=application'); await snapScroll('33-applications', '신앙 — 말씀 적용', 3);
  await go('/devotion');  await snap('34-devotion', '경건 · 감사 저널');
} catch (e) { log('  ! 신앙 캡처 실패:', String(e).slice(0, 110)); }

fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify({
  capturedAt: new Date().toISOString(),
  commit: process.env.CAPTURE_COMMIT || '',
  note: '개편 전(As-Is) 현행 디자인 스냅샷 · 게스트 계정 · 390x844 @2x · Firebase 에뮬레이터',
  shots,
}, null, 2));
log(`\n총 ${shots.length}장 → ${OUT}`);
await browser.close();
