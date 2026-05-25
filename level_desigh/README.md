# 배지 (Level Badges) — 디자인 시안 코드

3차에 걸쳐 만든 30 레벨 뱃지 디자인 시안 전체 코드입니다.

## 진입점 (HTML)

| 파일 | 내용 |
|---|---|
| `Level Badges v1.html` | **v1 · 6 티어 메탈릭 (3 방향)** — Modern Flat / RPG Classic / Minimal Geometric |
| `Level Badges v2 - 4 directions.html` | **v2 · 소프트 시안 4종** — Bloom / Halo / Crystal / Orbit |
| `index.html` | **A 시안 (Bloom) · 애니메이션 최종** — Hero / Interactive Demo / 30단계 라이브 / 컨텍스트 |

브라우저에서 어떤 HTML이든 더블클릭하면 바로 열립니다. (인터넷 연결 필요 — React/Babel CDN.)

## 소스 구조

```
design-canvas.jsx   # 공통 — 팬/줌 캔버스 (Section, Artboard, focus mode)
badges.jsx          # v1 — Modern/Classic/Minimal 뱃지 컴포넌트
app.jsx             # v1 캔버스 구성
badges-v2.jsx       # v2 — Bloom/Halo/Crystal/Orbit + 애니메이션 CSS
app-v2.jsx          # v2 4종 비교 캔버스
app-bloom.jsx       # A 시안(Bloom) 애니메이션 쇼케이스 캔버스
```

모든 JSX는 브라우저에서 Babel standalone으로 트랜스파일됩니다 (빌드 도구 불필요).

## 디자인 시스템 요약

### 공통: 6 티어 × 5 서브레벨 = 30 레벨
- `tierOf(level)` → 1..6
- `subOf(level)` → 1..5

### v2 / Bloom의 6 티어 팔레트 (`SOFT_TIERS` in `badges-v2.jsx`)
| 티어 | 이름 | 범위 | c1 / c2 / c3 |
|---|---|---|---|
| 1 | Pearl Mist | Lv 1–5 | `#FFFFFF` / `#E5ECF0` / `#A8B8C0` |
| 2 | Rose Blush | Lv 6–10 | `#FFFFFF` / `#FFD8E2` / `#E89AB0` |
| 3 | Golden Honey | Lv 11–15 | `#FFFFFF` / `#FFE89A` / `#E8B23A` |
| 4 | Coral Dawn | Lv 16–20 | `#FFFFFF` / `#FFD7BC` / `#FF9E7A` |
| 5 | Amethyst | Lv 21–25 | `#FFFFFF` / `#E0D0FF` / `#9A7BFF` |
| 6 | Aurora | Lv 26–30 | `#FFFFFF` / `#C9A0FF` / `#3E3E7A` |

### Bloom의 5단계 빌드업
1. **core** — 중앙 광원만
2. **+ form** — 꽃잎 등장
3. **+ dust** — 별가루 추가
4. **+ gem** — 중앙 보석/하이라이트
5. **+ aura** — 후광 + 외곽 링

### Bloom 애니메이션
- 꽃잎 회전: 티어별 28–90s (높은 티어일수록 빠름)
- 호흡(scale ±6%): 3.4–6.0s
- 코어 맥동: 3.2s
- 별가루 트윙클: 2.4s (스태거 딜레이)
- 레벨업 진입: 0.95s cubic-bezier
- `prefers-reduced-motion: reduce` 자동 OFF

## 사용 예시 (코드 임베드)

```jsx
import 'badges-v2.jsx';  // 전역 등록

<BadgeDefsV2 />            {/* 페이지당 1회 */}
<BloomBadge level={17} size={24} />
```

`burstKey`를 바꾸면 레벨업 애니메이션이 다시 재생됩니다:

```jsx
const [k, setK] = useState(0);
useEffect(() => setK(k => k+1), [level]);
<BloomBadge level={level} burstKey={k} />
```
