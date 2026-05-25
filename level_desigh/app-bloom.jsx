// app-bloom.jsx — Direction A · Bloom · Animated showcase

const TIER_DOT = {
  1: "#9CB0BC", 2: "#E89AB0", 3: "#E8B23A",
  4: "#FF9E7A", 5: "#9A7BFF", 6: "#7A5DD8",
};

// ───────────────────────────────────────────────────────────
// SUB-LEVEL PROGRESSION SHOWCASE
// One row per tier showing the 5-step bud→bloom at LARGE size.
// This is the proof that sub-levels are visually distinct.
// ───────────────────────────────────────────────────────────
function SubLevelBoard() {
  const SUB_LABELS = ["봉오리", "반개화", "만개", "+ 보석", "+ 후광"];
  const SUB_DESC   = ["bud", "half bloom", "full bloom", "+ gem core", "+ aura"];
  return (
    <div style={{
      width: "100%", height: "100%", boxSizing: "border-box",
      padding: "44px 48px",
      background: "linear-gradient(160deg, #fbfaf6 0%, #f5eee0 60%, #f0e5d0 100%)",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif',
      color: "#1f1a14",
    }}>
      <div style={{
        fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase",
        color: "#8a8275", fontWeight: 600, marginBottom: 10,
      }}>5-Step Bloom · 한 티어 안의 진화</div>
      <h1 style={{
        margin: "0 0 14px", fontSize: 38, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.1,
      }}>봉오리에서 만개까지<br/>다섯 단계로 또렷이</h1>
      <p style={{ margin: "0 0 32px", fontSize: 14, lineHeight: 1.6, color: "#5a5448", maxWidth: 560 }}>
        한 티어 안의 5개 레벨은 <strong>꽃이 피어나는 과정</strong>으로 표현됩니다.
        봉오리 → 반개화 → 만개 → 중앙 보석 → 후광. 한눈에 어느 단계인지 보입니다.
      </p>

      {/* Column header */}
      <div style={{
        display: "grid", gridTemplateColumns: "120px repeat(5, 1fr)",
        gap: 12, alignItems: "center",
        padding: "10px 14px",
        background: "rgba(255,255,255,0.6)",
        border: "1px solid #ece8e0",
        borderTopLeftRadius: 14, borderTopRightRadius: 14,
        borderBottom: "none",
      }}>
        <div style={{
          fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
          color: "#8a8275", fontWeight: 600,
        }}>Tier</div>
        {[1,2,3,4,5].map((sub, i) => (
          <div key={sub} style={{ textAlign: "center" }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: "#3a342a",
              fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            }}>sub {sub}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#1f1a14", marginTop: 4 }}>{SUB_LABELS[i]}</div>
            <div style={{ fontSize: 10, color: "#8a8275", marginTop: 2 }}>{SUB_DESC[i]}</div>
          </div>
        ))}
      </div>

      {/* Tier rows */}
      <div style={{
        background: "rgba(255,255,255,0.6)",
        border: "1px solid #ece8e0",
        borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
        overflow: "hidden",
      }}>
        {[1,2,3,4,5,6].map((tier, ti) => {
          const meta = SOFT_TIERS[tier - 1];
          return (
            <div key={tier} style={{
              display: "grid", gridTemplateColumns: "120px repeat(5, 1fr)",
              gap: 12, alignItems: "center",
              padding: "18px 14px",
              borderTop: "1px solid #ece8e0",
              background: ti % 2 === 0 ? "transparent" : "rgba(245,238,224,0.4)",
            }}>
              <div>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 10, fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                  fontWeight: 700, color: "#fff", letterSpacing: "0.04em",
                  padding: "3px 8px", borderRadius: 4,
                  background: TIER_DOT[tier], marginBottom: 6,
                }}>T{tier}</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{meta.name}</div>
                <div style={{
                  fontSize: 10, color: "#8a8275",
                  fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                }}>{meta.range}</div>
              </div>
              {[1,2,3,4,5].map(sub => {
                const lv = (tier - 1) * 5 + sub;
                return (
                  <div key={lv} style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                  }}>
                    <BloomBadge level={lv} size={80}/>
                    <div style={{
                      fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                      fontSize: 11, fontWeight: 700, color: "#3a342a",
                    }}>Lv {String(lv).padStart(2,"0")}</div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// HERO — 6 tier-final badges, large, all animating
// ───────────────────────────────────────────────────────────
function HeroBoard() {
  return (
    <div style={{
      width: "100%", height: "100%", boxSizing: "border-box",
      padding: "60px 56px",
      background: "linear-gradient(160deg, #fbfaf6 0%, #f5eee0 60%, #f0e5d0 100%)",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif',
      color: "#1f1a14",
    }}>
      <div style={{
        fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
        color: "#8a8275", fontWeight: 600, marginBottom: 12,
      }}>Direction A · Final</div>
      <h1 style={{
        margin: "0 0 14px", fontSize: 44, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.05,
      }}>꽃잎이 피어나는<br/>뱃지</h1>
      <p style={{ margin: "0 0 48px", fontSize: 14, lineHeight: 1.6, color: "#5a5448", maxWidth: 540 }}>
        꽃잎은 천천히 회전하고 호흡합니다. 코어는 잔잔히 맥동하고, 별가루는 엇갈려 깜박이며,
        후광은 부드럽게 부풀어 오릅니다. 레벨업 순간엔 꽃이 새로 피어납니다.
      </p>

      {/* Tier final lineup at large size */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 16,
        padding: "44px 20px 36px",
        background: "rgba(255,255,255,0.7)",
        border: "1px solid #ece8e0", borderRadius: 18,
        backdropFilter: "blur(8px)",
      }}>
        {[5, 10, 15, 20, 25, 30].map((lv, i) => (
          <div key={lv} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <BloomBadge level={lv} size={96}/>
            <div style={{
              fontSize: 11, fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
              color: TIER_DOT[i + 1], fontWeight: 700, letterSpacing: "0.04em",
            }}>T{i + 1} · MAX</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{SOFT_TIERS[i].name}</div>
            <div style={{ fontSize: 10, color: "#8a8275" }}>{SOFT_TIERS[i].range}</div>
          </div>
        ))}
      </div>

      {/* Motion legend */}
      <div style={{
        marginTop: 32,
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12,
      }}>
        {[
          { k: "회전",    v: "꽃잎 ~28-90s" },
          { k: "호흡",    v: "스케일 ±6%" },
          { k: "맥동",    v: "코어 3.2s" },
          { k: "트윙클",  v: "별가루 2.4s, 스태거" },
        ].map(item => (
          <div key={item.k} style={{
            padding: "12px 14px",
            background: "rgba(255,255,255,0.7)",
            border: "1px solid #ece8e0", borderRadius: 10,
          }}>
            <div style={{
              fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
              color: "#8a8275", fontWeight: 600, marginBottom: 4,
            }}>{item.k}</div>
            <div style={{ fontSize: 12, color: "#3a342a", fontWeight: 500 }}>{item.v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// INTERACTIVE LEVEL-UP DEMO
// ───────────────────────────────────────────────────────────
function LevelUpDemo() {
  const [level, setLevel] = React.useState(1);
  const [burstKey, setBurstKey] = React.useState(0);
  const [auto, setAuto] = React.useState(false);
  const autoTimer = React.useRef(null);

  // Replay the bloom-in animation whenever level changes
  React.useEffect(() => { setBurstKey(k => k + 1); }, [level]);

  // Auto-cycle
  React.useEffect(() => {
    if (!auto) {
      if (autoTimer.current) clearInterval(autoTimer.current);
      return;
    }
    autoTimer.current = setInterval(() => {
      setLevel(l => l >= 30 ? 1 : l + 1);
    }, 1400);
    return () => autoTimer.current && clearInterval(autoTimer.current);
  }, [auto]);

  const t = tierOf(level);
  const meta = SOFT_TIERS[t - 1];
  const sub = subOf(level);
  const subLabel = ["core", "+ form", "+ dust", "+ gem", "+ aura"][sub - 1];

  const trigger = (delta) => {
    setAuto(false);
    setLevel(l => Math.max(1, Math.min(30, l + delta)));
  };
  const setTo = (lv) => { setAuto(false); setLevel(lv); };
  const replay = () => setBurstKey(k => k + 1);

  return (
    <div style={{
      width: "100%", height: "100%", boxSizing: "border-box",
      padding: "44px 48px",
      background: "linear-gradient(180deg, #fbfaf6 0%, #faf6ec 100%)",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif',
      color: "#1f1a14",
      display: "flex", flexDirection: "column",
    }}>
      <div style={{
        fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase",
        color: "#8a8275", fontWeight: 600, marginBottom: 8,
      }}>Interactive</div>
      <h2 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 600, letterSpacing: "-0.025em" }}>
        레벨업 데모
      </h2>
      <p style={{ margin: "0 0 28px", fontSize: 13, color: "#5a5448" }}>
        ▲/▼로 레벨을 바꾸거나 Auto로 자동 진행. 매 변경 시 꽃이 새로 피어납니다.
      </p>

      {/* Featured badge */}
      <div style={{
        flex: 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 56,
        padding: "32px",
        background: "rgba(255,255,255,0.65)",
        border: "1px solid #ece8e0",
        borderRadius: 18,
        marginBottom: 22,
        position: "relative",
      }}>
        {/* tier glow background */}
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(circle at 30% 50%, ${meta.glow}20, transparent 60%)`,
          borderRadius: 18,
          pointerEvents: "none",
          transition: "background 600ms ease",
        }}/>

        <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <BloomBadge level={level} size={180} burstKey={burstKey}/>
          <div style={{
            fontSize: 10, fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            color: meta.glow, fontWeight: 700, letterSpacing: "0.08em",
          }}>{meta.name.toUpperCase()}</div>
        </div>

        <div style={{ position: "relative", minWidth: 200 }}>
          <div style={{
            fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            fontSize: 13, color: "#8a8275", fontWeight: 600, marginBottom: 2,
          }}>LEVEL</div>
          <div style={{
            fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            fontSize: 84, fontWeight: 700, letterSpacing: "-0.04em",
            color: "#1f1a14", lineHeight: 1,
            marginBottom: 6,
          }}>{String(level).padStart(2, "0")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <span style={{
              fontSize: 11, fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
              fontWeight: 600, color: "#fff",
              padding: "3px 8px", borderRadius: 4,
              background: meta.glow,
            }}>T{t}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#3a342a" }}>{meta.name}</span>
            <span style={{ fontSize: 11, color: "#8a8275" }}>· {subLabel}</span>
          </div>

          {/* Sub-level progress */}
          <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{
                flex: 1, height: 4, borderRadius: 2,
                background: i <= sub ? meta.glow : "#e8e2d2",
                transition: "background 300ms ease",
              }}/>
            ))}
          </div>

          {/* Controls */}
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <button onClick={() => trigger(-1)} disabled={level <= 1} style={btnSecondary}>
              − Lv
            </button>
            <button onClick={() => trigger(+1)} disabled={level >= 30} style={btnPrimary}>
              + Lv
            </button>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={replay} style={btnSecondary}>↻ Replay</button>
            <button onClick={() => setAuto(a => !a)} style={auto ? btnActive : btnSecondary}>
              {auto ? "■ Stop" : "▶ Auto"}
            </button>
          </div>
        </div>
      </div>

      {/* Tier jump shortcuts */}
      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
        {[1,2,3,4,5,6].map(t => (
          <button key={t} onClick={() => setTo((t-1)*5 + 1)} style={{
            ...btnTier,
            color: TIER_DOT[t],
            borderColor: TIER_DOT[t] + "60",
            background: tierOf(level) === t ? TIER_DOT[t] + "20" : "transparent",
          }}>
            T{t} {SOFT_TIERS[t-1].name}
          </button>
        ))}
        <button onClick={() => setTo(30)} style={{
          ...btnTier,
          color: TIER_DOT[6],
          borderColor: TIER_DOT[6],
          background: level === 30 ? TIER_DOT[6] + "25" : "transparent",
          fontWeight: 700,
        }}>
          Lv 30
        </button>
      </div>
    </div>
  );
}

const btnBase = {
  flex: 1,
  padding: "11px 14px",
  border: "1px solid #ddd6c6",
  borderRadius: 8,
  fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  transition: "all 150ms ease",
};
const btnPrimary = {
  ...btnBase,
  background: "#1f1a14",
  color: "#faf6ec",
  borderColor: "#1f1a14",
};
const btnSecondary = {
  ...btnBase,
  background: "#fafaf6",
  color: "#3a342a",
};
const btnActive = {
  ...btnBase,
  background: "#9A7BFF",
  borderColor: "#9A7BFF",
  color: "#fff",
};
const btnTier = {
  padding: "6px 10px",
  border: "1px solid #d8cfb8",
  borderRadius: 6,
  fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.02em",
  background: "transparent",
  cursor: "pointer",
  transition: "all 150ms ease",
};

// ───────────────────────────────────────────────────────────
// FULL 30-LEVEL ANIMATED GRID
// ───────────────────────────────────────────────────────────
function FullGridBoard() {
  return (
    <div style={{
      width: "100%", height: "100%", boxSizing: "border-box",
      padding: "40px 44px",
      background: "linear-gradient(180deg, #fbfaf6 0%, #faf6ec 100%)",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif',
      color: "#1f1a14",
    }}>
      <div style={{
        fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase",
        color: "#8a8275", fontWeight: 600, marginBottom: 8,
      }}>30 Levels · Live Motion</div>
      <h2 style={{ margin: "0 0 6px", fontSize: 26, fontWeight: 600, letterSpacing: "-0.025em" }}>
        전체 30단계 진화
      </h2>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: "#5a5448" }}>
        모든 뱃지가 실시간으로 움직이고 있습니다. 티어가 올라갈수록 모션이 풍부해집니다.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {[1,2,3,4,5,6].map(tier => {
          const meta = SOFT_TIERS[tier - 1];
          return (
            <div key={tier} style={{
              padding: "18px 20px",
              background: "rgba(255,255,255,0.72)",
              border: "1px solid #ece8e0", borderRadius: 12,
            }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 10, fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                  fontWeight: 700, color: "#fff", letterSpacing: "0.04em",
                  padding: "3px 8px", borderRadius: 4,
                  background: TIER_DOT[tier],
                }}>T{tier}</span>
                <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>{meta.name}</span>
                <span style={{ fontSize: 11, color: "#8a8275" }}>{meta.range}</span>
                <span style={{ flex: 1 }}/>
                <span style={{
                  fontSize: 10, fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                  color: "#8a8275",
                }}>spin {BLOOM_MOTION[tier-1].spin}s · breathe {BLOOM_MOTION[tier-1].breathe}s</span>
              </div>
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8,
              }}>
                {[1,2,3,4,5].map(sub => {
                  const lv = (tier - 1) * 5 + sub;
                  return (
                    <div key={lv} style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                      padding: "12px 4px", borderRadius: 8,
                      background: sub === 5 ? "rgba(255, 245, 220, 0.55)" : "transparent",
                      border: sub === 5 ? "1px dashed #e8c478" : "1px dashed transparent",
                    }}>
                      <BloomBadge level={lv} size={56}/>
                      <div style={{
                        fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                        fontSize: 10, fontWeight: 600, color: "#3a342a",
                      }}>Lv {lv}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
// CONTEXT BOARD (light / dark)
// ───────────────────────────────────────────────────────────
function ContextBoard({ theme = "light" }) {
  const dark = theme === "dark";
  return (
    <div style={{
      width: "100%", height: "100%", boxSizing: "border-box",
      padding: "40px 44px",
      background: dark ? "#15131a" : "linear-gradient(180deg, #fbfaf6 0%, #faf6ec 100%)",
      color: dark ? "#f3eee5" : "#1f1a14",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif',
    }}>
      <div style={{
        fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase",
        color: dark ? "#9a8e9e" : "#8a8275", fontWeight: 600, marginBottom: 8,
      }}>실제 사용 · {theme}</div>
      <h3 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>
        실제 사용 컨텍스트
      </h3>
      <p style={{ margin: "0 0 22px", fontSize: 12, color: dark ? "#a89eb0" : "#7a7468" }}>
        모든 뱃지가 작은 사이즈에서도 살아 숨쉽니다.
      </p>

      {/* Profile cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
        {[
          { name: "강민준", lv: 4,  title: "씨앗 가꿈이" },
          { name: "이서연", lv: 9,  title: "이슬 정원사" },
          { name: "박지훈", lv: 14, title: "햇살 수호자" },
          { name: "최유나", lv: 19, title: "노을 사육사" },
          { name: "정도윤", lv: 24, title: "달빛 마법사" },
          { name: "한채은", lv: 30, title: "은하의 정원사" },
        ].map(u => (
          <div key={u.name} style={{
            padding: "12px 14px",
            background: dark ? "#1f1c26" : "rgba(255,255,255,0.7)",
            border: `1px solid ${dark ? "#2c2735" : "#ece8e0"}`,
            borderRadius: 12,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: dark ? "#2c2735" : "#ede5d5",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 600,
              color: dark ? "#e6dcc8" : "#5a5448",
            }}>{u.name[0]}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</span>
                <BloomBadge level={u.lv} size={18}/>
                <span style={{
                  fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                  fontSize: 11, fontWeight: 600,
                  color: dark ? "#a89eb0" : "#7a7468",
                }}>{u.lv}</span>
              </div>
              <div style={{
                fontSize: 11, color: dark ? "#8a8090" : "#8a8275", marginTop: 2,
              }}>{u.title}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Compact 5-col grid */}
      <div style={{
        padding: "16px 18px",
        background: dark ? "#1f1c26" : "rgba(255,255,255,0.7)",
        border: `1px solid ${dark ? "#2c2735" : "#ece8e0"}`,
        borderRadius: 12, marginBottom: 16,
      }}>
        <div style={{
          fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
          color: dark ? "#9a8e9e" : "#8a8275", fontWeight: 600, marginBottom: 10,
        }}>모든 레벨 · 20px</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px 12px" }}>
          {Array.from({ length: 30 }, (_, i) => i + 1).map(lv => (
            <div key={lv} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
              <BloomBadge level={lv} size={20}/>
              <span style={{
                fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                fontSize: 11, fontWeight: 600,
                color: dark ? "#d8cebc" : "#3a342a",
              }}>Lv {String(lv).padStart(2, "0")}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chat rows */}
      <div style={{
        padding: "8px 14px",
        background: dark ? "#1f1c26" : "rgba(255,255,255,0.7)",
        border: `1px solid ${dark ? "#2c2735" : "#ece8e0"}`,
        borderRadius: 12,
      }}>
        {[
          { name: "이서연", lv: 7,  msg: "오늘 출석 완료~" },
          { name: "박지훈", lv: 13, msg: "수정장미 키우는 분 있나요?" },
          { name: "최유나", lv: 18, msg: "햇무리 효과 너무 예뻐요" },
          { name: "정도윤", lv: 23, msg: "달빛 보너스 받았어요!" },
        ].map((u, i, arr) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 0",
            borderBottom: i < arr.length - 1 ? `1px solid ${dark ? "#262129" : "#f2eee5"}` : "none",
          }}>
            <BloomBadge level={u.lv} size={20}/>
            <span style={{ fontSize: 12, fontWeight: 600, color: dark ? "#e6dcc8" : "#3a342a" }}>{u.name}</span>
            <span style={{
              fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
              fontSize: 11, color: dark ? "#a89eb0" : "#7a7468",
            }}>·Lv{u.lv}</span>
            <span style={{ fontSize: 12, color: dark ? "#b0a8b8" : "#5a5448", marginLeft: 6 }}>{u.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────
function App() {
  return (
    <>
      <BadgeDefsV2/>
      <DesignCanvas>
        <DCSection id="sublevels" title="레벨 간 차이 확인" subtitle="한 티어 = 5단계 꽃 진화">
          <DCArtboard id="sublevels" label="Sub-level Progression" width={1100} height={920}>
            <SubLevelBoard/>
          </DCArtboard>
        </DCSection>

        <DCSection id="hero" title="Hero · 최종 라인업" subtitle="6 tier finals · 96px live">
          <DCArtboard id="hero" label="Hero · 시안 A 최종" width={1080} height={760}>
            <HeroBoard/>
          </DCArtboard>
        </DCSection>

        <DCSection id="demo" title="Interactive Level-Up" subtitle="레벨업 진입 애니메이션">
          <DCArtboard id="demo" label="Interactive Demo" width={780} height={780}>
            <LevelUpDemo/>
          </DCArtboard>
        </DCSection>

        <DCSection id="grid" title="전체 30 단계" subtitle="모두 실시간 모션">
          <DCArtboard id="grid" label="30 Levels · Live" width={780} height={1280}>
            <FullGridBoard/>
          </DCArtboard>
        </DCSection>

        <DCSection id="context" title="실제 사용" subtitle="라이트 / 다크">
          <DCArtboard id="ctx-light" label="Light" width={540} height={1100}>
            <ContextBoard theme="light"/>
          </DCArtboard>
          <DCArtboard id="ctx-dark" label="Dark" width={540} height={1100}>
            <ContextBoard theme="dark"/>
          </DCArtboard>
        </DCSection>
      </DesignCanvas>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
