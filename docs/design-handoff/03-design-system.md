# 03 · 현행 디자인 시스템

> **개편 전(As-Is) 자료.** 이 문서는 바꾸기 전 현재 상태를 기록한 것이다 — 제안이 아니다.
> 실제 화면은 [`screens.html`](screens.html)에서 본다.

기계 판독용 사본: [`tokens.json`](tokens.json) · 원본: `apps/web/src/index.css`, `apps/web/tailwind.config.js`

## 컬러 토큰

CSS 변수로 정의하고 Tailwind에 `bg-leaf`, `text-fg-muted` 형태로 매핑돼 있다.

### 표면 · 텍스트

| 토큰 | HEX | 용도 |
|---|---|---|
| `--bg-base` | `#F4F6EE` | 페이지 배경(연한 자연광). PWA `theme_color`도 동일 |
| `--bg-surface` | `#FFFFFF` | 카드 · 탭바 |
| `--fg-primary` | `#2A2E27` | 본문 |
| `--fg-muted` | `#6B7164` | 보조 |
| `--fg-faint` | `#9AA08F` | 힌트 · 비활성 탭 |
| `--border` | `#DDE5D0` | 구분선 |
| `--border-soft` | `#EAF0E0` | 카드 테두리 |

### 의미색

| 토큰 | HEX | 짝 배경 | 의미 |
|---|---|---|---|
| `--leaf` | `#4F7A37` | `--leaf-soft` `#E7F0DD` | **주색**. 성장 · 달성 · 진행 게이지 · 활성 탭 · primary 버튼 |
| `--bloom` | `#A85D0B` | `--bloom-soft` `#FAEEDA` | 개화 · **포인트(P)** · 보상 · 스트릭 · 토스트 |
| `--sky` | `#1F5FA5` | `--sky-soft` `#E6F1FB` | 컨디션 · 물/샘물 · 경건 |
| `--soil` | `#8A6E4B` | — | 흙 · 화단 · 장식 |
| `--wither` | `#C7B68A` | — | **시듦**. 의도적으로 빨강이 아닌 차분한 베이지 |

### 정원 씬 (일러스트 배경)

`--garden-sky-top #CDEBF6` → `--garden-sky-bottom #EAF6DA` 그라데이션, `--garden-sun #FFF1C2`,
`--garden-hill #BFE0A0`, `--garden-soil-top #A98559` → `--garden-soil-bottom #7C5C38`

## 타이포그래피

- **Pretendard Variable** (jsdelivr CDN dynamic-subset), 폴백 `Pretendard, system-ui, sans-serif`
- 본문 기준 `15px`, 두께 400/500 위주
- 숫자는 `.tabular-nums` 유틸 (레벨·포인트·타이머)
- **타이포 스케일 토큰이 없다.** 크기는 Tailwind 기본(`text-xs`~`text-base`) + 임의값 혼용

현행 임의값 사용 실태(전수 조사):

| 크기 | 사용 수 | |
|---|---|---|
| `text-[11px]` | 114 | ← 최다 |
| `text-[10px]` | 83 | |
| `text-[13px]` | 10 | |
| `text-[9px]` / `text-[8px]` | 9 | |
| 그 외 12/14/15/16/18/22/26/28/34/68/80px | 22 | |

> **11px 이하 텍스트가 206곳.** 모바일 가독성 측면에서 개편 시 가장 먼저 손볼 지점이다.

## 간격 · 형태 · 그림자

- 4px 스케일, 모바일 기본 패딩 `px-3 py-2`
- 라운드: `--radius 12px` / `--radius-sm 8px` / `--radius-lg 16px` / `--radius-full 999px`
- 그림자 2단:
  - `--shadow-sm` = `0 1px 2px rgba(42,46,39,.04), 0 2px 5px rgba(42,46,39,.06)`
  - `--shadow-md` = `0 6px 16px -4px rgba(42,46,39,.12), 0 2px 6px -2px rgba(42,46,39,.06)`
- 공통 카드 클래스 `.card` = `rounded-[--radius] + border-[--border-soft] + bg-[--bg-surface] + shadow-sm`
- `.tab-bar-safe`, `.no-scrollbar` 유틸 존재

## 모션

| 토큰 | 값 |
|---|---|
| `--ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` |
| `--dur-fast` | 140ms |
| `--dur-base` | 220ms |
| `--dur-slow` | 380ms |

정원 idle 키프레임: `plant-sway`(7s 좌우 1.3°), `mote-drift`(9s 먼지), `aura-pulse`(3s), `halo-rotate`, `sparkle-twinkle`(2.4s).
인터랙션은 **Framer Motion**, 버튼 누름은 `active:scale-[0.97]`.

## 컴포넌트 인벤토리

### shadcn/ui 프리미티브 (5개뿐)

`button` · `tabs` · `dialog` · `switch` · `slider`
→ input, select, sheet, card, dropdown 등은 **없다**. 필요할 때마다 화면 안에서 직접 만들어 쓰고 있다.

**Button variants** (`components/ui/button.tsx`)

| variant | 스타일 |
|---|---|
| `default` | `--leaf` 배경, 흰 글씨 |
| `secondary` | `--leaf-soft` 배경, `--leaf` 글씨 |
| `ghost` | 투명, hover 시 `--leaf-soft` |
| `outline` | `--border` 테두리 |
| `bloom` | `--bloom` 배경, 흰 글씨 (보상 행동) |
| `destructive` | `bg-red-100 / text-red-700` ← 유일하게 토큰 밖 |

sizes: `sm` h-8 / `default` h-10 / `lg` h-12 / `icon` 40×40.
포커스 링은 `--leaf` 2px + offset 2px로 통일돼 있다.

### 자체 제작 주요 컴포넌트

| 컴포넌트 | 줄 수 | 비고 |
|---|---|---|
| `features/garden/PlantSVG` | 1,077 | **식물 벡터 자산 전체**. 종·stage별 SVG. 인라인 HEX 170개 |
| `features/prayers/PrayerComponents` | 882 | 기도 UI 묶음 |
| `features/habits/HabitCard` | 405 | 0~5점 체크 카드 — 앱의 핵심 인터랙션 |
| `components/BloomBadge` | 274 | 30레벨 배지(6티어 × 5서브). `level_desigh/` 시안 채택본 |
| `components/ui/RulerPicker` | 270 | 수면 시각 입력 다이얼(자체 제작) |
| `features/onboarding/SpotlightTour` | 252 | 스팟라이트 투어 |
| `features/garden/GardenView` | 250 | 정원 씬 렌더 |
| `components/SwipeTabs` | 179 | 탭 좌우 스와이프 |
| `features/garden/TranscendAtmosphere` | 176 | 초월 등급 연출 |
| `features/stats/HabitHeatmap` | 161 | GitHub 잔디형 |
| 기타 | | `ProgressRing`, `CountUp`, `EmptyState`, `ToggleRow`, `CelebrationOverlay`, `LevelUpModal` … |

아이콘은 **lucide-react** 전용. 이모지도 카피 안에서 일부 사용(🌱 💧 ✦ 🙏).

## 알려진 문제 — 개편 시 우선 해결 대상

1. **타이포 스케일 부재** — 임의 px값 240여 곳, 그중 11px 이하가 206곳. 토큰화된 스케일이 필요하다.
2. **폰트 문서 불일치** — 계획서 §12는 `system-ui, Noto Sans KR`라고 적혀 있으나 실제는 **Pretendard Variable**. 게다가 외부 CDN(`jsdelivr`) 의존이라 오프라인 PWA에서 폴백된다. 셀프 호스팅 검토 필요.
3. **토큰 밖 색 42곳** — `text-red-500`, `bg-amber-50` 등 Tailwind 기본 팔레트가 경고·강조용으로 새어 나와 있다. 팔레트에 **경고/주의 의미색이 없어서** 생긴 일 → 개편안에 `--alert` 계열을 정식으로 넣어야 한다.
4. **다크 모드 전무** — `dark:` 사용 0건, `theme_color` 라이트 고정. 이번 범위 밖이지만 **토큰 구조는 나중에 분기 가능하게** 설계해달라.
5. **카드 컴포넌트가 CSS 클래스 하나** — `.card` 외에 카드 변형(강조/경고/비활성)이 없어 화면마다 인라인으로 재정의 중.
6. **큰 화면의 시스템 이탈** — `Garden.tsx` 855줄, `Planner.tsx` 870줄. 재사용 컴포넌트 없이 인라인 UI가 쌓여 있다. 개편안이 이 두 화면의 반복 패턴을 컴포넌트로 뽑아주면 가치가 크다.
7. **접근성 미검증** — `aria-label` 59곳 사용, `prefers-reduced-motion` 대응은 `level_desigh` 시안에만 있고 **본 앱에는 없다**. 정원 idle 애니메이션이 상시 도는 만큼 대응이 필요하다.
