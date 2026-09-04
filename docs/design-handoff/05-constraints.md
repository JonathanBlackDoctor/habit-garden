# 05 · 기술 제약 & 건드리면 안 되는 것

## 스택 (개편안은 이 안에서 구현 가능해야 한다)

| 영역 | 기술 |
|---|---|
| 빌드 | Vite 5 · TypeScript 5.6 · pnpm 워크스페이스 |
| UI | React 18 · Tailwind CSS 3.4 · shadcn/ui(Radix) · `class-variance-authority` |
| 모션 | Framer Motion 12 · `tailwindcss-animate` |
| 아이콘 | **lucide-react 전용** (다른 아이콘 세트 도입은 협의 필요) |
| 라우팅 | react-router-dom 6 — **HashRouter** |
| 상태 | Zustand · TanStack Query 5 |
| 폼 | react-hook-form + zod (설치돼 있으나 사용 적음) |
| 차트 | recharts 2 (설치돼 있음) |
| 토스트 | sonner |
| 백엔드 | Firebase (Firestore · Auth · Functions · Hosting), 리전 `asia-northeast3` |
| AI | Gemini 2.0 Flash (Cloud Functions 내부 호출) |
| 배포 | GitHub Pages (`base: /habit-garden/`) + Firebase Hosting |

> **이미 설치돼 있지만 shadcn 래퍼가 없는 Radix 패키지**: accordion · label · select · separator · toast · tooltip.
> 개편안에서 이 컴포넌트들이 필요하면 **추가 설치 없이 바로 만들 수 있다.**

## 레이아웃 제약

- **모바일 온리.** 셸 `max-w-[480px]` 중앙 정렬, 기준 폭 **380px**, 확장 **412px**(갤럭시 S24 Ultra 기준으로 잡혀 있음). 태블릿·데스크톱 레이아웃은 없고 이번에도 만들지 않는다.
- `position: fixed; inset: 0` 전체 화면 셸. `height: 100dvh`.
- **safe-area 필수** — 상단 `env(safe-area-inset-top)`, 하단 탭바 `max(env(safe-area-inset-bottom), 8px)`. 펀치홀·제스처바 대응.
- `overscroll-behavior: none` — 바운스 스크롤 없음.
- 스크롤 컨테이너는 **패널 단위**(페이지 전체가 아님). sticky 헤더를 쓰려면 패널 안에서 해결해야 한다.
- **좌우 스와이프는 탭 전환에 이미 쓰인다.** 탭 패널 안에 좌우 제스처 UI를 넣으면 충돌한다.

## 플랫폼 제약

- **PWA standalone.** 주소창이 없다 → 뒤로가기는 앱 안에서 제공해야 한다(`ChevronLeft` 헤더 패턴).
- HashRouter라 딥링크는 `.../#/garden` 형태. 푸시 알림·공유 링크도 이 형식.
- 서비스워커 프리캐시 + FCM 푸시 SW가 같은 스코프. **오프라인에서도 첫 화면이 떠야 한다** → 폰트 CDN 실패 시 폴백 필수.
- 한국어 전용. `lang="ko"`. 다국어 계획 없음.
- 날짜 경계는 **04:00 KST**. 자정이 하루의 끝이 아니다.

## 절대 바꾸지 말 것

| 항목 | 이유 |
|---|---|
| **포인트·XP·레벨·생기 정산 규칙과 수치** | 전부 서버(`awardEngine`, `dailyReset`)가 계산한다. 클라이언트는 표시만 한다. 규칙을 바꾸면 Cloud Functions·Firestore 룰까지 수정해야 한다. **표현은 자유롭게, 수치는 그대로.** |
| **04:00 KST 일일 경계** | 정산·스트릭·샘물 충전이 전부 여기 묶여 있다 |
| **owner 승인 게이팅** | 초대제 앱의 근간. 승인 대기 화면은 반드시 남는다 |
| **신앙 기능 기본 OFF · 토글로만 활성** | 사적 영역이라 의도적으로 숨긴 것. 기본 노출로 바꾸지 말 것 |
| **30레벨 배지 디자인(`BloomBadge`)** | 3차 시안 끝에 확정한 자산(`level_desigh/`). 이번 개편 대상 아님 |
| **탭 재탭 동작 규칙** | 정원/신앙 뷰 토글, 습관 시간대 스크롤 (02 문서 참조) |
| **위젯 순서 변경·숨김 기능** | 사용자 데이터(`settings`)에 저장돼 있다. UI는 바꿔도 기능은 유지 |
| **게스트 모드** | 로그인 없이 전체 기능 체험 → 가입 전환 경로 |

## 협의가 필요한 것 (마음대로 진행 금지)

| 항목 | 이유 |
|---|---|
| **식물 SVG 아트(`PlantSVG.tsx`, 1,077줄)** | 30종 이상 × stage별 벡터. 다시 그리면 작업량이 앱 전체 개편에 맞먹는다. 톤 조정 수준인지 전면 재제작인지 먼저 합의할 것 |
| **탭 구성 변경(5개 → 다른 수)** | 하단 탭은 IA의 뼈대. 바꾸려면 근거와 함께 제안만 |
| **폰트 교체** | Pretendard는 한글 렌더링 품질 때문에 고른 것. 바꾸려면 한글 가독성 근거 필요 |
| **다크 모드 추가** | 이번 범위 밖. 단 토큰은 나중에 분기 가능한 구조로 |
| **새 npm 의존성 추가** | 번들 크기·PWA 캐시에 직결. 위 "설치돼 있음" 목록을 먼저 확인 |

## 품질 게이트 (구현까지 맡길 경우)

```bash
cd apps/web
npm run typecheck   # tsc --noEmit
npm run test        # vitest run
npm run build       # tsc -b && vite build
```

세 개가 전부 통과해야 한다. 테스트는 순수 로직 위주(`widgetOrder`, `healthForecast`, `gardenYield`, `yesterdayRecap`, `todoCarryover`, `prayerRotation`)라 UI 변경으로 깨지지 않아야 정상이다.
