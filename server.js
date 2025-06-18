// server.js – Clean Backend for Stock100 with AI Picks and JSON Routes

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cron = require('node-cron');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4000;
require('dotenv').config();
const API_KEY = process.env.FMP_API_KEY;

app.use(cors());
app.use(express.json());

// Ensure ./cache directory exists
if (!fs.existsSync('./cache')) fs.mkdirSync('./cache');

// Helpers
function isWeekday() {
  const day = new Date().getDay();
  return day >= 1 && day <= 5;
}

function isMarketOpen() {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  return hour > 6 && hour < 13 || (hour === 6 && minute >= 30);
}

// Endpoint Groups
const endpoints = {
  group1: ['stock_market/gainers', 'stock_market/losers'],
  group2: ['stock_market/actives'],
  group3: [
    'stock_market/most_volatile',
    'stock_market/unusual_volume',
    'technical_indicator/rsi?period=14&type=stock&sort=desc',
    'technical_indicator/rsi?period=14&type=stock&sort=asc'
  ],
  group4: [
    'stock_news?sentiment=positive',
    'stock_news?sentiment=negative',
    'ratios-ttm?sort=peRatio&limit=50',
    'stock_market/gap_up',
    'stock_market/gap_down',
    'stock-screener?sector=Technology&limit=50',
    'stock-screener?sector=Renewable Energy&limit=50',
    'stock_market/market_cap',
    'stock_market/price',
    'stock_market/dollar_volume',
    'stock_market/watchlist'
  ]
};

// Caching Logic
async function fetchAndCache(endpoint) {
  try {
    const url = endpoint.includes('?')
      ? `https://financialmodelingprep.com/api/v3/${endpoint}&apikey=${API_KEY}`
      : `https://financialmodelingprep.com/api/v3/${endpoint}?apikey=${API_KEY}`;

    console.log('🌐 Fetching:', url);
    const response = await fetch(url);
    const data = await response.json();

    const filename = endpoint.replace(/[/?=&]/g, '_') + '.json';
    fs.writeFileSync(`./cache/${filename}`, JSON.stringify(data));
    console.log(`✅ Cached ${endpoint}`);
  } catch (err) {
    console.error(`❌ Error caching ${endpoint}`, err);
  }
}

// CRON Jobs
cron.schedule('*/6 * * * 1-5', () => {
  if (isMarketOpen()) endpoints.group1.forEach(fetchAndCache);
});
cron.schedule('*/30 * * * 1-5', () => {
  if (isMarketOpen()) endpoints.group2.forEach(fetchAndCache);
});
cron.schedule('0 14,19 * * 1-5', () => {
  endpoints.group3.forEach(fetchAndCache);
});
cron.schedule('0 8 * * 1-5', () => {
  if (isMarketOpen()) endpoints.group4.forEach(fetchAndCache);
});

// Routes
app.get('/gainers', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./cache/stock_market_gainers.json'));
    const top100 = data.slice(0, 100).map(item => ({
      symbol: item.symbol,
      name: item.name || item.companyName || 'N/A',
      changePercent: typeof item.changesPercentage === 'number'
        ? item.changesPercentage.toFixed(2)
        : '0.00'
    }));
    res.json(top100);
  } catch (err) {
    console.error('❌ /gainers failed:', err);
    res.status(500).json({ error: 'No data available' });
  }
});

const { getTopStockPredictions } = require('./aiModel');
app.get('/ai-picks', async (req, res) => {
  try {
    const picks = await getTopStockPredictions();
    res.json(picks);
  } catch (err) {
    console.error('❌ /ai-picks failed:', err);
    res.status(500).json({ error: 'AI picks failed', message: err.message });
  }
});

app.get('/losers', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./cache/stock_market_losers.json'));
    const top100 = data.slice(0, 100).map(item => ({
      symbol: item.symbol,
      name: item.name || item.companyName || 'N/A',
      changePercent: typeof item.changesPercentage === 'number'
        ? item.changesPercentage.toFixed(2)
        : '0.00'
    }));
    res.json(top100);
  } catch (err) {
    console.error('❌ /losers failed:', err);
    res.status(500).json({ error: 'No data available' });
  }
});

// ✅ Live /volume route with cached real data
app.get('/volume', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./cache/stock_market_dollar_volume.json', 'utf-8'));
    const top100 = data.slice(0, 100).map(item => ({
      symbol: item.symbol,
      name: item.name || item.companyName || 'N/A',
      changePercent: typeof item.changesPercentage === 'number'
        ? item.changesPercentage.toFixed(2)
        : '0.00'
    }));
    res.json(top100);
  } catch (err) {
    console.error('❌ /volume failed:', err.message);
    res.status(500).json({ error: 'No data available' });
  }
});

// ✅ Manual fetch trigger for /volume
app.get('/fetch-volume', async (req, res) => {
  try {
    await fetchAndCache('stock_market/dollar_volume');
    res.send('Volume fetched and cached.');
  } catch (err) {
    console.error('❌ /fetch-volume error:', err);
    res.status(500).send('Failed to fetch volume data.');
  }
});

// Manual fetch trigger for gainers
app.get('/fetch-now', async (req, res) => {
  await fetchAndCache('stock_market/gainers');
  res.send('Gainers fetched and cached manually.');
});

// Extra routes
app.get('/rsi-high', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./cache/technical_indicator_rsi_period_14_type_stock_sort_desc.json'));
    res.json(data);
  } catch {
    res.status(500).json({ error: 'No data available' });
  }
});

app.get('/rsi-low', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./cache/technical_indicator_rsi_period_14_type_stock_sort_asc.json'));
    res.json(data);
  } catch {
    res.status(500).json({ error: 'No data available' });
  }
});

app.get('/gapup', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./cache/stock_market_gap_up.json'));
    res.json(data);
  } catch {
    res.status(500).json({ error: 'No data available' });
  }
});

app.get('/gapdown', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./cache/stock_market_gap_down.json'));
    res.json(data);
  } catch {
    res.status(500).json({ error: 'No data available' });
  }
});

app.get('/news-positive', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./cache/stock_news_sentiment_positive.json'));
    res.json(data);
  } catch {
    res.status(500).json({ error: 'No data available' });
  }
});

app.get('/news-negative', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./cache/stock_news_sentiment_negative.json'));
    res.json(data);
  } catch {
    res.status(500).json({ error: 'No data available' });
  }
});

app.get('/ipo', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./cache/stock_market_price.json'));
    res.json(data);
  } catch {
    res.status(500).json({ error: 'No data available' });
  }
});

app.get('/pe-ratio', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./cache/ratios-ttm_sort_peRatio_limit_50.json'));
    res.json(data);
  } catch {
    res.status(500).json({ error: 'No data available' });
  }
});

app.get('/watchlist', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./cache/stock_market_watchlist.json'));
    res.json(data);
  } catch {
    res.status(500).json({ error: 'No data available' });
  }
});

app.get('/', (req, res) => {
  res.send('✅ Backend is working!');
});

// Fallback route
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});
// Start
app.listen(PORT, () => {
  console.log(`🚀 Stock100 backend running on http://localhost:${PORT}`);

  // ✅ Preload volume data AFTER server has started
  fetchAndCache('stock_market/dollar_volume');
});


// Start
app.listen(PORT, () => {
  console.log(`🚀 Stock100 backend running on http://localhost:${PORT}`);
});
