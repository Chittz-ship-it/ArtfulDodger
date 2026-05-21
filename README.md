# 📡 PennyRadar

A penny stock screener + momentum signal dashboard built with React and Alpha Vantage.

![License](https://img.shields.io/badge/license-MIT-green) ![React](https://img.shields.io/badge/React-18-blue) ![Vite](https://img.shields.io/badge/Vite-5-purple)

---

## Features

- **Live screener** — scans a curated penny stock universe for stocks under $1 / $2 / $5 / $10
- **Signal detection** — flags BREAKOUT, MOMENTUM, VOL SPIKE, SQUEEZE, and DOJI patterns
- **Conviction score** — ranks each stock 0–8 based on active signals
- **Watchlist** — star stocks and filter to watchlist view (saved in your browser)
- **Day range bar** — visual sparkbar showing where price sits between daily high/low
- **Sortable table** — sort by price, % change, volume, or score

---

## Quickstart

### 1. Get a free Alpha Vantage API key

👉 https://www.alphavantage.co/support/#api-key — takes 30 seconds, no credit card.

### 2. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/pennyradar.git
cd pennyradar
npm install
```

### 3. Run locally

```bash
npm run dev
```

Open http://localhost:5173, paste your API key in the top bar, and hit **SCAN**.

---

## Project Structure

```
pennyradar/
├── index.html
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx
    └── PennyPickerDashboard.jsx
```

---

## Deploy to Vercel (free)

```bash
npm install -g vercel
vercel
```

Or connect your GitHub repo at https://vercel.com and it auto-deploys on every push.

---

## Rate Limits

Alpha Vantage's **free tier** allows ~5 requests/minute and 25/day.

PennyRadar paces requests at 1 ticker per 13 seconds to stay within limits. Scanning 20 tickers takes ~4 minutes. A progress bar shows status during the scan.

> **Your API key stays in your browser** (localStorage). It is never sent anywhere except directly to Alpha Vantage.

---

## Signals Explained

| Signal | Condition |
|---|---|
| `BREAKOUT` | Price is within 2% of the day's high |
| `MOMENTUM` | Day change is > +5% |
| `VOL SPIKE` | Volume exceeds 1,000,000 |
| `SQUEEZE` | Candle body is < 30% of the day's range |
| `DOJI` | Candle body is < 10% of the day's range |

---

## Disclaimer

> PennyRadar is for **informational purposes only**. Nothing here is financial advice. Penny stocks are extremely high risk. Always do your own research.

---

## License

MIT
