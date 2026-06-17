# 습관 정원 (Habit Garden)

습관 교정 중심 소규모(가족·친구) 공유 PWA. 매일 습관을 체크하고 회고하면 포인트가 쌓이고 정원의 식물이 자란다.

신규 사용자는 구글 로그인 후 **승인 대기** 상태가 되며, owner가 `/admin`에서 승인해야 사용할 수 있다. 신앙 기능(경건·기도제목)은 owner 외엔 기본 OFF이며 더보기 → "신앙 기능" 토글로 켤 수 있다.

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

### Owner (초대 관리자)
1. 앱 접속 → Google 로그인 → 자동 승인됨
2. **더보기 → 관리(`/admin`)** 에서 "시드 습관 8개 추가" 버튼 클릭
3. 메인 화면에서 습관 체크 시작
4. **정원**에서 씨앗 심기 (첫 포인트 적립 후)

### 초대 사용자
1. 앱 접속 → Google 로그인 → "승인 대기 중" 화면
2. Owner가 `/admin`에서 승인 → 자동으로 메인 진입
3. 더보기 → "신앙 기능" 토글로 경건·기도 메뉴 활성화 가능 (기본 OFF)
4. **관리** 에서 본인 습관·기도제목 시드를 직접 추가하거나 처음부터 만들기

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

| 패널티 (매일 04:00 어제 정산) | 차감 |
|------|------|
| 미기록(방치) 습관 | 가중치 × 1P · 생기 −2 |
| 미달성(시도) 습관 | 위의 절반 |
| (하루 상한) | −40P · 생기 −12 |

> 건너뛰기·휴면·보호된 날(휴가/아픔/그레이스)은 패널티 제외. 사용 포인트만 차감하고 레벨·누적 XP는 보존(레벨 후퇴 없음). 모든 사용자에게 항상 적용된다.

## 주요 기능 메모

- **습관 묶음 · 일괄 건너뛰기**: 습관 편집에서 '학교' 같은 묶음을 만들어 습관을 배정하면, 습관 화면 상단에서 묶음 단위로 **오늘 일괄 건너뛰기/해제** 가능. 등교 안 하는 날 학교 습관을 한 번에 건너뛴다.
- **말씀 적용 추적** (신앙 탭): 큐티·주일설교·LGM·말씀묵상·기타에서 받은 *적용*(무엇을 실천할지)을 기록하고, 이후 며칠간 "오늘 실천했어요"를 체크해 실천 횟수·연속일을 추적한다. 목표일 달성 시 완료로 마무리(+20P). 하단 **신앙 탭 → 말씀 적용** 세그먼트(기도와 한 탭으로 통합). 승인 사용자는 정리한 노트를 붙여넣으면 AI가 본문·깨달은 말씀·여러 적용점·목표일을 정리해 골라 담을 수 있다.
  - **내 생활 환경(AI 개인화)**: 더보기 → "말씀 적용 — 내 생활 환경" 또는 AI 정리 화면 상단 배너에서 직업·가정·일과·자주 만나는 사람·요즘 영적 고민을 입력해두면, `parseApplication` AI가 이를 참고해 막연한 모범답안 대신 *내 삶에 와닿는 구체적 적용*을 추천한다. (`settings/main.lifeContext`, 본인만 열람)
  - **오래 방치된 적용 자동 보류**: 마지막 실천(없으면 시작일) 이후 `APPLICATION_STALE_DAYS`(기본 7일)를 넘도록 진행 중·목표 미달인 적용은 매일 04:00 `dailyReset`이 자동으로 `lapsed`(보류)로 내려 진행 목록이 무한정 쌓이지 않게 한다. 보류된 적용은 "완료·보관" 목록에 남아 "다시 진행"으로 언제든 되살릴 수 있다(기도제목 dormant 전이와 동일한 방식).
