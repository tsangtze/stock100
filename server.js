// server.js – Clean Backend for Stock100 with AI Picks and JSON Routes

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cron = require('node-cron');
const fs = require('fs');

const app = express();
const PORT = 4000;
const API_KEY = 'HiMYIrmgSPwjGAnSLTP2luGvKu9MKIye';

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
cron.schedule('0 7,10,12 * * 1-5', () => {
  if (isMarketOpen()) endpoints.group3.forEach(fetchAndCache);
});
cron.schedule('0 8 * * 1-5', () => {
  if (isMarketOpen()) endpoints.group4.forEach(fetchAndCache);
});

// JSON route: Top Gainers
app.get('/stocks', (req, res) => {
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
  } catch (e) {
    res.status(500).json({ error: 'No data available' });
  }
});

// JSON route: AI Picks
const { getTopStockPredictions } = require('./aiModel');
app.get('/ai-picks', async (req, res) => {
  const picks = await getTopStockPredictions();
  res.json(picks);
});
app.get('/fetch-now', async (req, res) => {
  await fetchAndCache('stock_market/gainers');
  res.send('Gainers fetched and cached manually.');
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Stock100 backend running on http://localhost:${PORT}`);
});
