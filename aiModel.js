const express = require('express');
const fs = require('fs');
const fetch = require('node-fetch');
const app = express();
const PORT = 4000;

const API_KEY = 'HiMYIrmgSPwjGAnSLTP2luGvKu9MKIye';
const BASE = 'https://financialmodelingprep.com/api/v3';
const CACHE_FILE = './ai_picks.json';

function normalize(value, min, max) {
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function getBuyTag(score) {
  if (score >= 90) return { tag: "Strong Buy", color: "#0a7f00" };
  if (score >= 80) return { tag: "Recommended Buy", color: "#2e8b57" };
  if (score >= 70) return { tag: "Suggested Buy", color: "#3cb371" };
  if (score >= 60) return { tag: "Positive to Buy", color: "#66cdaa" };
  return { tag: "Buy", color: "#98fb98" };
}
async function getTopStockPredictions() {
  const today = new Date().toISOString().split('T')[0];

  if (fs.existsSync(CACHE_FILE)) {
    const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    if (cached.date === today) {
      console.log('✅ Loaded AI picks from cache');
      return cached.picks;
    }
  }

  try {
    const [epsRes, volRes, rsiRes, mcapRes, newsRes, gapRes] = await Promise.all([
      fetch(`${BASE}/earning_calendar?apikey=${API_KEY}`),
      fetch(`${BASE}/stock_market/actives?apikey=${API_KEY}`),
      fetch(`${BASE}/technical_indicator/rsi?period=14&type=stock&sort=asc&apikey=${API_KEY}`),
      fetch(`${BASE}/stock_market/market_cap?apikey=${API_KEY}`),
      fetch(`${BASE}/stock_news?sentiment=positive&limit=100&apikey=${API_KEY}`),
      fetch(`${BASE}/stock_market/gap_up?apikey=${API_KEY}`)
    ]);

    const epsData = await epsRes.json();
    const volData = await volRes.json();
    const rsiData = await rsiRes.json();
    const mcapData = await mcapRes.json();
    const newsData = await newsRes.json();
    const gapData = await gapRes.json();

    const volMap = {};
    volData.forEach(d => volMap[d.symbol] = +d.volume || 0);

    const rsiMap = {};
    rsiData.forEach(d => rsiMap[d.symbol] = +d.rsi || 50);

    const capMap = {};
    mcapData.forEach(d => capMap[d.symbol] = +d.marketCap || 1e9);

    const newsSet = new Set(newsData.map(n => n.symbol));
    const gapSet = new Set(gapData.map(n => n.symbol));

    const predictions = epsData.map(stock => {
      const symbol = stock.symbol;
      const eps = parseFloat(stock.eps || 0);
      const epsEst = parseFloat(stock.epsEstimated || 0);
      const epsGrowth = eps - epsEst;

      const volume = volMap[symbol] || 0;
      const rsi = rsiMap[symbol];
      const marketCap = capMap[symbol];
      const newsBoost = newsSet.has(symbol) ? 1 : 0;
      const gapBoost = gapSet.has(symbol) ? 1 : 0;

      const epsScore = normalize(epsGrowth, -5, 5);
      const volumeScore = normalize(volume, 100000, 50000000);
      const rsiScore = 100 - normalize(rsi, 10, 90);
      const capScore = normalize(marketCap, 1e8, 2e11);
      const newsScore = newsBoost * 100;
      const gapScore = gapBoost * 100;

      const finalScore = Math.round(
        epsScore * 0.3 +
        volumeScore * 0.2 +
        rsiScore * 0.15 +
        capScore * 0.15 +
        newsScore * 0.1 +
        gapScore * 0.1
      );

      const { tag, color } = getBuyTag(finalScore);

      return {
        symbol,
        eps,
        epsEstimated: epsEst,
        epsGrowth: +epsGrowth.toFixed(2),
        volume,
        rsi,
        marketCap,
        newsSentiment: newsBoost,
        gapUp: gapBoost,
        finalScore,
        tag,
        color
      };
    });

    predictions.sort((a, b) => b.finalScore - a.finalScore);
    const top10 = predictions.slice(0, 10);

    fs.writeFileSync(CACHE_FILE, JSON.stringify({ date: today, picks: top10 }, null, 2));
    console.log('✅ AI picks saved to cache:', top10.map(s => s.symbol).join(', '));

    return top10;
  } catch (err) {
    console.error('❌ AI prediction error:', err);
    if (fs.existsSync(CACHE_FILE)) {
      const fallback = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
      return fallback.picks;
    }
    return [];
  }
}
app.get('/ai-picks', async (req, res) => {
  const picks = await getTopStockPredictions();
  res.json(picks);
});
// ✅ Mock data for /gainers, /losers, /volume
const mockStocks = [
  { symbol: 'AAPL', name: 'Apple Inc.', changePercent: 3.1, volume: 1500000 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', changePercent: 2.8, volume: 1400000 },
  { symbol: 'GOOG', name: 'Alphabet Inc.', changePercent: 2.4, volume: 1350000 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', changePercent: 4.1, volume: 1600000 },
  { symbol: 'TSLA', name: 'Tesla Inc.', changePercent: 3.9, volume: 1700000 },
  { symbol: 'META', name: 'Meta Platforms', changePercent: 2.6, volume: 1250000 },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', changePercent: 2.3, volume: 1200000 },
  { symbol: 'NFLX', name: 'Netflix Inc.', changePercent: 2.9, volume: 1190000 },
  { symbol: 'CRM', name: 'Salesforce', changePercent: 1.7, volume: 1100000 },
  { symbol: 'INTC', name: 'Intel Corp.', changePercent: 1.2, volume: 1150000 }
];

app.get('/gainers', (req, res) => {
  const sorted = [...mockStocks].sort((a, b) => b.changePercent - a.changePercent);
  res.json(sorted);
});

app.get('/losers', (req, res) => {
  const sorted = [...mockStocks].sort((a, b) => a.changePercent - b.changePercent);
  res.json(sorted);
});

app.get('/volume', (req, res) => {
  const sorted = [...mockStocks].sort((a, b) => b.volume - a.volume);
  res.json(sorted);
});
// ✅ Start server
app.listen(PORT, () => {
  console.log(`✅ Stock100 backend running on http://localhost:${PORT}`);
});
