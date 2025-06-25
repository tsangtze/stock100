// aiModel.js – Updated with Hold Category + Raw Scores
const fs = require('fs');
const fetch = require('node-fetch');

require('dotenv').config();
const API_KEY = process.env.FMP_API_KEY;
const BASE = 'https://financialmodelingprep.com/api/v3';
const CACHE_FILE = './ai_picks.json';

function normalize(value, min, max) {
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

function rankTag(index, type) {
  if (type === 'buy') {
    if (index === 0) return { tag: "Strong Buy", color: "#0a7f00" };
    if (index <= 2) return { tag: "Recommended Buy", color: "#2e8b57" };
    if (index <= 5) return { tag: "Suggested Buy", color: "#3cb371" };
    return { tag: "Watch Buy", color: "#98fb98" };
  } else if (type === 'sell') {
    if (index === 0) return { tag: "Strong Sell", color: "#8b0000" };
    if (index <= 2) return { tag: "Recommended Sell", color: "#b22222" };
    if (index <= 5) return { tag: "Suggested Sell", color: "#dc143c" };
    return { tag: "Watch Sell", color: "#ff6347" };
  } else {
    return { tag: "Hold", color: "#999" };
  }
}

async function getTopStockPredictions() {
  const today = new Date().toISOString().split('T')[0];

  if (fs.existsSync(CACHE_FILE)) {
    try {
      const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
      if (cached.date === today) {
        console.log('✅ Loaded AI picks from cache');
        return cached;
      }
    } catch (err) {
      console.warn('⚠️ Failed to parse cache file:', err);
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
    const epsOK = Array.isArray(epsData);
    if (!epsOK) console.warn('⚠️ EPS data not available, continuing without EPS scoring.');

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

    const baseData = epsOK ? epsData : volData;

    const predictions = baseData.map(stock => {
      const symbol = stock.symbol;
      const eps = epsOK ? parseFloat(stock.eps || 0) : 0;
      const epsEst = epsOK ? parseFloat(stock.epsEstimated || 0) : 0;
      const epsGrowth = eps - epsEst;
      const epsScore = epsOK ? normalize(epsGrowth, -5, 5) : 50;

      const volume = volMap[symbol] || 0;
      const rsi = rsiMap[symbol];
      const marketCap = capMap[symbol];
      const newsBoost = newsSet.has(symbol) ? 1 : 0;
      const gapBoost = gapSet.has(symbol) ? 1 : 0;

      const volumeScore = normalize(volume, 100000, 50000000);
      const rsiScore = 100 - normalize(rsi, 10, 90);
      const capScore = normalize(marketCap, 1e8, 2e11);
      const newsScore = newsBoost * 100;
      const gapScore = gapBoost * 100;

      const longBuyScore = Math.round((epsOK ? epsScore * 0.4 : 0) + capScore * 0.4 + newsScore * 0.2);
      const shortBuyScore = Math.round(volumeScore * 0.3 + rsiScore * 0.3 + gapScore * 0.4);
      const longSellScore = 100 - longBuyScore;
      const shortSellScore = 100 - shortBuyScore;

      const averageScore = (longBuyScore + shortBuyScore + (100 - longSellScore) + (100 - shortSellScore)) / 4;

      return {
        symbol,
        longBuyScore,
        shortBuyScore,
        longSellScore,
        shortSellScore,
        averageScore
      };
    });

    // Sort and tag
    const buyLong = predictions.sort((a, b) => b.longBuyScore - a.longBuyScore).slice(0, 10)
      .map((s, i) => ({ ...s, ...rankTag(i, 'buy') }));

    const buyShort = predictions.sort((a, b) => b.shortBuyScore - a.shortBuyScore).slice(0, 10)
      .map((s, i) => ({ ...s, ...rankTag(i, 'buy') }));

    const sellLong = predictions.sort((a, b) => a.longSellScore - b.longSellScore).slice(0, 10)
      .map((s, i) => ({ ...s, ...rankTag(i, 'sell') }));

    const sellShort = predictions.sort((a, b) => a.shortSellScore - b.shortSellScore).slice(0, 10)
      .map((s, i) => ({ ...s, ...rankTag(i, 'sell') }));

    const hold = predictions.filter(p =>
      p.longBuyScore >= 40 && p.longBuyScore <= 60 &&
      p.shortBuyScore >= 40 && p.shortBuyScore <= 60
    ).slice(0, 20).map(s => ({ ...s, ...rankTag(null, 'hold') }));

    const result = {
      date: today,
      buyLong,
      buyShort,
      sellLong,
      sellShort,
      hold
    };

    fs.writeFileSync(CACHE_FILE, JSON.stringify(result, null, 2));
    console.log('✅ AI Picks (Buy/Sell/Hold) cached.');
    return result;

  } catch (err) {
    console.error('❌ AI prediction error:', err);
    if (fs.existsSync(CACHE_FILE)) {
      try {
        const backup = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
        console.log('🧠 AI picks fallback loaded from cache.');
        return backup;
      } catch (e) {
        console.warn('⚠️ Failed to parse backup cache:', e);
      }
    }
    return { buyLong: [], buyShort: [], sellLong: [], sellShort: [], hold: [] };
  }
}

async function getAIPicksBuy() {
  const all = await getTopStockPredictions();
  return [...(all.buyLong || []), ...(all.buyShort || [])];
}

async function getAIPicksSell() {
  const all = await getTopStockPredictions();
  return [...(all.sellLong || []), ...(all.sellShort || [])];
}

module.exports = {
  getTopStockPredictions,
  getAIPicksBuy,
  getAIPicksSell
};
