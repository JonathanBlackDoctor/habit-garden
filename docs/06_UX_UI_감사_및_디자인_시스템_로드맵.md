# 습관 정원 — UX/UI 감사 및 디자인 시스템 로드맵

> 작성: 2026-06-03 · 범위: `apps/web` 전체 · 방법: 디자인 토큰/공통 컴포넌트 + 핵심 화면 코드 정독
> 목적: 새로 갈아엎지 않고 **일관성·위계·절제**를 회복해 "깔끔하게" 정리

---

## 1. 한눈 평가

| 영역 | 상태 | 한 줄 평 |
|---|---|---|
| 디자인 토큰 체계 | 🟢 우수 | 색·radius·shadow·easing·duration까지 변수화. 토대 탄탄 |
| 모바일 PWA 설계 | 🟢 우수 | 480px 폭, safe-area, 하단 탭바, manifest, 햅틱/사운드, reduced-motion |
| 폰트/타이포 자산 | 🟢 좋음 | Pretendard. 단, **스케일 적용**은 난립(아래 P2-1) |
| 컴포넌트 적용 | 🟠 보통 | 좋은 프리미티브(Button·Switch·Dialog)가 있으나 화면이 raw className으로 재구현 |
| 화면 위계/정보밀도 | 🔴 개선 필요 | '오늘' 홈 과부하, 동시 강조 남발 |
| 시스템 일탈(네이티브/하드코딩) | 🔴 개선 필요 | `prompt/confirm`, off-palette red, 인라인 hex |

**결론:** 리디자인이 아니라 **시스템 정비(통일·절제)** 단계. 기반은 좋다.

---

## 2. 디자인 원칙 (정비의 기준선)

정리 작업에서 모든 의사결정의 기준으로 삼는 원칙.

1. **한 화면, 한 주연.** 화면 상태마다 가장 중요한 행동/정보 하나만 강조(bloom). 나머지는 차분하게.
2. **토큰 우선.** 색·간격·radius·그림자는 반드시 토큰/유틸 경유. 인라인 hex·임의값 금지.
3. **프리미티브 우선.** 버튼·카드·행·뱃지·토글은 공통 컴포넌트로. 화면에서 재구현 금지.
4. **한 가지 아이콘 언어.** lucide 라인 아이콘으로 통일. 이모지는 "콘텐츠"일 때만(예: 성취 축하), UI 라벨엔 미사용.
5. **읽히는 타이포.** 본문 최소 14px, 메타 최소 12px. 9~11px 임의값 금지.
6. **시스템 안에서 끝낸다.** OS 기본 `alert/confirm/prompt` 금지 — 자체 다이얼로그 사용.
7. **상태는 항상 3종.** 모든 데이터 영역은 로딩(스켈레톤)·빈 상태·에러 패턴을 가진다.

---

## 3. 디자인 시스템 표준

### 3.1 컬러 토큰

기존(유지):

| 역할 | 토큰 | 값 |
|---|---|---|
| 배경/표면 | `--bg-base` / `--bg-surface` | `#F4F6EE` / `#FFFFFF` |
| 글자 | `--fg-primary` / `--fg-muted` / `--fg-faint` | `#2A2E27` / `#6B7164` / `#9AA08F` |
| 잎(주색) | `--leaf` / `--leaf-soft` | `#4F7A37` / `#E7F0DD` |
| 흙 | `--soil` | `#8A6E4B` |
| 꽃(강조/주의) | `--bloom` / `--bloom-soft` | `#A85D0B` / `#FAEEDA` |
| 하늘(정보) | `--sky` / `--sky-soft` | `#1F5FA5` / `#E6F1FB` |
| 경계 | `--border` / `--border-soft` | `#DDE5D0` / `#EAF0E0` |

**추가(이번 정비에서 도입):** off-palette red(`red-100/500/700`)와 인라인 hex를 대체.

| 역할 | 토큰 | 값 | 용도 |
|---|---|---|---|
| 위험/삭제 | `--danger` / `--danger-soft` | `#B4402E` / `#F7E4DF` | 로그아웃·삭제·파괴적 액션. 흙/꽃과 어울리는 테라코타 레드 |
| 의미 별칭 | `--warning` = `--bloom`, `--info` = `--sky` | — | 시맨틱 이름으로 통일 |

> 규칙: `text-red-500`, `bg-red-100` 같은 Tailwind 기본 적색 직접 사용 금지 → `text-danger`, `bg-danger-soft`.

### 3.2 타이포 스케일 (제안)

base 15px / Pretendard. 임의 px(9·10·11·13) 금지, 아래 6단계로 수렴.

| 역할 | 클래스 | px | 용도 |
|---|---|---|---|
| display | `text-2xl` | 24 | 큰 수치(레벨·포인트 히어로) |
| heading | `text-lg` | 18 | 화면 제목 |
| title | `text-base` | 16 | 카드/섹션 제목 |
| body | `text-sm` | 14 | 본문 기본 |
| label | `text-xs` | 12 | 라벨·메타·뱃지 |
| (caption) | `text-[11px]` | 11 | **비핵심** 보조설명에 한해 예외 허용 |

> 현재 코드의 `text-[9px]`/`text-[10px]`는 → `text-[11px]` 이상으로 상향(로드맵 P2-1).

### 3.3 스페이싱·형태·모션

- **간격:** 4 / 8 / 12 / 16 / 24 (Tailwind `1/2/3/4/6`). 화면 패딩 `p-4`(16), 카드 내부 `p-4`, 섹션 간 `gap-3`(12) 기본. `p-3.5`/`py-2.5` 같은 반칸 값은 지양.
- **radius:** `--radius`(10) 기본, 큰 카드 `--radius-lg`(16), 칩/버튼은 `--radius-full`.
- **그림자:** `--shadow-sm`(카드), `--shadow-md`(다이얼로그/플로팅)만 사용. 인라인 박스섀도 지양.
- **모션:** `--ease-out` + `--dur-*`. 진입은 `opacity+y(8px)` 통일. `prefers-reduced-motion` 이미 대응됨.
- **터치 타깃:** 인터랙티브 요소 최소 44×44px.

### 3.4 아이콘

- 기본: **lucide-react** 라인 아이콘, 크기 16/18/22, `strokeWidth` 1.8(비활성)·2.2(활성).
- 이모지(🔥✦☀🙏🌱⚡⭐🌴🤒)는 UI 라벨에서 제거 → lucide 또는 커스텀 SVG. 축하/감정 표현 등 "콘텐츠"에 한해 허용.

### 3.5 공통 컴포넌트 프리미티브

이번 정비에서 신설(`src/components/ui/`). 모든 화면은 아래를 조합해서 구성.

| 컴포넌트 | 역할 |
|---|---|
| `Card` | 표면 카드. `padding`·`interactive` 변형 |
| `SectionHeader` | 제목 + 우측 액션(→ 더보기 링크) |
| `ListRow` | 아이콘 + 라벨 + 설명 + 트레일링(토글/뱃지/›) |
| `Badge` | 시맨틱 알약(neutral/leaf/bloom/sky/danger) |
| `IconButton` | 정사각 아이콘 버튼(44px 타깃) |
| `EmptyState` | 빈 상태(아이콘 + 제목 + 설명 + 액션) |
| `ConfirmDialog` / `usePrompt` | 네이티브 confirm/prompt 대체(Radix) |

기존 유지·재사용: `Button`(variants), `Switch`, `Dialog`, `Tabs`, `Slider`.

---

## 4. 화면별 감사

> 우선순위: 🔴 즉시 / 🟠 곧 / 🟡 여유 시

### 오늘 `routes/Main.tsx`
- 🔴 **과부하:** 11개 섹션(헤더/습관/회고배너/할일·회고/정원/컨디션/브리프/코치/퀘스트/1년전/컴백/기도)이 한 화면에. → 접기/우선순위화, 상황별 노출.
- 🔴 **동시 강조:** 할 일·회고·회고배너·브리프·컴백이 모두 bloom 강조 → "한 화면 한 주연"으로 1개만.
- 🟠 인라인 hex 그라데이션(헤더 `#4F7A37…`, 브리프 `#FFF6E5→#FFE9C2`) → 토큰화.
- 🟠 새로고침이 `window.location.reload()` → 데이터 무효화(react-query)로 부드럽게.
- 🟡 이모지 라벨(✦P, ☀, 🔥, 🙏) → 아이콘/뱃지 통일.

### 더보기 `routes/More.tsx`  *(이번 정비 시범 적용 대상)*
- 🔴 **네이티브 다이얼로그:** `prompt('며칠간…')`, `window.confirm(…)` → `usePrompt`/`ConfirmDialog`.
- 🔴 **토글 재구현:** 인라인 switch 마크업 → 공통 `Switch`.
- 🟠 **잡동사니 IA:** 네비 바로가기 + 설정 + 스트릭 보호 + 설치 + 로그아웃 혼재 → `ListRow` 그룹으로 시각 정돈(차후 "설정" 분리 검토).
- 🟠 raw 버튼 className 반복 → `ListRow`/`Card`.

### 습관 `routes/Habits.tsx` / `features/habits/*`
- 🟠 체크 상태 dot(`HabitStatusDot`)·카드(`HabitCard`) 색/크기 규칙을 Badge/토큰 기준으로 점검.
- 🟡 빈 상태(습관 0개) → `EmptyState` + "시드 추가" 1차 액션.

### 정원 `routes/Garden.tsx` / `features/garden/*`
- 🟢 시그니처 화면. 모션/일러스트 강점 유지.
- 🟡 상단 통계/CTA를 `Card`+`SectionHeader`로 정돈, 도감/레벨업 모달 타이포 스케일 통일.

### 기도/경건 `routes/Prayers.tsx`, `Devotion.tsx` (faith)
- 🟡 카드·리스트를 공통 프리미티브로. 음성 입력/일괄 파싱 진입점 위계 정리.

### 진척 `routes/Progress.tsx` / `features/stats/*`
- 🟠 recharts 차트 색을 토큰 팔레트로 통일(현재 임의색 우려) — 코드 확인 후 매핑.
- 🟡 히트맵/리포트 카드 헤더를 `SectionHeader`로.

### 컨디션/플래너/회고 `Condition.tsx`/`Planner.tsx`/`Reflection.tsx`
- 🟠 입력 폼(슬라이더·RulerPicker) 라벨/간격 통일, 저장 버튼 `Button`으로.
- 🟡 빈/로딩 상태 패턴 적용.

### 로그인/대기/튜토리얼 `Login.tsx`/`PendingApproval.tsx`/`Tutorial.tsx`
- 🟡 첫인상 화면 — 타이포 스케일·버튼·여백만 통일해도 인상 크게 개선.

### 관리 `routes/Admin.tsx`
- 🟡 내부용. 우선순위 낮음. 네이티브 다이얼로그/raw 버튼만 정리.

---

## 5. 우선순위 로드맵

| 단계 | 작업 | 영향 | 난이도 | 완료 기준 |
|---|---|---|---|---|
| **P0 (이번 PR)** | 시맨틱 컬러 토큰(danger) + 타이포/스페이싱 표준 문서화 | 높음 | 낮음 | 토큰 추가, tailwind 매핑 |
| **P0** | 공통 프리미티브 신설(Card/SectionHeader/ListRow/Badge/IconButton/EmptyState) | 높음 | 중 | 컴포넌트 + 타입 |
| **P0** | `ConfirmDialog`/`usePrompt`로 네이티브 다이얼로그 대체 | 높음 | 중 | More 적용·typecheck 통과 |
| **P0** | `More.tsx` 시범 마이그레이션(프리미티브+Switch+Dialog) | 높음 | 중 | 네이티브 prompt/confirm 0건 |
| **P1** | '오늘' 홈 위계 재설계(동시 강조 제거, 섹션 우선순위화) | 높음 | 중 | 강조 1개/상태, hex 토큰화 |
| **P1** | 전역 off-palette red/인라인 hex 토큰으로 치환 | 중 | 낮음 | grep `red-`/`#` 0건(허용 예외 외) |
| **P1** | 나머지 네이티브 `confirm/prompt` → `useConfirm`/`usePrompt` (prayers·habits·admin·planner, 약 10곳) | 중 | 낮음 | `window.confirm/prompt` 0건 |
| **P1** | 화면별 raw 버튼/카드/행 → 공통 프리미티브 마이그레이션(habits·garden·progress·…) | 중 | 중 | 신규 프리미티브 사용률 ↑ |
| **P2-1** | `text-[9/10px]` → 11px↑ 상향, 타이포 스케일 적용 | 중 | 낮음 | 임의 9/10px 0건 |
| **P2** | 이모지 UI 라벨 → 아이콘/뱃지 치환 | 중 | 중 | 라벨 영역 이모지 0건 |
| **P2** | 차트(recharts) 색 토큰 매핑 | 중 | 낮음 | 임의색 제거 |
| **P3** | 로딩 스켈레톤·EmptyState 전 화면 적용 | 중 | 중 | 데이터 영역 3종 상태 보유 |
| **P3** | '더보기' → '설정'/'메뉴' IA 분리 검토 | 중 | 중 | 결정·반영 |

---

## 6. 진행 현황 (이번 작업)

- [x] UX/UI 감사 (본 문서)
- [x] 외부 디자이너용 브리프 (`07_디자인_브리프_외부디자이너용.md`)
- [x] P0 — 시맨틱 컬러 토큰(`--danger`) + tailwind 매핑
- [x] P0 — 공통 프리미티브 신설
- [x] P0 — `ConfirmDialog`/`usePrompt`
- [x] P0 — `More.tsx` 시범 마이그레이션
- [ ] P1~ — 이후 단계(상기 로드맵)

> 다음 추천: **P1 '오늘' 홈 위계 재설계** — 사용자가 가장 자주 보는 화면이라 체감 효과가 가장 큼.
