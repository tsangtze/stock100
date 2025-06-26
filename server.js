// ✅ server.js – Full Backend with ALL Features (Stock100)
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cron = require('node-cron');
const fs = require('fs');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 4000;
const API_KEY = process.env.FMP_API_KEY;
const BASE = 'https://financialmodelingprep.com/api/v3';

const corsOptions = {
  origin: 'https://courageous-beignet-431555.netlify.app',
  credentials: true,
};
app.use(cors(corsOptions));

app.use(express.json());
if (!fs.existsSync('./cache')) fs.mkdirSync('./cache');

const fetchAndCache = async (endpoint, filename) => {
  try {
    const url = `${BASE}/${endpoint}${endpoint.includes('?') ? '&' : '?'}apikey=${API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    fs.writeFileSync(`./cache/${filename}`, JSON.stringify(data));
    console.log(`✅ Cached: ${endpoint}`);
  } catch (err) {
    console.error(`❌ Failed: ${endpoint}`, err.message);
  }
};

// 📦 Bulk fetch every 1 min
cron.schedule('* * * * 1-5', async () => {
  await fetchAndCache('stock-screener?limit=5000&exchange=NASDAQ,NYSE', 'stock_bulk.json');
});

// 🕗 Hourly fetch for indicators
cron.schedule('0 * * * 1-5', async () => {
  await fetchAndCache('technical_indicator/rsi?period=14&type=stock&sort=desc', 'rsi_high.json');
  await fetchAndCache('technical_indicator/rsi?period=14&type=stock&sort=asc', 'rsi_low.json');
  await fetchAndCache('technical_indicator/macd?type=stock&limit=100', 'macd.json');
  await fetchAndCache('technical_indicator/bollinger?type=stock&limit=100', 'bollinger.json');
  await fetchAndCache('technical_indicator/sma50?type=stock&limit=100', 'sma50.json');
  await fetchAndCache('technical_indicator/sma200?type=stock&limit=100', 'sma200.json');
  await fetchAndCache('technical_indicator/stochastic?type=stock&limit=100', 'stochastic.json');
  await fetchAndCache('historical-price-full/SPY?timeseries=30', 'spy.json');
});

// 📅 Daily fetch (sentiment/news)
cron.schedule('0 14 * * 1-5', async () => {
  await fetchAndCache('stock_news?sentiment=positive&limit=100', 'sentiment_positive.json');
  await fetchAndCache('stock_news?sentiment=negative&limit=100', 'sentiment_negative.json');
  await fetchAndCache('stock/sectors-performance', 'sector.json');
  await fetchAndCache('stock/actives', 'actives.json');
  await fetchAndCache('earning_calendar?from=2024-01-01&to=2025-12-31', 'earnings.json');
});

// 🔁 Twice daily: AI Picks
cron.schedule('0 14,19 * * 1-5', async () => {
  try {
    const { getTopStockPredictions } = require('./aiModel');
    await getTopStockPredictions();
  } catch (err) {
    console.error('❌ AI Picks failed', err.message);
  }
});

// 📊 Load bulk
const loadBulk = () => JSON.parse(fs.readFileSync('./cache/stock_bulk.json', 'utf-8'));

// 📈 Core routes from bulk
const routes = {
  '/gainers': (a, b) => b.changesPercentage - a.changesPercentage,
  '/losers': (a, b) => a.changesPercentage - b.changesPercentage,
  '/volume': (a, b) => b.volume - a.volume,
  '/most-volatile': (a, b) => (b.beta || 0) - (a.beta || 0),
  '/gapup': (s) => s.open > s.previousClose,
  '/gapdown': (s) => s.open < s.previousClose,
  '/dollar-volume': (a, b) => (b.price * b.volume) - (a.price * a.volume),
  '/pe-low': (a, b) => a.pe - b.pe,
  '/pe-high': (a, b) => b.pe - a.pe,
  '/short-interest': (a, b) => b.shortRatio - a.shortRatio,
  '/marketcap-high': (a, b) => b.marketCap - a.marketCap,
  '/marketcap-low': (a, b) => a.marketCap - b.marketCap,
  '/price-high': (a, b) => b.price - a.price,
  '/price-low': (a, b) => a.price - b.price
};

Object.entries(routes).forEach(([path, sortFn]) => {
  app.get(path, (req, res) => {
    const data = loadBulk();
    const result = typeof sortFn === 'function' ? data.sort(sortFn).slice(0, 100) : data.filter(sortFn);
    res.json(result);
  });
});

// 🧠 Static indicator routes
const staticRoutes = {
  '/rsi-high': 'rsi_high.json',
  '/rsi-low': 'rsi_low.json',
  '/macd': 'macd.json',
  '/bollinger': 'bollinger.json',
  '/sma50': 'sma50.json',
  '/sma200': 'sma200.json',
  '/stochastic': 'stochastic.json',
  '/sentiment-positive': 'sentiment_positive.json',
  '/sentiment-negative': 'sentiment_negative.json',
  '/sector-stats': 'sector.json',
  '/earnings-upcoming': 'earnings.json'
};
Object.entries(staticRoutes).forEach(([path, file]) => {
  app.get(path, (req, res) => {
    try {
      const data = JSON.parse(fs.readFileSync(`./cache/${file}`));
      res.json(data);
    } catch {
      res.status(500).json({ error: 'Data not available' });
    }
  });
});

// 📊 Chart overlay route
app.get('/chart/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const url = `${BASE}/historical-price-full/${symbol}?timeseries=90&apikey=${API_KEY}`;
    const data = await (await fetch(url)).json();
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Chart not available' });
  }
});

// 💰 Crypto top
app.get('/crypto-top', async (req, res) => {
  try {
    const url = `${BASE}/cryptocurrencies?apikey=${API_KEY}`;
    const data = await (await fetch(url)).json();
    res.json(data.slice(0, 100));
  } catch {
    res.status(500).json({ error: 'Crypto data not available' });
  }
});

// 📊 Performance tracker
app.get('/performance-tracker', async (req, res) => {
  try {
    const spy = JSON.parse(fs.readFileSync('./cache/spy.json'));
    const spyPerf = (spy.historical[0].close - spy.historical[29].close) / spy.historical[29].close * 100;
    const symbols = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'META'];
    const results = [];
    for (let sym of symbols) {
      const url = `${BASE}/historical-price-full/${sym}?timeseries=30&apikey=${API_KEY}`;
      const data = await (await fetch(url)).json();
      const perf = (data.historical[0].close - data.historical[29].close) / data.historical[29].close * 100;
      results.push({ symbol: sym, performance: perf.toFixed(2), vsSPY: (perf - spyPerf).toFixed(2) });
    }
    res.json(results.sort((a, b) => b.vsSPY - a.vsSPY));
  } catch {
    res.status(500).json({ error: 'Failed to track performance' });
  }
});

// 🔔 Email alert
const { sendFavoriteAlert } = require('./functionssendEmailAlert');
app.post('/alert-favorite', async (req, res) => {
  const { email, symbol } = req.body;
  if (!email || !symbol) return res.status(400).json({ error: 'Missing email or symbol' });
  try {
    await sendFavoriteAlert(email, symbol);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send email', message: err.message });
  }
});

app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
