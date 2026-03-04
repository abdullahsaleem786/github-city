import { useState, useEffect, useRef, useCallback } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────
const BUILDING_COLORS = [
  ["#1a1a2e", "#16213e", "#0f3460"],   // deep navy
  ["#2d1b69", "#11998e", "#38ef7d"],   // emerald tower
  ["#c94b4b", "#4b134f", "#c94b4b"],   // crimson
  ["#f7971e", "#ffd200", "#f7971e"],   // golden
  ["#1565c0", "#42a5f5", "#1565c0"],   // blue glass
  ["#4a0080", "#7b00d4", "#4a0080"],   // purple
  ["#00695c", "#26a69a", "#00695c"],   // teal
  ["#bf360c", "#ff7043", "#bf360c"],   // rust
];

const WINDOW_ON  = "#fffde7";
const WINDOW_OFF = "#1a1a2e";
const SKY_DAY    = ["#0f2027", "#203a43", "#2c5364"];
const GROUND_COL = "#0a0a0f";

function lerp(a, b, t) { return a + (b - a) * t; }

function getBuildingTier(commits) {
  if (commits === 0) return 0;
  if (commits <= 2)  return 1;
  if (commits <= 5)  return 2;
  if (commits <= 10) return 3;
  if (commits <= 20) return 4;
  return 5;
}

function getTierHeight(tier, slotH) {
  const ratios = [0, 0.12, 0.25, 0.42, 0.62, 0.85];
  return Math.round(slotH * ratios[tier]);
}

// ─── Canvas City Renderer ─────────────────────────────────────────────────────
function drawCity(canvas, weeks, tick) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  // Sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.75);
  sky.addColorStop(0,   "#020818");
  sky.addColorStop(0.5, "#0d1b3e");
  sky.addColorStop(1,   "#1a2a4a");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Stars
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  const starSeed = 42;
  for (let i = 0; i < 80; i++) {
    const sx = ((starSeed * (i * 7 + 3)) % W);
    const sy = ((starSeed * (i * 13 + 7)) % (H * 0.55));
    const twinkle = 0.4 + 0.6 * Math.sin(tick * 0.03 + i);
    ctx.globalAlpha = twinkle * 0.8;
    ctx.fillRect(sx, sy, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;

  // Moon
  const moonX = W * 0.85;
  const moonY = H * 0.1;
  const moonGlow = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, 40);
  moonGlow.addColorStop(0, "rgba(255,240,200,0.15)");
  moonGlow.addColorStop(1, "rgba(255,240,200,0)");
  ctx.fillStyle = moonGlow;
  ctx.beginPath(); ctx.arc(moonX, moonY, 40, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = "#fff8e1";
  ctx.beginPath(); ctx.arc(moonX, moonY, 14, 0, Math.PI*2); ctx.fill();

  // Ground
  const groundY = Math.round(H * 0.82);
  ctx.fillStyle = GROUND_COL;
  ctx.fillRect(0, groundY, W, H - groundY);

  // Road
  ctx.fillStyle = "#111118";
  ctx.fillRect(0, groundY + 4, W, 22);
  ctx.fillStyle = "#f9a825";
  for (let rx = (tick * 2) % 40 - 40; rx < W + 40; rx += 40) {
    ctx.fillRect(rx, groundY + 13, 20, 3);
  }

  // Buildings
  const totalWeeks = weeks.length;
  if (totalWeeks === 0) return;

  const padding   = 24;
  const gap       = 4;
  const slotW     = Math.max(8, Math.floor((W - padding * 2 - gap * (totalWeeks - 1)) / totalWeeks));
  const slotH     = groundY - padding;

  weeks.forEach((week, i) => {
    const totalCommits = week.reduce((s, d) => s + d, 0);
    const tier = getBuildingTier(totalCommits);
    if (tier === 0) return;

    const bh    = getTierHeight(tier, slotH);
    const bx    = padding + i * (slotW + gap);
    const by    = groundY - bh;
    const bw    = slotW;

    const palette = BUILDING_COLORS[i % BUILDING_COLORS.length];

    // Building shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(bx + 4, by + 4, bw, bh);

    // Building body gradient
    const bg = ctx.createLinearGradient(bx, by, bx + bw, by);
    bg.addColorStop(0, palette[0]);
    bg.addColorStop(0.5, palette[1]);
    bg.addColorStop(1, palette[2]);
    ctx.fillStyle = bg;
    ctx.fillRect(bx, by, bw, bh);

    // Windows
    if (bw >= 10 && bh >= 18) {
      const cols    = Math.max(1, Math.floor(bw / 9));
      const rows    = Math.max(1, Math.floor(bh / 12));
      const ww      = Math.max(3, Math.floor((bw - 4) / cols) - 2);
      const wh      = Math.max(3, Math.floor((bh - 4) / rows) - 2);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const wx = bx + 2 + c * (ww + 2);
          const wy = by + 2 + r * (wh + 2);
          // Window flicker based on tick + position
          const on = Math.sin(tick * 0.05 + r * 3.7 + c * 2.3 + i * 11) > -0.3;
          ctx.fillStyle = on ? WINDOW_ON : WINDOW_OFF;
          ctx.globalAlpha = on ? 0.9 : 0.3;
          ctx.fillRect(wx, wy, ww, wh);
        }
      }
      ctx.globalAlpha = 1;
    }

    // Rooftop details for tall buildings
    if (tier >= 4 && bw >= 12) {
      // Antenna
      ctx.strokeStyle = "#90a4ae";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bx + bw / 2, by);
      ctx.lineTo(bx + bw / 2, by - 12);
      ctx.stroke();
      // Blinking light
      const blink = Math.sin(tick * 0.12 + i) > 0;
      ctx.fillStyle = blink ? "#ff1744" : "#b71c1c";
      ctx.beginPath();
      ctx.arc(bx + bw / 2, by - 13, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Commit count badge on hover (always show for now on tall)
    if (tier >= 3) {
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      ctx.fillRect(bx, groundY, bw, 14);
      ctx.fillStyle = "#90caf9";
      ctx.font = `${Math.min(8, bw - 2)}px monospace`;
      ctx.textAlign = "center";
      ctx.fillText(totalCommits, bx + bw / 2, groundY + 10);
    }
  });

  // City reflection on road
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.scale(1, -0.18);
  ctx.translate(0, -groundY * (1 / 0.18) - groundY);
  weeks.forEach((week, i) => {
    const totalCommits = week.reduce((s, d) => s + d, 0);
    const tier = getBuildingTier(totalCommits);
    if (tier === 0) return;
    const bh = getTierHeight(tier, Math.round(H * 0.82) - padding);
    const bx = padding + i * ((Math.max(8, Math.floor((W - padding * 2 - gap * (weeks.length - 1)) / weeks.length))) + gap);
    const by = Math.round(H * 0.82) - bh;
    const bw = Math.max(8, Math.floor((W - padding * 2 - gap * (weeks.length - 1)) / weeks.length));
    ctx.fillStyle = "#fff";
    ctx.fillRect(bx, by, bw, bh);
  });
  ctx.restore();

  // Foreground overlay gradient
  const fog = ctx.createLinearGradient(0, groundY - 30, 0, H);
  fog.addColorStop(0, "rgba(10,10,20,0)");
  fog.addColorStop(1, "rgba(10,10,20,0.85)");
  ctx.fillStyle = fog;
  ctx.fillRect(0, groundY - 30, W, H - groundY + 30);
}

// ─── Mock/Real data fetcher ───────────────────────────────────────────────────
async function fetchContributions(username) {
  // Use GitHub's public contribution calendar API via a CORS proxy
  const url = `https://github-contributions-api.jogruber.de/v4/${username}?y=last`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("User not found or API error");
  const data = await res.json();

  // Group by week (each week = array of 7 day commit counts)
  const weeks = [];
  const days = data.contributions || [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7).map(d => d.count));
  }
  return { weeks, total: data.total?.lastYear ?? days.reduce((s, d) => s + d.count, 0) };
}

function generateMockData(seed = 1) {
  const weeks = [];
  for (let w = 0; w < 52; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const r = Math.abs(Math.sin(seed * w * 7 + d + 13)) ;
      week.push(r > 0.6 ? Math.floor(r * 18) : 0);
    }
    weeks.push(week);
  }
  return { weeks, total: weeks.flat().reduce((a, b) => a + b, 0) };
}

// ─── Stat badge ──────────────────────────────────────────────────────────────
function StatBadge({ label, value, color }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 10,
      padding: "8px 16px",
      textAlign: "center",
      minWidth: 80,
    }}>
      <div style={{ color, fontSize: 22, fontWeight: 800, fontFamily: "'Courier New', monospace" }}>{value}</div>
      <div style={{ color: "#607d8b", fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function GitHubCity() {
  const canvasRef   = useRef(null);
  const tickRef     = useRef(0);
  const rafRef      = useRef(null);
  const [username,  setUsername]  = useState("");
  const [inputVal,  setInputVal]  = useState("");
  const [weeks,     setWeeks]     = useState([]);
  const [stats,     setStats]     = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");
  const [mode,      setMode]      = useState("demo"); // "demo" | "real"

  // Load demo on mount
  useEffect(() => {
    const demo = generateMockData(42);
    setWeeks(demo.weeks);
    setStats({ total: demo.total, weeks: demo.weeks.filter(w => w.some(d => d > 0)).length, peak: Math.max(...demo.weeks.map(w => w.reduce((a,b)=>a+b,0))) });
  }, []);

  // Animation loop
  const animate = useCallback(() => {
    tickRef.current += 1;
    const canvas = canvasRef.current;
    if (canvas && weeks.length > 0) {
      drawCity(canvas, weeks, tickRef.current);
    }
    rafRef.current = requestAnimationFrame(animate);
  }, [weeks]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate]);

  // Resize canvas
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      canvas.width  = parent.offsetWidth;
      canvas.height = parent.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const handleFetch = async () => {
    if (!inputVal.trim()) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchContributions(inputVal.trim());
      setWeeks(data.weeks);
      setUsername(inputVal.trim());
      setMode("real");
      setStats({
        total: data.total,
        weeks: data.weeks.filter(w => w.some(d => d > 0)).length,
        peak:  Math.max(...data.weeks.map(w => w.reduce((a,b)=>a+b,0))),
      });
    } catch (e) {
      setError("Could not load data. Check the username or try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = () => {
    const seeds = [42, 7, 99, 13];
    const s = seeds[Math.floor(Math.random() * seeds.length)];
    const demo = generateMockData(s);
    setWeeks(demo.weeks);
    setUsername("demo");
    setMode("demo");
    setStats({ total: demo.total, weeks: demo.weeks.filter(w => w.some(d => d > 0)).length, peak: Math.max(...demo.weeks.map(w => w.reduce((a,b)=>a+b,0))) });
    setError("");
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080c14",
      fontFamily: "'Segoe UI', sans-serif",
      color: "#e0e0e0",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    }}>
      {/* Header */}
      <div style={{ width: "100%", maxWidth: 900, padding: "28px 24px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 4 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10,
            background: "linear-gradient(135deg,#1565c0,#42a5f5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22,
          }}>🏙️</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: -0.5,
              background: "linear-gradient(90deg,#42a5f5,#80cbc4,#fff176)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              GitHub City
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: "#546e7a", letterSpacing: 1 }}>
              YOUR COMMITS BUILD YOUR SKYLINE
            </p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <a href="https://github.com" target="_blank" rel="noreferrer"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8, padding: "6px 14px", color: "#90a4ae", fontSize: 12,
                textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
              ⭐ Star on GitHub
            </a>
          </div>
        </div>

        {/* Input */}
        <div style={{ display: "flex", gap: 10, margin: "22px 0 16px", flexWrap: "wrap" }}>
          <input
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleFetch()}
            placeholder="Enter GitHub username..."
            style={{
              flex: 1, minWidth: 200,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 10, padding: "11px 16px",
              color: "#e0e0e0", fontSize: 15, outline: "none",
            }}
          />
          <button onClick={handleFetch} disabled={loading}
            style={{
              background: loading ? "#1a2a4a" : "linear-gradient(135deg,#1565c0,#42a5f5)",
              border: "none", borderRadius: 10, padding: "11px 22px",
              color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
              opacity: loading ? 0.7 : 1,
            }}>
            {loading ? "⏳ Loading..." : "🏗️ Build City"}
          </button>
          <button onClick={handleDemo}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 10, padding: "11px 18px",
              color: "#90a4ae", fontSize: 14, cursor: "pointer",
            }}>
            🎲 Random Demo
          </button>
        </div>

        {error && (
          <div style={{ background: "rgba(198,40,40,0.15)", border: "1px solid #c62828",
            borderRadius: 8, padding: "10px 16px", marginBottom: 12, color: "#ef9a9a", fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            <StatBadge label="Total Commits" value={stats.total.toLocaleString()} color="#42a5f5" />
            <StatBadge label="Active Weeks"  value={stats.weeks} color="#80cbc4" />
            <StatBadge label="Peak Week"     value={stats.peak}  color="#fff176" />
            <StatBadge label="Mode" value={mode === "demo" ? "Demo" : `@${username}`} color="#ce93d8" />
          </div>
        )}
      </div>

      {/* City Canvas */}
      <div style={{
        width: "100%", maxWidth: 900,
        padding: "0 24px 24px",
        flex: 1,
      }}>
        <div style={{
          position: "relative",
          width: "100%", height: 400,
          borderRadius: 18,
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}>
          <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
          {weeks.length === 0 && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center",
              justifyContent: "center", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 40 }}>🏙️</div>
              <div style={{ color: "#546e7a" }}>Enter a GitHub username to build your city</div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap", justifyContent: "center" }}>
          {[
            { tier: 0, label: "No commits", h: 8  },
            { tier: 1, label: "1–2",  h: 14 },
            { tier: 2, label: "3–5",  h: 22 },
            { tier: 3, label: "6–10", h: 32 },
            { tier: 4, label: "11–20",h: 44 },
            { tier: 5, label: "21+",  h: 58 },
          ].map(({ tier, label, h }) => (
            <div key={tier} style={{ display: "flex", alignItems: "flex-end", gap: 5,
              background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "6px 10px" }}>
              <div style={{
                width: 10, height: h,
                background: tier === 0
                  ? "rgba(255,255,255,0.08)"
                  : `linear-gradient(to top, ${BUILDING_COLORS[tier % BUILDING_COLORS.length][0]}, ${BUILDING_COLORS[tier % BUILDING_COLORS.length][1]})`,
                borderRadius: 2,
              }} />
              <span style={{ fontSize: 11, color: "#607d8b" }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 18, color: "#37474f", fontSize: 12 }}>
          Open source · MIT License · Built with GitHub Contributions API
          <br />
          <span style={{ color: "#455a64" }}>
            ⚠️ Note: Due to CORS, real data requires the backend proxy. Demo mode works offline.
          </span>
        </div>
      </div>
    </div>
  );
}
