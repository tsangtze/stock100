// ✅ aiModel.js (Full Updated Version with Buy & Sell separation)
const fs = require('fs');
const fetch = require('node-fetch');

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

function getSellTag(score) {
  if (score <= 10) return { tag: "Strong Sell", color: "#8b0000" };
  if (score <= 20) return { tag: "Recommended Sell", color: "#b22222" };
  if (score <= 30) return { tag: "Suggested Sell", color: "#dc143c" };
  if (score <= 40) return { tag: "Negative Trend", color: "#ff4500" };
  return { tag: "Consider Selling", color: "#ff6347" };
}

async function getTopStockPredictions() {
  const today = new Date().toISOString().split('T')[0];

  if (fs.existsSync(CACHE_FILE)) {
    const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    if (cached.date === today && cached.buy && cached.sell) {
      console.log('✅ Loaded AI picks from cache');
      return cached;
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

    const volMap = {}; volData.forEach(d => volMap[d.symbol] = +d.volume || 0);
    const rsiMap = {}; rsiData.forEach(d => rsiMap[d.symbol] = +d.rsi || 50);
    const capMap = {}; mcapData.forEach(d => capMap[d.symbol] = +d.marketCap || 1e9);
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

      return { symbol, finalScore };
    });

    const sorted = [...predictions].sort((a, b) => b.finalScore - a.finalScore);
    const bestToBuy = sorted.slice(0, 10).map(stock => ({
      ...stock,
      ...getBuyTag(stock.finalScore)
    }));

    const bestToSell = sorted.slice(-10).reverse().map(stock => ({
      ...stock,
      ...getSellTag(stock.finalScore)
    }));

    fs.writeFileSync(CACHE_FILE, JSON.stringify({ date: today, buy: bestToBuy, sell: bestToSell }, null, 2));
    console.log('✅ AI Buy/Sell picks cached:', bestToBuy.map(s => s.symbol).join(", "));

    return { buy: bestToBuy, sell: bestToSell };
  } catch (err) {
    console.error('❌ AI prediction error:', err);
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    }
    return { buy: [], sell: [] };
  }
}

module.exports = { getTopStockPredictions };
