# 습관 정원 (Habit Garden)

습관 교정 중심 소규모(가족·친구) 공유 PWA. 매일 습관을 체크하고 회고하며, 스트릭·히트맵·AI 코치로 꾸준함을 추적한다.

신규 사용자는 구글 로그인 후 **승인 대기** 상태가 되며, owner가 `/admin`에서 승인해야 사용할 수 있다. 신앙 기능(경건·기도제목)은 owner 외엔 기본 OFF이며 더보기 → "신앙 기능" 토글로 켤 수 있다.

## 스택

- **Frontend**: Vite 5 + React 18 + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion
- **Backend**: Firebase (Firestore / Auth / Cloud Functions / Hosting)
- **AI**: Gemini 2.0 Flash (Cloud Functions 내부 호출)
- **PWA**: vite-plugin-pwa (standalone 풀스크린)
- **텔레그램 봇**: Cloud Functions HTTPS 웹훅 (앱 접속 없이 습관 체크·회고·코치)

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

# 텔레그램 봇을 쓸 경우 (아래 '텔레그램 봇' 절 참고)
firebase functions:secrets:set TELEGRAM_BOT_TOKEN
firebase functions:secrets:set TELEGRAM_WEBHOOK_SECRET
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

### 초대 사용자
1. 앱 접속 → Google 로그인 → "승인 대기 중" 화면
2. Owner가 `/admin`에서 승인 → 자동으로 메인 진입
3. 더보기 → "신앙 기능" 토글로 경건·기도 메뉴 활성화 가능 (기본 OFF)
4. **관리** 에서 본인 습관·기도제목 시드를 직접 추가하거나 처음부터 만들기

## 폴더 구조

```
habit-garden/
├─ apps/web/src/
│  ├─ features/{habits,...}/      # 핵심 기능 hooks & 컴포넌트
│  ├─ routes/                      # 각 화면 (Main, Habits, Progress, ...)
│  ├─ components/{ui,TabBar,...}   # 공통 컴포넌트
│  └─ lib/{firebase,auth,store,dayBoundary,utils}.ts
├─ functions/src/
│  ├─ dayScore.ts     — dayScore·스트릭 정산 (Firestore onWrite)
│  ├─ dailyReset.ts   — 04:00 KST 일일 초기화
│  ├─ feedback.ts     — Gemini AI 피드백 생성 (callable)
│  ├─ notify.ts       — 알림 발송 (텔레그램/FCM 채널 분기)
│  ├─ backup.ts       — 월별 JSON 백업
│  └─ telegram/       — 텔레그램 봇 (웹훅·계정 연결·습관 체크·회고)
├─ shared/types/firestore.ts       # 공통 TypeScript 타입
├─ shared/lib/telegram.ts          # 봇 순수 로직 (콜백 인코딩·메시지·회고 단계)
└─ docs/                           # 프로젝트 계획서·목업
```

## 텔레그램 봇

앱을 열지 않고 텔레그램에서 **습관 체크 · 저녁 회고 · AI 코치**를 쓸 수 있다.
연결하면 모든 알림(습관 리마인더·모닝 브리프·주간 요약)이 웹푸시 대신 **텔레그램으로만** 가고,
리마인더 메시지에 붙은 버튼으로 그 자리에서 바로 체크할 수 있다.

기록은 전부 앱과 같은 Firestore 문서에 같은 형태로 저장되므로, 봇에서 체크해도
스트릭·dayScore·히트맵이 앱과 똑같이 갱신된다(기존 `dayScoreEngine` 트리거가 그대로 동작).

### 명령

| 명령 | 하는 일 |
|---|---|
| `/now` | 현재 시간대의 미완료 습관 — 이진 습관 원탭 완료, 점수형 습관 1~5점 기록 |
| `/today` | 오늘 남은 습관 전체 — 시간대·수시·전체 목록 전환 가능 |
| `/menu` | 지금 체크·남은 습관·회고·설정 빠른 메뉴 표시 |
| `/reflect` | 저녁 회고를 대화로 작성 (어제 다짐 실천 여부 → 필수 3문항 → 만족도·사용시간) |
| `/coach` | 오늘의 AI 코치 한마디 (앱의 코치 카드와 같은 캐시) |
| `/weekly` | 이번 주 인사이트 |
| `/settings` | 알림 종류 켜고 끄기 |
| `/cancel` | 작성 중인 회고 취소 |
| `/unlink` | 계정 연결 해제 |

텔레그램은 명령 메뉴에 영문(`[a-z0-9_]`)만 허용하지만, **"오늘"·"회고"·"코치"·"주간"·"설정"**
처럼 한글로 보내도 같은 명령이 실행된다.

습관 카드에서는 아침·오후·저녁·밤·수시·전체 목록을 오갈 수 있다. 미완료 목록의
`30분 뒤`·`2시간 뒤` 버튼은 앱을 열지 않고 서버에 재알림을 예약하며,
`오늘 습관 알림 끝`은 다음 날에는 자동 복구되는 당일 중지다.

### 최초 설정 (owner, 1회)

1. 텔레그램에서 [@BotFather](https://t.me/BotFather) → `/newbot` 으로 봇을 만들고 토큰을 받는다.
2. 웹훅 시크릿으로 쓸 임의의 문자열을 하나 정한다 (예: `openssl rand -hex 32`).
3. 시크릿 등록 후 배포:
   ```bash
   firebase functions:secrets:set TELEGRAM_BOT_TOKEN
   firebase functions:secrets:set TELEGRAM_WEBHOOK_SECRET
   firebase deploy --only functions,firestore
   ```
4. `apps/web/.env` 의 `VITE_TELEGRAM_BOT_USERNAME` 에 봇 username(@ 없이)을 넣고 프론트를 배포한다.
   (딥링크 `t.me/<username>?start=<코드>` 버튼에 쓰인다)
5. 앱 → **더보기 → 관리(`/admin`) → 텔레그램 봇 → "웹훅·명령 등록"** 을 한 번 누른다.
   웹훅 URL(`https://asia-northeast3-planner-web-quick.cloudfunctions.net/telegramWebhook`)과
   명령 메뉴가 등록된다. 봇 토큰을 바꾸면 다시 눌러야 한다.

### 사용자 연결

앱 → **더보기 → 알림 설정 → 텔레그램** → "연결 코드 받기" → 6자리 코드(10분·1회용)를 받아
딥링크 버튼을 누르거나 봇에게 `/start <코드>` 를 보낸다.

### 보안

- 웹훅은 `X-Telegram-Bot-Api-Secret-Token` 헤더를 검증하고, 승인(`approved`)된 계정만 통과시킨다.
- 연결 정보(`telegramLinks` / `telegramUsers` / `telegramLinkCodes`)는 클라이언트가 쓸 수 없다
  (`firestore.rules`). `users/{uid}/**` 규칙이 클라이언트 쓰기를 허용하고 Firestore 규칙은 OR 로
  평가돼 하위 경로에서 되막을 수 없기 때문에, 일부러 최상위 컬렉션에 두고 서버 전용으로 잠갔다.
- 같은 `update_id` 는 한 번만 처리한다(텔레그램 재전송 시 회고 단계가 밀리는 것 방지).

### 로컬 테스트 (에뮬레이터)

`functions/.secret.local` 에 시크릿 값을, `functions/.env.local` 에
`TELEGRAM_API_BASE=http://127.0.0.1:7788` 를 넣으면 실제 텔레그램 대신 로컬 목 서버로 보낼 수 있다
(두 파일 모두 `.gitignore` 대상). 웹훅은 그냥 HTTP POST 라 curl 로 업데이트를 흉내낼 수 있다:

```bash
curl -X POST http://localhost:5001/planner-web-quick/asia-northeast3/telegramWebhook \
  -H 'Content-Type: application/json' \
  -H 'X-Telegram-Bot-Api-Secret-Token: <시크릿>' \
  -d '{"update_id":1,"message":{"message_id":1,"chat":{"id":123},"from":{"id":123},"text":"/today"}}'
```

## 주요 기능 메모

- **습관 묶음 · 일괄 건너뛰기**: 습관 편집에서 '학교' 같은 묶음을 만들어 습관을 배정하면, 습관 화면 상단에서 묶음 단위로 **오늘 일괄 건너뛰기/해제** 가능. 등교 안 하는 날 학교 습관을 한 번에 건너뛴다.
- **말씀 적용 추적** (신앙 탭): 큐티·주일설교·LGM·말씀묵상·기타에서 받은 *적용*(무엇을 실천할지)을 기록하고, 이후 며칠간 "오늘 실천했어요"를 체크해 실천 횟수·연속일을 추적한다. 목표일 달성 시 완료로 마무리. 하단 **신앙 탭 → 말씀 적용** 세그먼트(기도와 한 탭으로 통합). 승인 사용자는 정리한 노트를 붙여넣으면 AI가 본문·깨달은 말씀·여러 적용점·목표일을 정리해 골라 담을 수 있다.
  - **내 생활 환경(AI 개인화)**: 더보기 → "말씀 적용 — 내 생활 환경" 또는 AI 정리 화면 상단 배너에서 직업·가정·일과·자주 만나는 사람·요즘 영적 고민을 입력해두면, `parseApplication` AI가 이를 참고해 막연한 모범답안 대신 *내 삶에 와닿는 구체적 적용*을 추천한다. (`settings/main.lifeContext`, 본인만 열람)
  - **오래 방치된 적용 자동 보류**: 마지막 실천(없으면 시작일) 이후 `APPLICATION_STALE_DAYS`(기본 7일)를 넘도록 진행 중·목표 미달인 적용은 매일 04:00 `dailyReset`이 자동으로 `lapsed`(보류)로 내려 진행 목록이 무한정 쌓이지 않게 한다. 보류된 적용은 "완료·보관" 목록에 남아 "다시 진행"으로 언제든 되살릴 수 있다(기도제목 dormant 전이와 동일한 방식).
