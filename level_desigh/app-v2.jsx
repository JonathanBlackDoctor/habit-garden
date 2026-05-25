// app-v2.jsx — Soft direction showcase canvas

const TIER_DOT = {
  1: "#9CB0BC", 2: "#E89AB0", 3: "#E8B23A",
  4: "#FF9E7A", 5: "#9A7BFF", 6: "#7A5DD8",
};

// ───────────────────────────────────────────────────────────
function TierRow({ tier }) {
  const m = SOFT_TIERS[tier - 1];
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
      <span style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontSize: 10, fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
        fontWeight: 600, color: "#5a5448", letterSpacing: "0.04em",
        padding: "3px 8px", borderRadius: 4,
        background: m.glow + "20",
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: m.glow }}/>
        T{tier}
      </span>
      <span style={{ fontSize: 14, fontWeight: 600, color: "#1f1a14", letterSpacing: "-0.01em" }}>{m.name}</span>
      <span style={{ fontSize: 11, color: "#8a8275" }}>{m.range}</span>
    </div>
  );
}

// One direction artboard — header, tier strip, per-tier rows
function DirectionBoardV2({ kicker, title, description, Badge, accent = "#1f1a14" }) {
  return (
    <div style={{
      padding: "36px 40px 40px",
      background: "linear-gradient(180deg, #fbfaf6 0%, #faf6ec 100%)",
      width: "100%", height: "100%", boxSizing: "border-box",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif',
      color: "#1f1a14", overflow: "hidden",
    }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase",
          color: "#8a8275", fontWeight: 600, marginBottom: 8,
        }}>{kicker}</div>
        <h2 style={{ margin: 0, fontSize: 30, fontWeight: 600, letterSpacing: "-0.025em", color: accent }}>{title}</h2>
        <p style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.55, color: "#5a5448", maxWidth: 540 }}>{description}</p>
      </div>

      {/* Tier-final highlight strip — last level of each tier at big size */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10,
        padding: "22px 12px",
        background: "rgba(255,255,255,0.7)",
        border: "1px solid #ece8e0", borderRadius: 14,
        marginBottom: 28,
        backdropFilter: "blur(8px)",
      }}>
        {[5, 10, 15, 20, 25, 30].map((lv, i) => (
          <div key={lv} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <Badge level={lv} size={64}/>
            <div style={{
              fontSize: 10, fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
              color: TIER_DOT[i + 1], fontWeight: 700,
            }}>T{i + 1} · MAX</div>
            <div style={{ fontSize: 10, color: "#8a8275" }}>{SOFT_TIERS[i].name}</div>
          </div>
        ))}
      </div>

      {/* 6 tier rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {[1, 2, 3, 4, 5, 6].map(tier => (
          <div key={tier} style={{
            padding: "16px 18px",
            background: "rgba(255,255,255,0.7)",
            border: "1px solid #ece8e0", borderRadius: 12,
          }}>
            <TierRow tier={tier}/>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8,
              alignItems: "center",
            }}>
              {[1, 2, 3, 4, 5].map(sub => {
                const lv = (tier - 1) * 5 + sub;
                return (
                  <div key={lv} style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                    padding: "10px 4px", borderRadius: 8,
                    background: sub === 5 ? "rgba(255, 245, 220, 0.5)" : "transparent",
                    border: sub === 5 ? "1px dashed #e8c478" : "1px dashed transparent",
                  }}>
                    <Badge level={lv} size={48}/>
                    <div style={{
                      fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                      fontSize: 10, fontWeight: 600, color: "#3a342a",
                    }}>Lv {lv}</div>
                    <div style={{ fontSize: 9, color: "#8a8275" }}>
                      {sub === 1 && "core"}
                      {sub === 2 && "+ form"}
                      {sub === 3 && "+ dust"}
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

// "Real use" artboard — tiny in-list usage
function ActualBoardV2({ Badge, title, theme = "light" }) {
  const dark = theme === "dark";
  return (
    <div style={{
      width: "100%", height: "100%", boxSizing: "border-box",
      padding: "36px 40px",
      background: dark ? "#15131a" : "linear-gradient(180deg, #fbfaf6 0%, #faf6ec 100%)",
      color: dark ? "#f3eee5" : "#1f1a14",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif',
    }}>
      <div style={{
        fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase",
        color: dark ? "#9a8e9e" : "#8a8275", fontWeight: 600, marginBottom: 8,
      }}>실제 사용 · {theme}</div>
      <h3 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em" }}>{title}</h3>
      <p style={{ margin: "0 0 22px", fontSize: 12, color: dark ? "#a89eb0" : "#7a7468" }}>
        리더보드·프로필·도감에서 레벨 옆에 붙는 사이즈
      </p>

      {/* Profile cards — Korean test data */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
        marginBottom: 18,
      }}>
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
                <Badge level={u.lv} size={18}/>
                <span style={{
                  fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                  fontSize: 11, fontWeight: 600,
                  color: dark ? "#a89eb0" : "#7a7468",
                }}>{u.lv}</span>
              </div>
              <div style={{
                fontSize: 11, color: dark ? "#8a8090" : "#8a8275",
                marginTop: 2,
              }}>{u.title}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Compact level chips */}
      <div style={{
        padding: "16px 18px",
        background: dark ? "#1f1c26" : "rgba(255,255,255,0.7)",
        border: `1px solid ${dark ? "#2c2735" : "#ece8e0"}`,
        borderRadius: 12,
        marginBottom: 16,
      }}>
        <div style={{
          fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
          color: dark ? "#9a8e9e" : "#8a8275", fontWeight: 600, marginBottom: 10,
        }}>모든 레벨 · 20px</div>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px 12px",
        }}>
          {Array.from({ length: 30 }, (_, i) => i + 1).map(lv => (
            <div key={lv} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "4px 0",
            }}>
              <Badge level={lv} size={20}/>
              <span style={{
                fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                fontSize: 11, fontWeight: 600,
                color: dark ? "#d8cebc" : "#3a342a",
              }}>Lv {String(lv).padStart(2, "0")}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Inline chat-style rows */}
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
            <Badge level={u.lv} size={20}/>
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

// Intro board
function IntroBoardV2() {
  return (
    <div style={{
      width: "100%", height: "100%", boxSizing: "border-box",
      padding: "52px 44px",
      background: "linear-gradient(160deg, #fbfaf6 0%, #f5eee0 60%, #f0e5d0 100%)",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif',
      color: "#1f1a14",
    }}>
      <div style={{
        fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase",
        color: "#8a8275", fontWeight: 600, marginBottom: 12,
      }}>Soft Edition · v2</div>
      <h1 style={{
        margin: "0 0 16px", fontSize: 38, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.1,
      }}>은은하고<br/>고급스러운 뱃지</h1>
      <p style={{ margin: "0 0 24px", fontSize: 14, lineHeight: 1.6, color: "#5a5448", maxWidth: 460 }}>
        식물 도감의 부드러운 그라데이션·소프트 후광·작은 별가루를
        뱃지에 옮긴 4가지 시안. 같은 6티어·5단계 구조를 따릅니다.
      </p>

      {/* Tier swatches with sample badge */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
        {SOFT_TIERS.map((p, i) => (
          <div key={p.id} style={{
            display: "flex", alignItems: "center", gap: 16,
            padding: "12px 14px",
            background: "rgba(255,255,255,0.7)",
            border: "1px solid #ece8e0", borderRadius: 10,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: `radial-gradient(circle at 35% 30%, ${p.c1}, ${p.c2} 50%, ${p.c3})`,
              boxShadow: `0 2px 8px ${p.glow}30`,
            }}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{p.name}</div>
              <div style={{
                fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                fontSize: 10, color: "#8a8275", marginTop: 2,
                display: "flex", gap: 8,
              }}>
                <span>{p.c1}</span>
                <span>·</span>
                <span>{p.c2}</span>
                <span>·</span>
                <span>{p.c3}</span>
              </div>
            </div>
            <div style={{
              fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
              fontSize: 11, color: "#8a8275",
            }}>{p.range}</div>
          </div>
        ))}
      </div>

      {/* Direction summary */}
      <div style={{
        padding: "16px 18px",
        background: "rgba(255,255,255,0.7)",
        border: "1px dashed #d8cfb8", borderRadius: 10,
        fontSize: 12, lineHeight: 1.6, color: "#5a5448",
      }}>
        <strong style={{ color: "#1f1a14", display: "block", marginBottom: 8 }}>4 directions</strong>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 12px" }}>
          <span style={{ fontWeight: 600, color: "#3a342a" }}>Bloom</span>
          <span>꽃잎이 둘러싼 코어 — 가장 유기적</span>
          <span style={{ fontWeight: 600, color: "#3a342a" }}>Halo</span>
          <span>중앙 오브 + 느리게 도는 광선 — 신성한 느낌</span>
          <span style={{ fontWeight: 600, color: "#3a342a" }}>Crystal</span>
          <span>보석 컷 실루엣 + 면 분할 — 클래식 보석</span>
          <span style={{ fontWeight: 600, color: "#3a342a" }}>Orbit</span>
          <span>코어 + 궤도 입자 — 가장 우주적</span>
        </div>
      </div>
    </div>
  );
}

// Compare board — same level, 4 directions side by side
function CompareBoardV2() {
  const dirs = [
    { id: "bloom",   title: "Bloom",   Badge: BloomBadge,   note: "유기적·정원 도감 느낌" },
    { id: "halo",    title: "Halo",    Badge: HaloBadge,    note: "성스럽고 잔잔한 빛" },
    { id: "crystal", title: "Crystal", Badge: CrystalBadge, note: "보석 컷·면 분할" },
    { id: "orbit",   title: "Orbit",   Badge: OrbitBadge,   note: "우주·궤도 미감" },
  ];
  const levels = [1, 5, 10, 15, 20, 25, 30];
  return (
    <div style={{
      width: "100%", height: "100%", boxSizing: "border-box",
      padding: "36px 40px",
      background: "linear-gradient(180deg, #fbfaf6 0%, #faf6ec 100%)",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif',
      color: "#1f1a14",
    }}>
      <div style={{
        fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase",
        color: "#8a8275", fontWeight: 600, marginBottom: 8,
      }}>Side-by-side</div>
      <h2 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 600, letterSpacing: "-0.025em" }}>
        4 시안 직접 비교
      </h2>
      <p style={{ margin: "0 0 28px", fontSize: 13, color: "#5a5448" }}>
        티어 진입점·완성점에서 네 시안의 분위기를 동시에 비교합니다.
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: `220px repeat(${levels.length}, 1fr)`,
        border: "1px solid #ece8e0", borderRadius: 12,
        overflow: "hidden",
        background: "rgba(255,255,255,0.7)",
      }}>
        <div style={{
          padding: "14px 18px", background: "#fafaf6",
          borderBottom: "1px solid #ece8e0", borderRight: "1px solid #ece8e0",
          fontSize: 11, fontWeight: 600, color: "#8a8275",
          textTransform: "uppercase", letterSpacing: "0.08em",
        }}>Direction</div>
        {levels.map(lv => (
          <div key={lv} style={{
            padding: "14px 8px", background: "#fafaf6",
            borderBottom: "1px solid #ece8e0", borderRight: "1px solid #ece8e0",
            fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
            fontSize: 11, fontWeight: 700,
            color: TIER_DOT[tierOf(lv)],
            textAlign: "center",
          }}>
            Lv {lv}
            <div style={{ fontSize: 9, color: "#8a8275", fontWeight: 500, marginTop: 2 }}>
              {SOFT_TIERS[tierOf(lv) - 1].name}
            </div>
          </div>
        ))}
        {dirs.map((d, di) => (
          <React.Fragment key={d.id}>
            <div style={{
              padding: "20px 18px",
              borderBottom: di < dirs.length - 1 ? "1px solid #ece8e0" : "none",
              borderRight: "1px solid #ece8e0",
              display: "flex", flexDirection: "column", justifyContent: "center",
            }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{d.title}</div>
              <div style={{ fontSize: 11, color: "#8a8275", marginTop: 3 }}>{d.note}</div>
            </div>
            {levels.map(lv => (
              <div key={lv} style={{
                padding: "18px 8px",
                borderBottom: di < dirs.length - 1 ? "1px solid #ece8e0" : "none",
                borderRight: "1px solid #ece8e0",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
              }}>
                <d.Badge level={lv} size={52}/>
                <d.Badge level={lv} size={22}/>
              </div>
            ))}
          </React.Fragment>
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
        <DCSection id="intro" title="시스템" subtitle="6 tiers × 5 sub-levels · soft palette">
          <DCArtboard id="overview" label="System Overview" width={580} height={900}>
            <IntroBoardV2/>
          </DCArtboard>
        </DCSection>

        <DCSection id="bloom" title="A · Bloom" subtitle="꽃잎 클러스터 · 가장 유기적">
          <DCArtboard id="bloom-detail" label="A · 30 레벨 진화" width={780} height={1380}>
            <DirectionBoardV2
              kicker="Direction A — Bloom"
              title="꽃잎 클러스터"
              description="도감의 꽃에서 직접 차용한 꽃잎 배열. 티어마다 꽃잎 갯수·구성이 달라지며, 세부 레벨에선 별가루·중앙 보석·후광이 차례로 더해집니다."
              Badge={BloomBadge}
            />
          </DCArtboard>
          <DCArtboard id="bloom-actual" label="A · 실제 사용" width={540} height={1380}>
            <ActualBoardV2 Badge={BloomBadge} title="Bloom in context"/>
          </DCArtboard>
          <DCArtboard id="bloom-dark" label="A · Dark" width={540} height={1380}>
            <ActualBoardV2 Badge={BloomBadge} title="Bloom — Dark" theme="dark"/>
          </DCArtboard>
        </DCSection>

        <DCSection id="halo" title="B · Halo" subtitle="중앙 오브 + 광선 · 신성한 잔잔함">
          <DCArtboard id="halo-detail" label="B · 30 레벨 진화" width={780} height={1380}>
            <DirectionBoardV2
              kicker="Direction B — Halo"
              title="햇무리 / 후광"
              description="한 점의 빛에서 시작해 광선이 늘어나는 구조. 광선은 천천히 회전하고 후광은 은은하게 맥동합니다. 4개 시안 중 가장 잔잔하고 미니멀한 톤."
              Badge={HaloBadge}
            />
          </DCArtboard>
          <DCArtboard id="halo-actual" label="B · 실제 사용" width={540} height={1380}>
            <ActualBoardV2 Badge={HaloBadge} title="Halo in context"/>
          </DCArtboard>
          <DCArtboard id="halo-dark" label="B · Dark" width={540} height={1380}>
            <ActualBoardV2 Badge={HaloBadge} title="Halo — Dark" theme="dark"/>
          </DCArtboard>
        </DCSection>

        <DCSection id="crystal" title="C · Crystal" subtitle="보석 컷 · 클래식 럭셔리">
          <DCArtboard id="crystal-detail" label="C · 30 레벨 진화" width={780} height={1380}>
            <DirectionBoardV2
              kicker="Direction C — Crystal"
              title="보석 컷"
              description="원형·오벌·마키즈·페어·브릴리언트·헥사 — 티어마다 보석 컷이 바뀝니다. 세부 레벨에선 면 분할 라인, 별가루, 내부 하이라이트, 후광이 더해집니다."
              Badge={CrystalBadge}
            />
          </DCArtboard>
          <DCArtboard id="crystal-actual" label="C · 실제 사용" width={540} height={1380}>
            <ActualBoardV2 Badge={CrystalBadge} title="Crystal in context"/>
          </DCArtboard>
          <DCArtboard id="crystal-dark" label="C · Dark" width={540} height={1380}>
            <ActualBoardV2 Badge={CrystalBadge} title="Crystal — Dark" theme="dark"/>
          </DCArtboard>
        </DCSection>

        <DCSection id="orbit" title="D · Orbit" subtitle="코어 + 궤도 입자 · 우주적">
          <DCArtboard id="orbit-detail" label="D · 30 레벨 진화" width={780} height={1380}>
            <DirectionBoardV2
              kicker="Direction D — Orbit"
              title="궤도 / 천체"
              description="중앙 빛 코어 주변을 입자가 천천히 회전합니다. 티어가 오를수록 궤도가 늘어나고 입자가 조밀해져, 최종 단계에선 작은 은하처럼 보입니다."
              Badge={OrbitBadge}
            />
          </DCArtboard>
          <DCArtboard id="orbit-actual" label="D · 실제 사용" width={540} height={1380}>
            <ActualBoardV2 Badge={OrbitBadge} title="Orbit in context"/>
          </DCArtboard>
          <DCArtboard id="orbit-dark" label="D · Dark" width={540} height={1380}>
            <ActualBoardV2 Badge={OrbitBadge} title="Orbit — Dark" theme="dark"/>
          </DCArtboard>
        </DCSection>

        <DCSection id="compare" title="4 시안 직접 비교" subtitle="같은 레벨 · 다른 표현">
          <DCArtboard id="compare-v2" label="Side-by-side" width={1020} height={780}>
            <CompareBoardV2/>
          </DCArtboard>
        </DCSection>
      </DesignCanvas>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
