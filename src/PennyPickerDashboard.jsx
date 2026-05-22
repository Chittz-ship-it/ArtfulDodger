import { useState, useCallback } from "react";

// ─── Alpha Vantage ────────────────────────────────────────────────────────────
const AV_BASE = "https://www.alphavantage.co/query";

// ─── Wider universe to scan — top 5 survivors get returned ───────────────────
const UNIVERSE = [
  "SNDL","CLOV","ATER","BBIG","AABB","GFAI","MULN","FFIE","HCDI","ILUS",
  "MINE","AQMS","ABOS","BFRI","CLSK","CRIS","DPRO","EDSA","ENOB","EOSE",
  "IDEX","IMPP","KPLT","LIQT","MEGL","MNMD","NKLA","PHIO","PRVB","RAIL",
];

// ─── Signal + conviction engine ───────────────────────────────────────────────
function analyze(sym, quote) {
  const price  = parseFloat(quote["05. price"]) || 0;
  const open   = parseFloat(quote["02. open"]) || price;
  const high   = parseFloat(quote["03. high"]) || price;
  const low    = parseFloat(quote["04. low"]) || price;
  const prev   = parseFloat(quote["08. previous close"]) || price;
  const vol    = parseInt(quote["06. volume"]) || 0;
  const pct    = parseFloat(quote["10. change percent"]?.replace("%","")) || 0;

  const range  = high - low || 0.0001;
  const body   = price - open;

  // ── DISQUALIFY: party already over ───────────────────────────────────────
  // 1. Already ran hard and now retreating from high
  const fromHigh = (high - price) / range;
  if (fromHigh > 0.35) return null; // rolled over >35% from high — skip

  // 2. Massive gap already happened — you're too late
  if (pct > 20) return null; // already up >20% — tail risk

  // 3. Price below open — trending wrong direction
  if (price < open) return null;

  // 4. Tiny volume — nobody's at the party
  if (vol < 400000) return null;

  // 5. Price must be under $5
  if (price > 5) return null;
  if (price <= 0) return null;

  // ── SIGNALS ───────────────────────────────────────────────────────────────
  const signals = [];

  // Breakout: near high but NOT already peaked
  const nearHigh = (price / high) >= 0.95;
  if (nearHigh) signals.push({ label: "BREAKOUT", color: "#00ff88", weight: 3 });

  // Momentum: moving but not exhausted
  const momentum = pct >= 3 && pct <= 20;
  if (momentum) signals.push({ label: "MOMENTUM", color: "#ffd700", weight: 2 });

  // Volume spike: crowd is entering
  const volSpike = vol > 700000;
  if (volSpike) signals.push({ label: "VOL SPIKE", color: "#ff6b35", weight: 2 });

  // Still climbing: price above open and above midpoint of range
  const midRange = low + range * 0.5;
  const climbing = price > open && price > midRange;
  if (climbing) signals.push({ label: "CLIMBING", color: "#a78bfa", weight: 2 });

  // Fresh start: didn't gap up massively from yesterday (room left)
  const gapFromPrev = ((open - prev) / prev) * 100;
  const freshStart = gapFromPrev < 8;
  if (freshStart) signals.push({ label: "FRESH", color: "#60a5fa", weight: 1 });

  // ── SCORE ─────────────────────────────────────────────────────────────────
  const score = signals.reduce((a, s) => a + s.weight, 0);

  // Must have at least 3 signals and score 6+ to qualify
  if (signals.length < 3) return null;
  if (score < 6) return null;

  // ── Position in range (0=at low, 1=at high) ───────────────────────────────
  const rangePos = (price - low) / range;

  return { sym, price, open, high, low, vol, pct, prev, signals, score, rangePos, fromHigh };
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Barlow+Condensed:wght@300;400;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:     #05080b;
    --panel:  #0a0f15;
    --border: #151f2a;
    --green:  #00ff88;
    --red:    #ff3355;
    --gold:   #ffcc00;
    --purple: #a78bfa;
    --blue:   #38bdf8;
    --dim:    #2a4055;
    --muted:  #4a6880;
    --text:   #b8ccd8;
    --mono:   'Space Mono', monospace;
    --display:'Barlow Condensed', sans-serif;
  }

  html, body { height: 100%; background: var(--bg); color: var(--text); font-family: var(--mono); }

  .app {
    min-height: 100vh;
    background:
      radial-gradient(ellipse 60% 30% at 50% 0%, rgba(0,255,136,0.06) 0%, transparent 60%),
      var(--bg);
  }

  /* ── Header ── */
  .hdr {
    padding: 18px 28px;
    border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
    background: rgba(10,15,21,0.95);
    backdrop-filter: blur(16px);
    position: sticky; top: 0; z-index: 100;
  }
  .logo {
    font-family: var(--display); font-size: 2.4rem; font-weight: 800;
    letter-spacing: 6px; color: var(--green);
    text-shadow: 0 0 30px rgba(0,255,136,0.4);
  }
  .logo em { color: var(--dim); font-style: normal; }
  .sub {
    font-size: 0.55rem; letter-spacing: 3px; color: var(--muted);
    margin-top: 1px; font-family: var(--mono);
  }

  /* ── API bar ── */
  .api-row { display: flex; gap: 8px; align-items: center; }
  .api-in {
    background: rgba(255,255,255,0.03); border: 1px solid var(--border);
    color: var(--text); font-family: var(--mono); font-size: 0.7rem;
    padding: 9px 12px; border-radius: 3px; width: 200px; outline: none;
    transition: border .2s;
  }
  .api-in::placeholder { color: var(--dim); }
  .api-in:focus { border-color: rgba(0,255,136,0.4); }

  .btn {
    font-family: var(--display); font-weight: 700; letter-spacing: 2px;
    font-size: 0.85rem; padding: 9px 20px; border: none; border-radius: 3px;
    cursor: pointer; transition: all .2s; white-space: nowrap;
  }
  .btn-save { background: transparent; border: 1px solid var(--border); color: var(--muted); font-size: 0.7rem; font-family: var(--mono); }
  .btn-save:hover { border-color: var(--muted); color: var(--text); }
  .btn-scan {
    background: var(--green); color: #000;
    box-shadow: 0 0 20px rgba(0,255,136,0.25);
  }
  .btn-scan:hover { background: #00e87a; box-shadow: 0 0 30px rgba(0,255,136,0.5); transform: translateY(-1px); }
  .btn-scan:disabled { background: var(--dim); color: #0a0f15; cursor: not-allowed; box-shadow: none; transform: none; }

  /* ── Status ── */
  .status {
    padding: 7px 28px; background: rgba(0,0,0,0.5);
    border-bottom: 1px solid var(--border);
    display: flex; gap: 20px; align-items: center;
    font-size: 0.6rem; letter-spacing: 1.5px; color: var(--muted);
  }
  .dot { width: 5px; height: 5px; border-radius: 50%; background: var(--dim); display: inline-block; margin-right: 5px; }
  .dot.live { background: var(--green); box-shadow: 0 0 6px var(--green); animation: blink 1.5s infinite; }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
  .err { color: var(--red); margin-left: auto; }

  /* ── Main ── */
  .main { padding: 24px 28px; max-width: 900px; margin: 0 auto; }

  /* ── Progress ── */
  .prog-wrap { margin-bottom: 20px; }
  .prog-bar { height: 1px; background: var(--border); }
  .prog-fill { height: 100%; background: var(--green); transition: width .4s ease; box-shadow: 0 0 8px var(--green); }
  .prog-label { font-size: 0.58rem; color: var(--muted); margin-top: 6px; letter-spacing: 1px; }

  /* ── Empty state ── */
  .empty {
    text-align: center; padding: 100px 20px;
  }
  .empty-title {
    font-family: var(--display); font-size: 5rem; font-weight: 800;
    color: var(--border); letter-spacing: 8px; line-height: 1;
    margin-bottom: 20px;
  }
  .empty-sub { font-size: 0.65rem; color: var(--muted); letter-spacing: 2px; line-height: 2; }
  .empty-rules {
    margin: 24px auto; max-width: 340px; text-align: left;
    background: var(--panel); border: 1px solid var(--border);
    border-radius: 4px; padding: 16px 20px;
  }
  .empty-rules li {
    font-size: 0.62rem; color: var(--muted); letter-spacing: 1px;
    line-height: 2.2; list-style: none; padding-left: 0;
    border-bottom: 1px solid var(--border);
  }
  .empty-rules li:last-child { border-bottom: none; }
  .empty-rules li span { color: var(--green); margin-right: 8px; }

  /* ── Cards ── */
  .cards { display: flex; flex-direction: column; gap: 12px; }

  .card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 20px 24px;
    position: relative;
    overflow: hidden;
    cursor: pointer;
    transition: border-color .2s, transform .15s;
    animation: fadeUp .3s ease both;
  }
  .card:hover { border-color: rgba(0,255,136,0.2); transform: translateY(-1px); }
  .card.rank-1 { border-color: rgba(0,255,136,0.35); }
  .card.rank-1::before {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(0,255,136,0.05) 0%, transparent 50%);
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .card:nth-child(1) { animation-delay: 0s; }
  .card:nth-child(2) { animation-delay: .07s; }
  .card:nth-child(3) { animation-delay: .14s; }
  .card:nth-child(4) { animation-delay: .21s; }
  .card:nth-child(5) { animation-delay: .28s; }

  /* ── Card header ── */
  .card-hdr { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 14px; }
  .card-left { display: flex; align-items: center; gap: 14px; }
  .rank-num {
    font-family: var(--display); font-size: 3rem; font-weight: 800;
    color: var(--border); line-height: 1; min-width: 36px;
  }
  .rank-1 .rank-num { color: var(--green); }
  .rank-2 .rank-num { color: rgba(0,255,136,0.5); }
  .ticker {
    font-family: var(--display); font-size: 2.2rem; font-weight: 800;
    letter-spacing: 3px; color: #fff; line-height: 1;
  }
  .signals { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 5px; }
  .sig {
    font-size: 0.52rem; letter-spacing: 1.5px; padding: 2px 7px;
    border-radius: 2px; border: 1px solid; font-family: var(--mono); font-weight: 700;
  }

  /* ── Card metrics ── */
  .card-metrics { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
  .metric {}
  .metric-val {
    font-family: var(--display); font-size: 1.5rem; font-weight: 700;
    letter-spacing: 1px; line-height: 1;
  }
  .metric-key { font-size: 0.52rem; color: var(--muted); letter-spacing: 2px; margin-top: 3px; }
  .green { color: var(--green); }
  .red   { color: var(--red); }
  .gold  { color: var(--gold); }

  /* ── Score bar ── */
  .score-section { margin-top: 14px; }
  .score-bar-wrap { display: flex; align-items: center; gap: 10px; margin-top: 6px; }
  .score-bar { flex: 1; height: 3px; background: var(--border); border-radius: 2px; }
  .score-fill { height: 100%; border-radius: 2px; background: var(--green); box-shadow: 0 0 6px rgba(0,255,136,0.5); transition: width .6s ease; }
  .score-label { font-family: var(--display); font-size: 1rem; font-weight: 700; color: var(--green); min-width: 40px; text-align: right; }

  /* ── Range indicator ── */
  .range-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
  .range-label { font-size: 0.55rem; color: var(--muted); letter-spacing: 1px; width: 52px; }
  .range-track { flex: 1; height: 4px; background: var(--border); border-radius: 2px; position: relative; }
  .range-pos {
    position: absolute; top: 50%; transform: translate(-50%, -50%);
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--green); box-shadow: 0 0 8px var(--green);
  }

  /* ── Party-over badge ── */
  .heat-badge {
    font-family: var(--display); font-size: 0.7rem; font-weight: 700;
    letter-spacing: 2px; padding: 4px 10px; border-radius: 2px;
    background: rgba(0,255,136,0.12); color: var(--green); border: 1px solid rgba(0,255,136,0.3);
  }

  /* ── Disclaimer ── */
  .disclaimer {
    text-align: center; font-size: 0.55rem; color: var(--dim);
    letter-spacing: 1px; margin-top: 28px; line-height: 2;
  }

  /* ── No results ── */
  .no-results { text-align: center; padding: 60px; }
  .no-results p { font-size: 0.65rem; color: var(--muted); letter-spacing: 1px; line-height: 2.5; }

  @media (max-width: 640px) {
    .hdr { flex-direction: column; gap: 12px; padding: 14px 16px; }
    .main { padding: 16px; }
    .card-metrics { grid-template-columns: repeat(3,1fr); }
    .logo { font-size: 1.8rem; }
  }
`;

const fmt = {
  price: v => `$${parseFloat(v).toFixed(4)}`,
  pct:   v => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,
  vol:   v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : `${(v/1e3).toFixed(0)}K`,
};

export default function PennyPicker() {
  const [apiInput, setApiInput] = useState(() => localStorage.getItem("av_key") || "");
  const [apiKey, setApiKey]     = useState(() => localStorage.getItem("av_key") || "");
  const [picks, setPicks]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [prog, setProg]         = useState({ done: 0, total: 0, ticker: "" });
  const [lastScan, setLastScan] = useState(null);
  const [error, setError]       = useState("");
  const [scanned, setScanned]   = useState(0);

  const saveKey = () => {
    const k = apiInput.trim();
    localStorage.setItem("av_key", k);
    setApiKey(k);
  };

  const fetchQuote = async (sym) => {
    const url = `${AV_BASE}?function=GLOBAL_QUOTE&symbol=${sym}&apikey=${apiKey}`;
    const res = await fetch(url);
    const d = await res.json();
    if (d["Note"] || d["Information"]) throw new Error("rate_limit");
    return d["Global Quote"];
  };

  const runScan = useCallback(async () => {
    if (!apiKey) { setError("Paste your Alpha Vantage key first."); return; }
    setLoading(true);
    setError("");
    setPicks([]);
    setScanned(0);

    const batch = UNIVERSE.slice(0, 25);
    setProg({ done: 0, total: batch.length, ticker: "" });

    const qualified = [];

    for (let i = 0; i < batch.length; i++) {
      const sym = batch[i];
      setProg({ done: i, total: batch.length, ticker: sym });
      try {
        const quote = await fetchQuote(sym);
        if (!quote || !quote["05. price"]) continue;
        const result = analyze(sym, quote);
        setScanned(i + 1);
        if (result) {
          qualified.push(result);
          // Sort by score desc, show top 5 live
          const top5 = [...qualified]
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
          setPicks(top5);
        }
      } catch (e) {
        if (e.message === "rate_limit") {
          setError("Rate limit hit — wait 60s and retry.");
          break;
        }
      }
      if (i < batch.length - 1) await new Promise(r => setTimeout(r, 13000));
    }

    setLastScan(new Date());
    setLoading(false);
  }, [apiKey]);

  const pctComplete = prog.total ? (prog.done / prog.total) * 100 : 0;

  return (
    <>
      <style>{css}</style>
      <div className="app">

        {/* Header */}
        <header className="hdr">
          <div>
            <div className="logo">PENNY<em>RADAR</em></div>
            <div className="sub">TOP 5 · HIGH CONVICTION · MOMENTUM STILL IN PLAY</div>
          </div>
          <div className="api-row">
            <input
              className="api-in" type="password"
              placeholder="ALPHA VANTAGE KEY"
              value={apiInput}
              onChange={e => setApiInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && saveKey()}
            />
            <button className="btn btn-save" onClick={saveKey}>SAVE</button>
            <button className="btn btn-scan" onClick={runScan} disabled={loading}>
              {loading ? `SCANNING ${prog.ticker}...` : "▶ SCAN"}
            </button>
          </div>
        </header>

        {/* Status */}
        <div className="status">
          <span>
            <span className={`dot ${lastScan ? "live" : ""}`} />
            {lastScan ? `LAST SCAN ${lastScan.toLocaleTimeString()}` : "READY"}
          </span>
          <span>UNIVERSE: {UNIVERSE.length} TICKERS</span>
          {scanned > 0 && <span>SCANNED: {scanned} · QUALIFIED: {picks.length}</span>}
          {error && <span className="err">⚠ {error}</span>}
        </div>

        <div className="main">

          {/* Progress */}
          {loading && (
            <div className="prog-wrap">
              <div className="prog-bar">
                <div className="prog-fill" style={{ width: `${pctComplete}%` }} />
              </div>
              <div className="prog-label">
                CHECKING {prog.ticker} — {prog.done}/{prog.total} — FREE TIER: 1 TICKER / 13s
              </div>
            </div>
          )}

          {/* Empty state */}
          {picks.length === 0 && !loading && (
            <div className="empty">
              <div className="empty-title">TOP 5</div>
              <div className="empty-sub">ONLY THE BEST MAKE THE LIST</div>
              <ul className="empty-rules">
                <li><span>✗</span> Already ran {">"}20% — skipped</li>
                <li><span>✗</span> Price below open — skipped</li>
                <li><span>✗</span> Rolled {">"}35% off high — skipped</li>
                <li><span>✗</span> Volume under 400K — skipped</li>
                <li><span>✓</span> Must have 3+ signals firing</li>
                <li><span>✓</span> Conviction score 6+ only</li>
              </ul>
            </div>
          )}

          {/* Results */}
          {picks.length > 0 && (
            <div className="cards">
              {picks.map((s, i) => (
                <div key={s.sym} className={`card rank-${i + 1}`}>
                  <div className="card-hdr">
                    <div className="card-left">
                      <span className="rank-num">#{i + 1}</span>
                      <div>
                        <div className="ticker">{s.sym}</div>
                        <div className="signals">
                          {s.signals.map(sig => (
                            <span key={sig.label} className="sig"
                              style={{ color: sig.color, borderColor: sig.color + "55", background: sig.color + "10" }}>
                              {sig.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="heat-badge">
                      {s.rangePos > 0.85 ? "NEAR HIGH" : s.rangePos > 0.6 ? "CLIMBING" : "BUILDING"}
                    </div>
                  </div>

                  <div className="card-metrics">
                    <div className="metric">
                      <div className="metric-val">{fmt.price(s.price)}</div>
                      <div className="metric-key">PRICE</div>
                    </div>
                    <div className="metric">
                      <div className={`metric-val ${s.pct >= 0 ? "green" : "red"}`}>{fmt.pct(s.pct)}</div>
                      <div className="metric-key">CHANGE</div>
                    </div>
                    <div className="metric">
                      <div className="metric-val">{fmt.vol(s.vol)}</div>
                      <div className="metric-key">VOLUME</div>
                    </div>
                    <div className="metric">
                      <div className="metric-val">{fmt.price(s.high)}</div>
                      <div className="metric-key">DAY HIGH</div>
                    </div>
                    <div className="metric">
                      <div className="metric-val gold">{((s.high - s.price) / s.price * 100).toFixed(1)}%</div>
                      <div className="metric-key">TO HIGH</div>
                    </div>
                  </div>

                  {/* Range position */}
                  <div className="range-row">
                    <span className="range-label">{fmt.price(s.low)}</span>
                    <div className="range-track">
                      <div className="range-pos" style={{ left: `${s.rangePos * 100}%` }} />
                    </div>
                    <span className="range-label" style={{ textAlign: "right" }}>{fmt.price(s.high)}</span>
                  </div>

                  {/* Score */}
                  <div className="score-section">
                    <div className="score-bar-wrap">
                      <div className="score-bar">
                        <div className="score-fill" style={{ width: `${(s.score / 10) * 100}%` }} />
                      </div>
                      <div className="score-label">{s.score}/10</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && scanned > 0 && picks.length === 0 && (
            <div className="no-results">
              <p>NOTHING QUALIFIED THIS SCAN.<br />
              MARKET MAY BE SLOW OR THE PARTY ALREADY HAPPENED.<br />
              TRY AGAIN LATER.</p>
            </div>
          )}

          <div className="disclaimer">
            NOT FINANCIAL ADVICE · SIGNALS DETECT MOMENTUM PATTERNS ONLY<br />
            PENNY STOCKS CARRY EXTREME RISK · ALWAYS DO YOUR OWN RESEARCH
          </div>
        </div>
      </div>
    </>
  );
}
