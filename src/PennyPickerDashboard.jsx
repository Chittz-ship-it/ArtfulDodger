import { useState, useEffect, useCallback } from "react";

// ─── Alpha Vantage Config ─────────────────────────────────────────────────────
// Drop your free key from https://www.alphavantage.co/support/#api-key
const AV_BASE = "https://www.alphavantage.co/query";

// ─── Curated penny stock universe (Alpha Vantage free tier has no screener endpoint)
// Users can edit this list or extend it
const PENNY_UNIVERSE = [
  "SNDL","CLOV","ATER","BBIG","AABB","GFAI","MULN","FFIE","HCDI","ILUS",
  "MINE","AQMS","ABOS","BFRI","CLSK","CRIS","DPRO","EDSA","ENOB","EOSE",
  "EVGO","FANH","GFAI","GOVX","HPNN","IDEX","IMPP","JBDI","KPLT","LIQT",
  "MARA","MEGL","MNMD","NKLA","OTRK","PHIO","PRVB","RAIL","RCAT","SHIP",
];

// ─── Signal logic ─────────────────────────────────────────────────────────────
function computeSignals(quote) {
  const price  = parseFloat(quote["05. price"]) || 0;
  const open   = parseFloat(quote["02. open"]) || price;
  const high   = parseFloat(quote["03. high"]) || price;
  const low    = parseFloat(quote["04. low"]) || price;
  const vol    = parseInt(quote["06. volume"]) || 0;
  const pctRaw = parseFloat(quote["10. change percent"]?.replace("%","")) || 0;

  const range   = high - low || 1;
  const body    = Math.abs(price - open);
  const breakout = price >= high * 0.98;
  const momentum = pctRaw > 5;
  const squeeze  = (body / range) < 0.3;
  const doji     = body / range < 0.1;
  const volSpike = vol > 1_000_000;

  const signals = [];
  if (breakout)  signals.push({ label: "BREAKOUT",  color: "#00ff88" });
  if (momentum)  signals.push({ label: "MOMENTUM",  color: "#ffd700" });
  if (volSpike)  signals.push({ label: "VOL SPIKE", color: "#ff6b35" });
  if (squeeze)   signals.push({ label: "SQUEEZE",   color: "#a78bfa" });
  if (doji)      signals.push({ label: "DOJI",      color: "#60a5fa" });

  const score = (breakout?3:0) + (momentum?2:0) + (volSpike?2:0) + (squeeze?1:0);

  return { signals, score, price, open, high, low, vol, pct: pctRaw };
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Bebas+Neue&family=DM+Sans:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:       #060a0f;
    --panel:    #0b1219;
    --border:   #1a2d3d;
    --green:    #00ff88;
    --red:      #ff4466;
    --gold:     #ffd700;
    --dim:      #3a5a72;
    --text:     #c8dde8;
    --mono:     'Share Tech Mono', monospace;
    --head:     'Bebas Neue', sans-serif;
    --body:     'DM Sans', sans-serif;
  }

  body { background: var(--bg); color: var(--text); font-family: var(--body); }

  .app {
    min-height: 100vh;
    background:
      radial-gradient(ellipse 80% 40% at 50% 0%, rgba(0,255,136,0.04) 0%, transparent 70%),
      linear-gradient(180deg, #060a0f 0%, #040810 100%);
  }

  /* ── Header ── */
  .header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 32px;
    border-bottom: 1px solid var(--border);
    background: rgba(11,18,25,0.9);
    backdrop-filter: blur(12px);
    position: sticky; top: 0; z-index: 100;
  }
  .logo { font-family: var(--head); font-size: 2rem; letter-spacing: 4px; color: var(--green); }
  .logo span { color: var(--dim); }
  .tagline { font-family: var(--mono); font-size: 0.65rem; color: var(--dim); letter-spacing: 2px; margin-top: 2px; }

  /* ── API Key input ── */
  .api-bar {
    display: flex; gap: 8px; align-items: center;
  }
  .api-input {
    background: rgba(0,255,136,0.05); border: 1px solid var(--border);
    color: var(--text); font-family: var(--mono); font-size: 0.75rem;
    padding: 8px 12px; border-radius: 4px; width: 220px;
    outline: none; transition: border .2s;
  }
  .api-input:focus { border-color: var(--green); }
  .api-input::placeholder { color: var(--dim); }
  .btn {
    font-family: var(--mono); font-size: 0.7rem; letter-spacing: 1px;
    padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer;
    transition: all .2s; white-space: nowrap;
  }
  .btn-green { background: var(--green); color: #000; font-weight: 700; }
  .btn-green:hover { background: #00cc6a; box-shadow: 0 0 20px rgba(0,255,136,0.3); }
  .btn-green:disabled { background: var(--dim); color: #0b1219; cursor: not-allowed; }
  .btn-ghost { background: transparent; border: 1px solid var(--border); color: var(--dim); }
  .btn-ghost:hover { border-color: var(--green); color: var(--green); }

  /* ── Status bar ── */
  .status-bar {
    display: flex; gap: 24px; align-items: center;
    padding: 8px 32px;
    background: rgba(0,0,0,0.4);
    border-bottom: 1px solid var(--border);
    font-family: var(--mono); font-size: 0.65rem; color: var(--dim);
  }
  .status-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--dim); display: inline-block; margin-right: 6px; }
  .status-dot.live { background: var(--green); box-shadow: 0 0 8px var(--green); animation: pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

  /* ── Main layout ── */
  .main { padding: 24px 32px; }

  /* ── Filters ── */
  .filters {
    display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
    margin-bottom: 20px;
  }
  .filter-label { font-family: var(--mono); font-size: 0.65rem; color: var(--dim); letter-spacing: 1px; }
  .filter-select {
    background: var(--panel); border: 1px solid var(--border); color: var(--text);
    font-family: var(--mono); font-size: 0.72rem; padding: 6px 10px; border-radius: 4px;
    outline: none; cursor: pointer;
  }
  .filter-select:focus { border-color: var(--green); }
  .search-input {
    background: var(--panel); border: 1px solid var(--border); color: var(--text);
    font-family: var(--mono); font-size: 0.72rem; padding: 6px 10px; border-radius: 4px;
    outline: none; width: 140px;
  }
  .search-input:focus { border-color: var(--green); }
  .search-input::placeholder { color: var(--dim); }

  /* ── Stat cards ── */
  .stat-row { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 20px; }
  .stat-card {
    background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
    padding: 16px 20px; position: relative; overflow: hidden;
  }
  .stat-card::before {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(0,255,136,0.03) 0%, transparent 60%);
  }
  .stat-num { font-family: var(--head); font-size: 2rem; letter-spacing: 2px; }
  .stat-num.green { color: var(--green); }
  .stat-num.gold  { color: var(--gold); }
  .stat-num.red   { color: var(--red); }
  .stat-label { font-family: var(--mono); font-size: 0.6rem; color: var(--dim); letter-spacing: 2px; margin-top: 4px; }

  /* ── Table ── */
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-family: var(--mono); font-size: 0.75rem; }
  thead th {
    text-align: left; padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    color: var(--dim); letter-spacing: 1px; font-size: 0.62rem;
    cursor: pointer; user-select: none; white-space: nowrap;
    font-family: var(--mono);
  }
  thead th:hover { color: var(--green); }
  thead th .sort-icon { margin-left: 4px; opacity: 0.5; }
  thead th.active { color: var(--green); }
  thead th.active .sort-icon { opacity: 1; }

  tbody tr {
    border-bottom: 1px solid rgba(26,45,61,0.5);
    transition: background .15s;
    cursor: pointer;
  }
  tbody tr:hover { background: rgba(0,255,136,0.03); }
  tbody tr.watching { background: rgba(255,215,0,0.04); }
  tbody td { padding: 11px 12px; vertical-align: middle; }

  .ticker-cell { color: #fff; font-weight: 700; letter-spacing: 1px; }
  .price-cell { color: #fff; }
  .pct-pos { color: var(--green); }
  .pct-neg { color: var(--red); }
  .vol-cell { color: var(--dim); }
  .score-cell { text-align: center; }

  .score-badge {
    display: inline-flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; border-radius: 4px; font-weight: 700; font-size: 0.8rem;
  }
  .score-0 { background: rgba(58,90,114,0.3); color: var(--dim); }
  .score-1, .score-2 { background: rgba(255,215,0,0.15); color: var(--gold); }
  .score-3, .score-4 { background: rgba(255,107,53,0.2); color: #ff6b35; }
  .score-5, .score-6, .score-7, .score-8 { background: rgba(0,255,136,0.15); color: var(--green); }

  /* ── Signal pills ── */
  .signals { display: flex; gap: 4px; flex-wrap: wrap; }
  .signal-pill {
    font-size: 0.55rem; letter-spacing: 1px; padding: 2px 6px; border-radius: 2px;
    font-family: var(--mono); font-weight: 700; border: 1px solid;
  }

  /* ── Star / watchlist ── */
  .star { background: none; border: none; cursor: pointer; font-size: 1rem; line-height: 1; padding: 0; }
  .star.on  { color: var(--gold); filter: drop-shadow(0 0 4px var(--gold)); }
  .star.off { color: var(--border); }
  .star:hover { color: var(--gold); }

  /* ── Sparkbar (mini range viz) ── */
  .sparkbar-wrap { display: flex; align-items: center; gap: 6px; }
  .sparkbar { height: 4px; background: var(--border); border-radius: 2px; width: 60px; position: relative; }
  .sparkbar-fill { height: 100%; border-radius: 2px; position: absolute; top: 0; }

  /* ── Empty / loading states ── */
  .state-box {
    text-align: center; padding: 80px 20px;
    font-family: var(--mono); color: var(--dim);
  }
  .state-box .big { font-family: var(--head); font-size: 3rem; color: var(--border); margin-bottom: 12px; }
  .state-box p { font-size: 0.75rem; line-height: 1.8; }

  /* ── Progress / loading bar ── */
  .loading-bar-wrap { margin-bottom: 16px; }
  .loading-bar {
    height: 2px; background: var(--border); border-radius: 1px; overflow: hidden;
  }
  .loading-bar-fill {
    height: 100%; background: var(--green);
    transition: width .3s ease;
    box-shadow: 0 0 8px var(--green);
  }
  .loading-label {
    font-family: var(--mono); font-size: 0.62rem; color: var(--dim);
    margin-top: 6px; letter-spacing: 1px;
  }

  /* ── Tabs ── */
  .tabs { display: flex; gap: 4px; margin-bottom: 20px; }
  .tab {
    font-family: var(--mono); font-size: 0.68rem; letter-spacing: 1px;
    padding: 8px 18px; border-radius: 4px; cursor: pointer; border: 1px solid transparent;
    transition: all .2s;
  }
  .tab.active { background: rgba(0,255,136,0.1); border-color: var(--green); color: var(--green); }
  .tab.inactive { background: transparent; border-color: var(--border); color: var(--dim); }
  .tab.inactive:hover { border-color: var(--text); color: var(--text); }

  /* ── Detail panel ── */
  .detail-panel {
    background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
    padding: 20px 24px; margin-bottom: 20px; position: relative;
    animation: slideIn .2s ease;
  }
  @keyframes slideIn { from { opacity:0; transform: translateY(-8px); } to { opacity:1; transform:translateY(0); } }
  .detail-close { position: absolute; top: 12px; right: 16px; background: none; border: none; color: var(--dim); cursor: pointer; font-size: 1.1rem; }
  .detail-close:hover { color: var(--red); }
  .detail-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-top: 12px; }
  .detail-item { }
  .detail-val { font-family: var(--head); font-size: 1.4rem; letter-spacing: 1px; }
  .detail-key { font-family: var(--mono); font-size: 0.58rem; color: var(--dim); letter-spacing: 2px; margin-top: 2px; }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .header { flex-direction: column; gap: 12px; padding: 14px 16px; }
    .main { padding: 14px 16px; }
    .stat-row { grid-template-columns: repeat(2,1fr); }
    .detail-grid { grid-template-columns: repeat(2,1fr); }
  }
`;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = {
  price:  v => `$${parseFloat(v).toFixed(4)}`,
  pct:    v => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,
  vol:    v => v >= 1e6 ? `${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `${(v/1e3).toFixed(0)}K` : v,
};

function SortIcon({ col, sort }) {
  if (sort.col !== col) return <span className="sort-icon">↕</span>;
  return <span className="sort-icon">{sort.dir === "asc" ? "↑" : "↓"}</span>;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PennyPicker() {
  const [apiKey, setApiKey]       = useState(() => localStorage.getItem("av_key") || "");
  const [apiInput, setApiInput]   = useState(() => localStorage.getItem("av_key") || "");
  const [stocks, setStocks]       = useState([]);
  const [loading, setLoading]     = useState(false);
  const [progress, setProgress]   = useState({ done: 0, total: 0, ticker: "" });
  const [watchlist, setWatchlist] = useState(() => JSON.parse(localStorage.getItem("wl") || "[]"));
  const [sort, setSort]           = useState({ col: "score", dir: "desc" });
  const [tab, setTab]             = useState("all");
  const [search, setSearch]       = useState("");
  const [filterSig, setFilterSig] = useState("all");
  const [filterMax, setFilterMax] = useState("5");
  const [selected, setSelected]   = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [error, setError]         = useState("");

  // persist watchlist
  useEffect(() => { localStorage.setItem("wl", JSON.stringify(watchlist)); }, [watchlist]);

  const saveKey = () => {
    localStorage.setItem("av_key", apiInput.trim());
    setApiKey(apiInput.trim());
    setError("");
  };

  // Fetch one quote from AV (free tier: 25 req/day, ~5/min)
  const fetchQuote = async (sym) => {
    const url = `${AV_BASE}?function=GLOBAL_QUOTE&symbol=${sym}&apikey=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data["Note"] || data["Information"]) throw new Error("rate_limit");
    return data["Global Quote"];
  };

  const runScan = useCallback(async () => {
    if (!apiKey) { setError("Enter your Alpha Vantage API key first."); return; }
    setLoading(true);
    setError("");
    setStocks([]);
    setSelected(null);

    const batch = PENNY_UNIVERSE.slice(0, 20); // free tier safe — 20 tickers
    setProgress({ done: 0, total: batch.length, ticker: "" });

    const results = [];
    for (let i = 0; i < batch.length; i++) {
      const sym = batch[i];
      setProgress({ done: i, total: batch.length, ticker: sym });
      try {
        const quote = await fetchQuote(sym);
        if (!quote || !quote["05. price"]) continue;
        const price = parseFloat(quote["05. price"]);
        if (price > parseFloat(filterMax)) continue;
        if (price <= 0) continue;
        const computed = computeSignals(quote);
        results.push({ sym, quote, ...computed });
        setStocks([...results]);
      } catch (e) {
        if (e.message === "rate_limit") {
          setError("Rate limit hit. Free tier allows ~5 requests/min. Wait 60s and retry.");
          break;
        }
      }
      // Respect AV free tier: ~5 calls/min
      if (i < batch.length - 1) await new Promise(r => setTimeout(r, 13000));
    }

    setProgress({ done: batch.length, total: batch.length, ticker: "" });
    setLastFetch(new Date());
    setLoading(false);
  }, [apiKey, filterMax]);

  // Sort + filter
  const visible = stocks
    .filter(s => {
      if (tab === "watchlist") return watchlist.includes(s.sym);
      if (tab === "signals")   return s.signals.length > 0;
      return true;
    })
    .filter(s => search ? s.sym.includes(search.toUpperCase()) : true)
    .filter(s => filterSig === "all" ? true : s.signals.some(sig => sig.label === filterSig))
    .sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      const map = { score: "score", price: "price", pct: "pct", vol: "vol" };
      const key = map[sort.col] || "score";
      return (a[key] - b[key]) * dir;
    });

  const toggleSort = (col) => setSort(s => ({ col, dir: s.col === col && s.dir === "desc" ? "asc" : "desc" }));
  const toggleWatch = (sym) => setWatchlist(w => w.includes(sym) ? w.filter(x => x !== sym) : [...w, sym]);

  const stats = {
    total:   stocks.length,
    signals: stocks.filter(s => s.signals.length > 0).length,
    gainers: stocks.filter(s => s.pct > 0).length,
    hot:     stocks.filter(s => s.score >= 5).length,
  };

  const sel = selected ? stocks.find(s => s.sym === selected) : null;

  return (
    <>
      <style>{css}</style>
      <div className="app">
        {/* ── Header ── */}
        <header className="header">
          <div>
            <div className="logo">PENNY<span>RADAR</span></div>
            <div className="tagline">MOMENTUM · BREAKOUT · SIGNAL DETECTION</div>
          </div>
          <div className="api-bar">
            <input
              className="api-input"
              placeholder="ALPHA VANTAGE API KEY"
              value={apiInput}
              onChange={e => setApiInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && saveKey()}
              type="password"
            />
            <button className="btn btn-ghost" onClick={saveKey}>SAVE</button>
            <button className="btn btn-green" onClick={runScan} disabled={loading}>
              {loading ? "SCANNING..." : "▶ SCAN"}
            </button>
          </div>
        </header>

        {/* ── Status bar ── */}
        <div className="status-bar">
          <span>
            <span className={`status-dot ${lastFetch ? "live" : ""}`} />
            {lastFetch ? `LAST SCAN: ${lastFetch.toLocaleTimeString()}` : "AWAITING SCAN"}
          </span>
          <span>UNIVERSE: {PENNY_UNIVERSE.length} TICKERS</span>
          <span>BATCH SIZE: 20 (FREE TIER SAFE)</span>
          {error && <span style={{ color: "var(--red)", marginLeft: "auto" }}>⚠ {error}</span>}
        </div>

        <div className="main">
          {/* ── Loading bar ── */}
          {loading && (
            <div className="loading-bar-wrap">
              <div className="loading-bar">
                <div className="loading-bar-fill" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
              </div>
              <div className="loading-label">
                FETCHING {progress.ticker} — {progress.done}/{progress.total} — NOTE: FREE TIER PACES AT ~1 TICKER / 13s
              </div>
            </div>
          )}

          {/* ── Stat cards ── */}
          <div className="stat-row">
            <div className="stat-card">
              <div className="stat-num green">{stats.total}</div>
              <div className="stat-label">STOCKS SCANNED</div>
            </div>
            <div className="stat-card">
              <div className="stat-num gold">{stats.signals}</div>
              <div className="stat-label">ACTIVE SIGNALS</div>
            </div>
            <div className="stat-card">
              <div className="stat-num green">{stats.gainers}</div>
              <div className="stat-label">TODAY'S GAINERS</div>
            </div>
            <div className="stat-card">
              <div className="stat-num" style={{ color: stats.hot > 0 ? "#ff6b35" : "var(--dim)" }}>{stats.hot}</div>
              <div className="stat-label">HIGH CONVICTION</div>
            </div>
          </div>

          {/* ── Tabs + Filters ── */}
          <div className="tabs">
            {["all", "signals", "watchlist"].map(t => (
              <div key={t} className={`tab ${tab === t ? "active" : "inactive"}`} onClick={() => setTab(t)}>
                {t.toUpperCase()} {t === "watchlist" && `(${watchlist.length})`}
              </div>
            ))}
          </div>

          <div className="filters">
            <span className="filter-label">FILTER:</span>
            <input className="search-input" placeholder="TICKER..." value={search} onChange={e => setSearch(e.target.value)} />
            <select className="filter-select" value={filterSig} onChange={e => setFilterSig(e.target.value)}>
              <option value="all">ALL SIGNALS</option>
              <option value="BREAKOUT">BREAKOUT</option>
              <option value="MOMENTUM">MOMENTUM</option>
              <option value="VOL SPIKE">VOL SPIKE</option>
              <option value="SQUEEZE">SQUEEZE</option>
              <option value="DOJI">DOJI</option>
            </select>
            <select className="filter-select" value={filterMax} onChange={e => setFilterMax(e.target.value)}>
              <option value="1">UNDER $1</option>
              <option value="2">UNDER $2</option>
              <option value="5">UNDER $5</option>
              <option value="10">UNDER $10</option>
            </select>
            <span className="filter-label" style={{ marginLeft: "auto" }}>{visible.length} RESULTS</span>
          </div>

          {/* ── Detail panel ── */}
          {sel && (
            <div className="detail-panel">
              <button className="detail-close" onClick={() => setSelected(null)}>✕</button>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ fontFamily: "var(--head)", fontSize: "1.8rem", color: "#fff", letterSpacing: 3 }}>{sel.sym}</span>
                <div className="signals">
                  {sel.signals.map(s => (
                    <span key={s.label} className="signal-pill" style={{ color: s.color, borderColor: s.color, background: s.color + "15" }}>
                      {s.label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="detail-grid">
                {[
                  { key: "PRICE",   val: fmt.price(sel.price) },
                  { key: "CHANGE",  val: fmt.pct(sel.pct),      color: sel.pct >= 0 ? "var(--green)" : "var(--red)" },
                  { key: "OPEN",    val: fmt.price(sel.open) },
                  { key: "HIGH",    val: fmt.price(sel.high) },
                  { key: "LOW",     val: fmt.price(sel.low) },
                  { key: "VOLUME",  val: fmt.vol(sel.vol) },
                  { key: "RANGE",   val: `$${(sel.high - sel.low).toFixed(4)}` },
                  { key: "SCORE",   val: sel.score + " / 8" },
                  { key: "WATCHLIST", val: watchlist.includes(sel.sym) ? "★ WATCHING" : "☆ NOT WATCHING" },
                ].map(item => (
                  <div className="detail-item" key={item.key}>
                    <div className="detail-val" style={{ color: item.color || "var(--text)" }}>{item.val}</div>
                    <div className="detail-key">{item.key}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Table ── */}
          {stocks.length === 0 && !loading ? (
            <div className="state-box">
              <div className="big">PENNYRADAR</div>
              <p>Enter your Alpha Vantage API key above and hit SCAN.<br />Free keys at alphavantage.co — takes ~4 min for 20 tickers.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th></th>
                    <th>TICKER</th>
                    <th className={sort.col === "price" ? "active" : ""} onClick={() => toggleSort("price")}>
                      PRICE <SortIcon col="price" sort={sort} />
                    </th>
                    <th className={sort.col === "pct" ? "active" : ""} onClick={() => toggleSort("pct")}>
                      CHG% <SortIcon col="pct" sort={sort} />
                    </th>
                    <th className={sort.col === "vol" ? "active" : ""} onClick={() => toggleSort("vol")}>
                      VOLUME <SortIcon col="vol" sort={sort} />
                    </th>
                    <th>DAY RANGE</th>
                    <th>SIGNALS</th>
                    <th className={sort.col === "score" ? "active" : ""} onClick={() => toggleSort("score")}>
                      SCORE <SortIcon col="score" sort={sort} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map(s => {
                    const rangeWidth = s.high > s.low ? ((s.price - s.low) / (s.high - s.low)) * 100 : 50;
                    return (
                      <tr key={s.sym} className={watchlist.includes(s.sym) ? "watching" : ""} onClick={() => setSelected(s.sym === selected ? null : s.sym)}>
                        <td onClick={e => { e.stopPropagation(); toggleWatch(s.sym); }}>
                          <button className={`star ${watchlist.includes(s.sym) ? "on" : "off"}`}>
                            {watchlist.includes(s.sym) ? "★" : "☆"}
                          </button>
                        </td>
                        <td className="ticker-cell">{s.sym}</td>
                        <td className="price-cell">{fmt.price(s.price)}</td>
                        <td className={s.pct >= 0 ? "pct-pos" : "pct-neg"}>{fmt.pct(s.pct)}</td>
                        <td className="vol-cell">{fmt.vol(s.vol)}</td>
                        <td>
                          <div className="sparkbar-wrap">
                            <span style={{ fontSize: "0.6rem", color: "var(--dim)", width: 48 }}>{fmt.price(s.low)}</span>
                            <div className="sparkbar">
                              <div className="sparkbar-fill" style={{
                                left: 0, width: `${rangeWidth}%`,
                                background: s.pct >= 0 ? "var(--green)" : "var(--red)"
                              }} />
                            </div>
                            <span style={{ fontSize: "0.6rem", color: "var(--dim)", width: 48 }}>{fmt.price(s.high)}</span>
                          </div>
                        </td>
                        <td>
                          <div className="signals">
                            {s.signals.slice(0, 3).map(sig => (
                              <span key={sig.label} className="signal-pill"
                                style={{ color: sig.color, borderColor: sig.color, background: sig.color + "18" }}>
                                {sig.label}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="score-cell">
                          <span className={`score-badge score-${s.score}`}>{s.score}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
