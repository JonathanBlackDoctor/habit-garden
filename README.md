# 습관 정원 (Habit Garden)

습관 교정 중심 개인 전용 PWA. 매일 습관을 체크하고 회고하면 포인트가 쌓이고 정원의 식물이 자란다.

## 스택

- **Frontend**: Vite 5 + React 18 + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion
- **Backend**: Firebase (Firestore / Auth / Cloud Functions / Hosting)
- **AI**: Gemini 2.0 Flash (Cloud Functions 내부 호출)
- **PWA**: vite-plugin-pwa (standalone 풀스크린)

## 빠른 시작

### 1. 의존성 설치

```bash
# 웹앱
cd apps/web
npm install

# Cloud Functions
cd ../../functions
npm install
```

### 2. 환경변수 (apps/web/.env — 이미 작성됨)

Firebase 프로젝트: `planner-web-quick`

### 3. Functions Secret 설정 (최초 1회)

```bash
firebase functions:secrets:set GEMINI_API_KEY
# 프롬프트에 Gemini API 키 입력
```

### 4. 로컬 개발 (Firebase Emulator)

```bash
# 터미널 1 — functions 빌드
cd functions && npm run build:watch

# 터미널 2 — 에뮬레이터 시작
firebase emulators:start

# 터미널 3 — 웹앱 개발 서버
cd apps/web && npm run dev
```

### 5. 배포

```bash
deploy.bat
```

또는 수동으로:

```bash
cd apps/web && npm run build
cd ../../functions && npm run build
firebase deploy
```

## 첫 사용 방법

1. 앱 접속 → Google 로그인
2. **더보기 → 관리** 에서 "시드 습관 8개 추가" 버튼 클릭
3. 메인 화면에서 습관 체크 시작
4. **정원**에서 씨앗 심기 (첫 포인트 적립 후)

## 폴더 구조

```
habit-garden/
├─ apps/web/src/
│  ├─ features/{habits,garden}/   # 핵심 기능 hooks & 컴포넌트
│  ├─ routes/                      # 각 화면 (Main, Habits, Garden, ...)
│  ├─ components/{ui,TabBar,...}   # 공통 컴포넌트
│  └─ lib/{firebase,auth,store,dayBoundary,utils}.ts
├─ functions/src/
│  ├─ awardEngine.ts  — 포인트·배지 정산 (Firestore onWrite)
│  ├─ dailyReset.ts   — 04:00 KST 일일 초기화
│  ├─ feedback.ts     — Gemini AI 피드백 생성 (callable)
│  └─ backup.ts       — 월별 JSON 백업
├─ shared/types/firestore.ts       # 공통 TypeScript 타입
└─ docs/                           # 프로젝트 계획서·목업
```

## 포인트 경제

| 행동 | 적립 |
|------|------|
| 습관 달성 | 가중치 × 2P |
| 습관 만점(5점) | +5P 보너스 |
| 하루 회고 작성 | +20P |
| 성공한 날 | +30P |
| 스트릭 7/30/100일 | +50/+200/+500P |

| 소비 | 비용 |
|------|------|
| 씨앗 심기 | 50P |
| 물주기 | 20P |
| 식물 해금 | 200~500P |
