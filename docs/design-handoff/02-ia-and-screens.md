# 02 · 정보구조 & 화면 인벤토리

> **개편 전(As-Is) 자료.** 이 문서는 바꾸기 전 현재 상태를 기록한 것이다 — 제안이 아니다.
> 실제 화면은 [`screens.html`](screens.html)에서 본다.

## 앱 셸

```
┌─ safe-area-inset-top ─────────────┐
│                                   │
│   패널 (SwipeTabs 로 좌우 스와이프)  │  ← 셸 최대 480px, 화면 중앙 정렬
│   각 패널이 개별 스크롤 컨테이너      │     bg: --bg-base
│                                   │
├───────────────────────────────────┤
│  탭바 64px + safe-area-inset-bottom │  ← fixed, bg: --bg-surface, 상단 1px 보더
└───────────────────────────────────┘
   + 전역 오버레이: 토스트(하단 72px 오프셋) · 축하 오버레이 · 레벨업 모달 · 온보딩 투어
```

- 라우터는 **HashRouter** (GitHub Pages 호스팅). URL은 `/#/garden` 형태.
- 하단 탭은 **스와이프로도 전환**된다(`SwipeTabs`). 좌우 제스처를 쓰는 UI(캐러셀·슬라이더)를 탭 패널 안에 넣을 때 충돌 주의.
- **활성 탭 재탭** 동작이 탭마다 다르다 — 이 규칙은 유지해야 한다:
  - `/garden` → 내 정원 ↔ 둘러보기 토글
  - `/prayers` → 기도 ↔ 말씀 적용 토글
  - `/habits` → 현재 시간대로 스크롤
  - 그 외 → 맨 위로 스크롤(0.3s 애니메이션)

## 하단 탭 (5개, 신앙은 조건부)

| 탭 | 경로 | 아이콘 | 노출 조건 |
|---|---|---|---|
| 오늘 | `/` | `Home` | 항상 |
| 습관 | `/habits` | `CheckSquare` | 항상 |
| 정원 | `/garden` | `Flower2` | 항상 |
| 신앙 | `/prayers` | `HandHeart` | **신앙 기능 ON일 때만** (owner 기본 ON, 그 외 OFF) |
| 더보기 | `/more` | `MoreHorizontal` | 항상 |

- 활성색 `--leaf` / 비활성 `--fg-faint`, 활성 시 아이콘 stroke 1.8 → 2.2
- 배지(빨간 카운트)는 탭 아이콘 우상단. 앱에서 **빨강을 쓰는 거의 유일한 곳**.
- 신앙 탭이 꺼지면 탭이 4개가 된다 — **4개/5개 두 경우 모두 레이아웃이 성립해야 한다.**

## 전체 화면 인벤토리 — 화면 17개 (라우트 18개, 이 중 `/applications`는 리다이렉트)

### 인증 · 진입 (셸 밖, 전체 화면)

| 화면 | 경로 | 규모 | 내용 |
|---|---|---|---|
| 로그인 | `/login` | 263줄 | 로고·타이틀(34px) · 구글 로그인 · **게스트 바로 시작** · 인앱 브라우저 감지 배너(외부 브라우저로 열기 안내) · 온보딩 소개 |
| 승인 대기 | `/pending` | 165줄 | 대기 안내(26px 타이틀) · 문의 · 로그아웃 |

### 탭 화면 (셸 안)

| 화면 | 경로 | 규모 | 내용 |
|---|---|---|---|
| **오늘** | `/` | 550줄 | 상단바(레벨 배지·XP링·포인트) + **사용자가 순서를 바꾸는 위젯 12종** |
| **습관** | `/habits` | 323줄 | 시간대별(아침/점심/저녁/밤/언제든) 습관 카드 · 묶음 일괄 건너뛰기 · 편집 모드 |
| **정원** | `/garden` | 855줄 | 내 정원(화단 3개 × 8칸) · 상점 · 도감 · 둘러보기 — **앱에서 가장 큰 화면** |
| **신앙** | `/prayers` | 668줄 | 세그먼트 2개: 기도제목 로테이션 / 말씀 적용(`?view=application`) |
| **더보기** | `/more` | 392줄 | 프로필 · 바로가기 6개 · 토글 3개(햅틱·사운드·신앙 기능) · 휴가 모드 · PWA 설치 · 로그아웃 |

### 더보기에서 들어가는 화면

| 화면 | 경로 | 규모 | 내용 |
|---|---|---|---|
| 진척 현황 | `/progress` | 218줄 | 레벨·XP · 배지 그리드 · 히트맵 · 주간 리포트 |
| 포인트 내역 | `/points` | 167줄 | 획득/사용 필터 · 요일별 원장 |
| 사용 설명서 | `/tutorial` | 594줄 | 아코디언식 규칙 설명(점수·포인트·정원·샘물·레벨) |
| 컨디션 | `/condition` | 201줄 | 슬라이더 · **RulerPicker(수면 시각 다이얼)** · 분석 카드 |
| 플래너 | `/planner` | 870줄 | 오늘/내일/모레 할 일 · 우선순위 · 장기 목표 — **두 번째로 큰 화면** |
| 관리(owner) | `/admin` | 590줄 | 가입 승인 · 문의 답변 · 시드 데이터 · 포인트 수동 조정 |
| 알림 설정 | `/settings/notifications` | 158줄 | 푸시 권한 · 알림 종류별 토글 · 방해금지 시간 |
| 경건 | `/devotion` | 80줄 | 경건·감사 저널(신앙 ON 전용) |
| 회고 | `/reflection` | 276줄 | 질문 답변 시트 · **내일의 다짐** · +20P |
| 지난 날 | `/day/:date` | 124줄 | 과거 하루 요약(읽기 전용) — 히트맵·플래너에서 진입 |

### 오늘 탭 위젯 12종 (순서 변경 · 개별 숨김 가능)

기본 순서. `MAIN_WIDGET_IDS`가 원본이다.

| # | 위젯 | 신규 사용자 기본 | 내용 |
|---|---|---|---|
| 1 | 아침 브리핑 `recap` | 숨김 | 어제 돌아보기 + 오늘 브리프 + 어제 다짐 실천 체크 |
| 2 | **오늘의 습관** `habits` | **표시** | 시간대별 미체크 습관 요약 + 빠른 체크 |
| 3 | **할 일 · 회고** `todos` | **표시** | 오늘 할 일 + 회고 진입 |
| 4 | **정원 미리보기** `garden` | **표시** | 대표 식물 SVG + 생기 게이지 |
| 5 | 내일 정원 예보 `forecast` | 숨김 | 지금 상태면 내일 생기가 어떻게 되는지 선제 경고 |
| 6 | 컨디션 `condition` | 숨김 | 오늘 컨디션 입력 유도 |
| 7 | AI 코치 `coach` | 숨김 | Gemini 생성 피드백 |
| 8 | 주간 퀘스트 `weeklyQuest` | 숨김 | 주간 목표 진행률 |
| 9 | 시즌 챌린지 `season` | 숨김 | 시즌 이벤트 |
| 10 | 1년 전 오늘 `oneYearAgo` | 숨김 | 회상 카드 |
| 11 | 컴백 환영 `comeback` | 숨김 | 오래 쉬다 돌아온 사용자 환영 |
| 12 | 기도 · 말씀 `faith` | 숨김 | 신앙 ON일 때만 |

> **신규 사용자는 3개만 보인다**(`BEGINNER_CORE_WIDGETS`). 나머지는 "위젯 편집"에서 켠다.
> 개편안은 **위젯 3개인 화면**과 **12개 전부 켠 화면**이 둘 다 성립해야 한다.
> 위젯 편집 모드는 드래그 손잡이(`GripVertical`)로만 순서 변경 — 행 전체 드래그는 스크롤과 충돌해서 꺼둔 상태다.

## 전역 오버레이 · 배너

| 요소 | 트리거 |
|---|---|
| `CelebrationOverlay` | 습관 전부 완료 등 축하 시점 |
| `LevelUpModal` | 레벨 상승 감지(`useLevelUpWatcher`) |
| `OnboardingFlow` / `SpotlightTour` / `WelcomeCarousel` | 첫 실행 |
| `PrayerTour` | 신앙 기능 첫 활성화 |
| `SandboxBanner` | 에뮬레이터/샌드박스 환경 |
| `OwnerAlertBanner` | owner에게 승인 대기·문의 알림 |
| `PastDateBanner` | 과거 날짜 편집 중 |
| `SignupCTA` | 게스트에게 가입 유도 |
| 토스트(`sonner`) | 하단 중앙, 탭바 위 72px, `--bloom-soft` 배경 |

---

## 화면 ↔ 스크린샷 대응표

캡처 시각 `2026-09-05T03:05:37.692Z` · 커밋 `4588168` · 총 41장. 한 화면이 길면 스크롤을 이어서 찍었다.

| 화면 | 경로 | 캡처 |
|---|---|---|
| 로그인 | `/login` | [`01-login`](screens/01-login.png) |
| 온보딩 | `—` | [`02-onboarding-welcome`](screens/02-onboarding-welcome.png) · [`02b-onboarding-welcome-2`](screens/02b-onboarding-welcome-2.png) · [`02c-onboarding-welcome-3`](screens/02c-onboarding-welcome-3.png) · [`02d-onboarding-welcome-4`](screens/02d-onboarding-welcome-4.png) · [`03-onboarding-tour`](screens/03-onboarding-tour.png) · [`03b-onboarding-tour-2`](screens/03b-onboarding-tour-2.png) · [`03c-onboarding-tour-3`](screens/03c-onboarding-tour-3.png) · [`03d-onboarding-tour-4`](screens/03d-onboarding-tour-4.png) |
| 오늘 | `/` | [`10-main`](screens/10-main.png) · [`10-main-2`](screens/10-main-2.png) |
| 습관 | `/habits` | [`11-habits`](screens/11-habits.png) · [`11-habits-2`](screens/11-habits-2.png) · [`11b-habit-checked`](screens/11b-habit-checked.png) |
| 정원 | `/garden` | [`12-garden`](screens/12-garden.png) · [`12-garden-2`](screens/12-garden-2.png) · [`12-garden-3`](screens/12-garden-3.png) · [`12-garden-4`](screens/12-garden-4.png) · [`12-garden-5`](screens/12-garden-5.png) · [`12c-garden-browse`](screens/12c-garden-browse.png) |
| 더보기 | `/more` | [`13-more`](screens/13-more.png) · [`13-more-2`](screens/13-more-2.png) · [`30-more-settings`](screens/30-more-settings.png) |
| 진척 현황 | `/progress` | [`20-progress`](screens/20-progress.png) · [`20-progress-2`](screens/20-progress-2.png) |
| 포인트 내역 | `/points` | [`21-points`](screens/21-points.png) |
| 컨디션 | `/condition` | [`22-condition`](screens/22-condition.png) · [`22-condition-2`](screens/22-condition-2.png) |
| 플래너 | `/planner` | [`23-planner`](screens/23-planner.png) |
| 사용 설명서 | `/tutorial` | [`24-tutorial`](screens/24-tutorial.png) · [`24-tutorial-2`](screens/24-tutorial-2.png) · [`24-tutorial-3`](screens/24-tutorial-3.png) |
| 회고 | `/reflection` | [`25-reflection`](screens/25-reflection.png) |
| 알림 설정 | `/settings/notifications` | [`26-notif`](screens/26-notif.png) |
| 위젯 편집 | `/ (모드)` | [`27-widget-edit`](screens/27-widget-edit.png) · [`27-widget-edit-2`](screens/27-widget-edit-2.png) |
| 신앙 ON 탭바 | `/` | [`31-tabs-five`](screens/31-tabs-five.png) |
| 신앙 — 기도제목 | `/prayers` | [`32-prayers`](screens/32-prayers.png) · [`32-prayers-2`](screens/32-prayers-2.png) |
| 신앙 — 말씀 적용 | `/prayers?view=application` | [`33-applications`](screens/33-applications.png) |
| 경건 | `/devotion` | [`34-devotion`](screens/34-devotion.png) |

> `/admin`(owner 전용)·`/day/:date`·`/pending`은 게스트 계정으로 진입할 수 없어 이 세트에 없다.
