// app.jsx — Design canvas presenting three badge directions

const TIER_COLORS = {
  1: "#a87454",
  2: "#7c8794",
  3: "#c8932a",
  4: "#a85f5b",
  5: "#4677a8",
  6: "#7e5cd6",
};

// ───────────────────────────────────────────────────────────
// Building blocks
// ───────────────────────────────────────────────────────────
function LevelChip({ level, Badge, badgeSize = 28, color = "#2a2520" }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 12px 6px 8px",
      borderRadius: 999,
      background: "#fafaf7",
      border: "1px solid #e8e4dc",
      width: "max-content",
    }}>
      <Badge level={level} size={badgeSize}/>
      <span style={{
        fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
        fontSize: 12,
        fontWeight: 600,
        color,
        letterSpacing: "0.02em",
      }}>Lv. {String(level).padStart(2, "0")}</span>
    </div>
  );
}

function TierLabel({ tier, compact = false }) {
  const meta = TIER_META[tier - 1];
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: compact ? 8 : 12 }}>
      <span style={{
        fontSize: 11,
        fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
        fontWeight: 600,
        color: TIER_COLORS[tier],
        padding: "2px 7px",
        borderRadius: 4,
        background: TIER_COLORS[tier] + "18",
      }}>T{tier}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: "#1f1a14", letterSpacing: "-0.01em" }}>
        {meta.name}
      </span>
      <span style={{ fontSize: 11, color: "#8a8275" }}>{meta.range} · {meta.sub}</span>
    </div>
  );
}

// One full direction artboard
function DirectionBoard({ title, kicker, description, Badge, accent = "#1f1a14" }) {
  return (
    <div style={{
      padding: "32px 36px 36px",
      background: "#ffffff",
      width: "100%",
      height: "100%",
      boxSizing: "border-box",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif',
      color: "#1f1a14",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "#8a8275",
          fontWeight: 600,
          marginBottom: 6,
        }}>{kicker}</div>
        <h2 style={{
          margin: 0,
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: accent,
        }}>{title}</h2>
        <p style={{
          margin: "8px 0 0",
          fontSize: 13,
          lineHeight: 1.5,
          color: "#5a5448",
          maxWidth: 540,
        }}>{description}</p>
      </div>

      {/* Tier highlight strip — final-of-tier at large size */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(6, 1fr)",
        gap: 12,
        padding: "18px 8px",
        background: "linear-gradient(180deg, #fafaf6, #f3f1ea)",
        border: "1px solid #ece8e0",
        borderRadius: 12,
        marginBottom: 28,
      }}>
        {[5, 10, 15, 20, 25, 30].map((lv, i) => {
          const t = i + 1;
          return (
            <div key={lv} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <Badge level={lv} size={56}/>
              <div style={{
                fontSize: 10,
                fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                color: TIER_COLORS[t],
                fontWeight: 700,
              }}>T{t} · MAX</div>
              <div style={{ fontSize: 10, color: "#8a8275" }}>{TIER_META[i].name}</div>
            </div>
          );
        })}
      </div>

      {/* Per-tier progression — all 5 sublevels per row */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {[1,2,3,4,5,6].map(tier => (
          <div key={tier} style={{
            padding: "14px 16px",
            background: "#fbfaf6",
            border: "1px solid #ece8e0",
            borderRadius: 10,
          }}>
            <TierLabel tier={tier}/>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 8,
              alignItems: "center",
            }}>
              {[1,2,3,4,5].map(sub => {
                const lv = (tier - 1) * 5 + sub;
                return (
                  <div key={lv} style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    padding: "10px 4px",
                    borderRadius: 8,
                    background: sub === 5 ? "#fff5e8" : "transparent",
                    border: sub === 5 ? "1px dashed #e8c478" : "1px dashed transparent",
                  }}>
                    <Badge level={lv} size={44}/>
                    <div style={{
                      fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                      fontSize: 10,
                      fontWeight: 600,
                      color: "#3a342a",
                    }}>Lv {lv}</div>
                    <div style={{ fontSize: 9, color: "#8a8275" }}>
                      {sub === 1 && "base"}
                      {sub === 2 && "+ edge"}
                      {sub === 3 && "+ ornament"}
                      {sub === 4 && "+ gem"}
                      {sub === 5 && "+ aura"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// "Real use" artboard — show badges at TINY actual size next to level numbers,
// the way they'll appear in a UI list.
function ActualSizeBoard({ Badge, title, theme = "light" }) {
  const dark = theme === "dark";
  return (
    <div style={{
      width: "100%",
      height: "100%",
      boxSizing: "border-box",
      padding: "32px 36px",
      background: dark ? "#171413" : "#ffffff",
      color: dark ? "#f3eee5" : "#1f1a14",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif',
    }}>
      <div style={{
        fontSize: 11,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: dark ? "#9a8e7e" : "#8a8275",
        fontWeight: 600,
        marginBottom: 6,
      }}>실제 사용 미리보기 · {theme}</div>
      <h3 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>{title}</h3>
      <p style={{ margin: "0 0 22px", fontSize: 12, color: dark ? "#a89e8c" : "#7a7468" }}>
        목록·프로필·리더보드에서 레벨 옆에 붙는 사이즈
      </p>

      {/* Compact list at 20px — production-typical */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: "2px 18px",
        padding: "16px 18px",
        background: dark ? "#221d1a" : "#fafaf6",
        border: `1px solid ${dark ? "#322a25" : "#ece8e0"}`,
        borderRadius: 10,
        marginBottom: 18,
      }}>
        {Array.from({ length: 30 }, (_, i) => i + 1).map(lv => (
          <div key={lv} style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 4px",
            borderBottom: lv % 15 === 0 || lv === 30 ? "none" : `1px solid ${dark ? "#2a2420" : "#f2eee5"}`,
          }}>
            <Badge level={lv} size={20}/>
            <span style={{
              fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
              fontSize: 12,
              fontWeight: 600,
              color: dark ? "#e6dcc8" : "#3a342a",
              minWidth: 50,
            }}>Lv. {String(lv).padStart(2, "0")}</span>
            <span style={{
              fontSize: 11,
              color: dark ? "#8a8070" : "#8a8275",
            }}>
              {TIER_META[tierOf(lv) - 1].name}
            </span>
          </div>
        ))}
      </div>

      {/* Inline chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {[1, 5, 8, 12, 15, 18, 22, 25, 28, 30].map(lv => (
          <div key={lv} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 10px 5px 6px",
            borderRadius: 999,
            background: dark ? "#221d1a" : "#fafaf6",
            border: `1px solid ${dark ? "#322a25" : "#ece8e0"}`,
            fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            fontSize: 11,
            fontWeight: 600,
            color: dark ? "#e6dcc8" : "#3a342a",
          }}>
            <Badge level={lv} size={18}/>
            Lv {lv}
          </div>
        ))}
      </div>

      {/* Inline-with-name rows — chat / leaderboard style */}
      <div style={{
        padding: "8px 14px",
        background: dark ? "#221d1a" : "#fafaf6",
        border: `1px solid ${dark ? "#322a25" : "#ece8e0"}`,
        borderRadius: 10,
      }}>
        {[
          { name: "강민준", lv: 3 },
          { name: "이서연", lv: 9 },
          { name: "박지훈", lv: 14 },
          { name: "최유나", lv: 19 },
          { name: "정도윤", lv: 24 },
          { name: "한채은", lv: 30 },
        ].map((u, idx, arr) => (
          <div key={u.name} style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "9px 0",
            borderBottom: idx < arr.length - 1 ? `1px solid ${dark ? "#2a2420" : "#f2eee5"}` : "none",
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%",
              background: dark ? "#3a322c" : "#e8e0d2",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 600,
              color: dark ? "#e6dcc8" : "#5a5448",
            }}>{u.name[0]}</div>
            <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>{u.name}</span>
            <Badge level={u.lv} size={18}/>
            <span style={{
              fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
              fontSize: 12,
              fontWeight: 600,
              color: dark ? "#a89e8c" : "#5a5448",
            }}>Lv {u.lv}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Intro / system-design artboard
function IntroBoard() {
  return (
    <div style={{
      width: "100%",
      height: "100%",
      boxSizing: "border-box",
      padding: "44px 44px",
      background: "linear-gradient(180deg, #fdfbf5 0%, #f5f0e3 100%)",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif',
      color: "#1f1a14",
    }}>
      <div style={{
        fontSize: 11,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: "#8a8275",
        fontWeight: 600,
        marginBottom: 10,
      }}>Level Badge System</div>
      <h1 style={{
        margin: "0 0 14px",
        fontSize: 40,
        fontWeight: 700,
        letterSpacing: "-0.03em",
        lineHeight: 1.05,
      }}>30 레벨 ·<br/>6 티어 진화 구조</h1>
      <p style={{ margin: "0 0 28px", fontSize: 14, lineHeight: 1.6, color: "#5a5448", maxWidth: 460 }}>
        5단계씩 묶인 6개 티어. 각 티어 안에서 base → edge → ornament → gem → aura
        순서로 디테일이 쌓이며, 5의 배수에서 다음 티어로 진입할 직전의 완성형이 됩니다.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {[1,2,3,4,5,6].map(t => {
          const m = TIER_META[t-1];
          return (
            <div key={t} style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "12px 14px",
              background: "#ffffff",
              border: "1px solid #ece8e0",
              borderRadius: 10,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: TIER_COLORS[t] + "20",
                color: TIER_COLORS[t],
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                fontWeight: 700,
                fontSize: 14,
              }}>T{t}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{m.name}</div>
                <div style={{ fontSize: 11, color: "#8a8275", marginTop: 2 }}>{m.sub}</div>
              </div>
              <div style={{
                fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                fontSize: 11,
                color: "#8a8275",
              }}>{m.range}</div>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 28,
        padding: "14px 16px",
        background: "#ffffff",
        border: "1px dashed #d8cfb8",
        borderRadius: 10,
        fontSize: 12,
        lineHeight: 1.5,
        color: "#5a5448",
      }}>
        <strong style={{ color: "#1f1a14" }}>3가지 시안 비교</strong> ·
        오른쪽으로 스크롤하여 Modern Flat / RPG Classic / Minimal Geometric을 비교해보세요.
        각 시안은 동일한 30레벨 구조를 따라 디자인되었습니다.
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// Root — wire everything into DesignCanvas
// ───────────────────────────────────────────────────────────
function App() {
  return (
    <>
      <BadgeDefs/>
      <DesignCanvas>
        <DCSection id="intro" title="시스템 개요" subtitle="6 tiers × 5 sub-levels = 30 levels">
          <DCArtboard id="overview" label="System Overview" width={580} height={900}>
            <IntroBoard/>
          </DCArtboard>
        </DCSection>

        <DCSection id="a-modern" title="A · Modern Flat" subtitle="현대적인 앱 UI · 깔끔한 평면">
          <DCArtboard id="a-detail" label="A · 30 레벨 진화" width={760} height={1340}>
            <DirectionBoard
              kicker="Direction A"
              title="Modern Flat"
              description="현대적인 앱·웹 UI에 자연스럽게 어울리는 평면 스타일. 부드러운 그라데이션으로 깊이를 주되 장식은 최소화. 가장 톤 다운된 시안."
              Badge={ModernBadge}
            />
          </DCArtboard>
          <DCArtboard id="a-actual" label="A · 실제 사용" width={520} height={1340}>
            <ActualSizeBoard Badge={ModernBadge} title="Modern Flat in context"/>
          </DCArtboard>
          <DCArtboard id="a-dark" label="A · Dark UI" width={520} height={1340}>
            <ActualSizeBoard Badge={ModernBadge} title="Modern Flat — Dark" theme="dark"/>
          </DCArtboard>
        </DCSection>

        <DCSection id="b-classic" title="B · RPG Classic" subtitle="판타지 / 게임 풍 · 화려한 디테일">
          <DCArtboard id="b-detail" label="B · 30 레벨 진화" width={760} height={1340}>
            <DirectionBoard
              kicker="Direction B"
              title="RPG Classic"
              description="판타지 게임의 헤럴드릭 뱃지에서 차용. 메탈릭 그라데이션·리본·보석·왕관까지 풀-디테일. 성취감과 권위가 강하게 드러나는 시안."
              Badge={ClassicBadge}
            />
          </DCArtboard>
          <DCArtboard id="b-actual" label="B · 실제 사용" width={520} height={1340}>
            <ActualSizeBoard Badge={ClassicBadge} title="RPG Classic in context"/>
          </DCArtboard>
          <DCArtboard id="b-dark" label="B · Dark UI" width={520} height={1340}>
            <ActualSizeBoard Badge={ClassicBadge} title="RPG Classic — Dark" theme="dark"/>
          </DCArtboard>
        </DCSection>

        <DCSection id="c-minimal" title="C · Minimal Geometric" subtitle="아이코노그래픽 · 작은 사이즈 최적화">
          <DCArtboard id="c-detail" label="C · 30 레벨 진화" width={760} height={1340}>
            <DirectionBoard
              kicker="Direction C"
              title="Minimal Geometric"
              description="단색·기하학 도형 기반. 티어는 형태(원→사각→육각→오각→방패→스타)와 색으로, 세부 레벨은 작은 핍(•) 개수로 표현. 16~20px에서도 또렷이 읽히는 미니멀 시안."
              Badge={MinimalBadge}
            />
          </DCArtboard>
          <DCArtboard id="c-actual" label="C · 실제 사용" width={520} height={1340}>
            <ActualSizeBoard Badge={MinimalBadge} title="Minimal Geometric in context"/>
          </DCArtboard>
          <DCArtboard id="c-dark" label="C · Dark UI" width={520} height={1340}>
            <ActualSizeBoard Badge={MinimalBadge} title="Minimal Geometric — Dark" theme="dark"/>
          </DCArtboard>
        </DCSection>

        <DCSection id="compare" title="3 시안 직접 비교" subtitle="같은 레벨 · 다른 스타일">
          <DCArtboard id="compare-board" label="Side-by-side" width={900} height={780}>
            <CompareBoard/>
          </DCArtboard>
        </DCSection>
      </DesignCanvas>
    </>
  );
}

function CompareBoard() {
  const dirs = [
    { id: "a", title: "A · Modern Flat",       Badge: ModernBadge },
    { id: "b", title: "B · RPG Classic",       Badge: ClassicBadge },
    { id: "c", title: "C · Minimal Geometric", Badge: MinimalBadge },
  ];
  const levels = [1, 5, 10, 15, 20, 25, 30];
  return (
    <div style={{
      width: "100%", height: "100%", boxSizing: "border-box",
      padding: "32px 36px",
      background: "#ffffff",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif',
      color: "#1f1a14",
    }}>
      <div style={{
        fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
        color: "#8a8275", fontWeight: 600, marginBottom: 6,
      }}>Side-by-side comparison</div>
      <h2 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em" }}>
        티어 진입점에서 한 눈에 비교
      </h2>
      <p style={{ margin: "0 0 26px", fontSize: 13, color: "#5a5448" }}>
        티어 시작·완성 시점의 레벨을 골라 세 시안을 나란히 비교합니다.
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: `200px repeat(${levels.length}, 1fr)`,
        gap: 0,
        border: "1px solid #ece8e0",
        borderRadius: 12,
        overflow: "hidden",
      }}>
        <div style={{
          padding: "14px 16px",
          background: "#fafaf6",
          borderBottom: "1px solid #ece8e0",
          borderRight: "1px solid #ece8e0",
          fontSize: 11,
          fontWeight: 600,
          color: "#8a8275",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}>Direction</div>
        {levels.map(lv => (
          <div key={lv} style={{
            padding: "14px 8px",
            background: "#fafaf6",
            borderBottom: "1px solid #ece8e0",
            borderRight: "1px solid #ece8e0",
            fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            fontSize: 11,
            fontWeight: 700,
            color: TIER_COLORS[tierOf(lv)],
            textAlign: "center",
          }}>
            Lv {lv}
            <div style={{ fontSize: 9, color: "#8a8275", fontWeight: 500, marginTop: 2 }}>
              {TIER_META[tierOf(lv) - 1].name}
            </div>
          </div>
        ))}

        {dirs.map((d, di) => (
          <React.Fragment key={d.id}>
            <div style={{
              padding: "20px 16px",
              borderBottom: di < dirs.length - 1 ? "1px solid #ece8e0" : "none",
              borderRight: "1px solid #ece8e0",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
            }}>{d.title}</div>
            {levels.map(lv => (
              <div key={lv} style={{
                padding: "18px 8px",
                borderBottom: di < dirs.length - 1 ? "1px solid #ece8e0" : "none",
                borderRight: "1px solid #ece8e0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}>
                <d.Badge level={lv} size={48}/>
                <d.Badge level={lv} size={22}/>
              </div>
            ))}
          </React.Fragment>
        ))}
      </div>

      <div style={{
        marginTop: 24,
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 12,
      }}>
        {dirs.map(d => (
          <div key={d.id} style={{
            padding: "14px 16px",
            background: "#fafaf6",
            border: "1px solid #ece8e0",
            borderRadius: 10,
            fontSize: 12,
            lineHeight: 1.5,
            color: "#5a5448",
          }}>
            <strong style={{ color: "#1f1a14", display: "block", marginBottom: 4 }}>{d.title}</strong>
            {d.id === "a" && "현대 앱·웹 UI에 무난하게 어울림. 톤이 가장 정제됨."}
            {d.id === "b" && "게임·커뮤니티에 가장 강한 성취감. 작은 사이즈에선 다소 무거움."}
            {d.id === "c" && "16–20px 초소형에서 가장 또렷함. 정보 밀도 높은 화면 추천."}
          </div>
        ))}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
