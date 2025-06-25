// ✅ server.js – Full Feature Backend with Algorithmic Screen + Technical Analysis
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;
const API_KEY = process.env.FMP_API_KEY;
const BASE = 'https://financialmodelingprep.com/api/v3';

const {
  getTopStockPredictions,
  getAIPicksBuy,
  getAIPicksSell
} = require('./aiModel');
const { sendFavoriteAlert } = require('./functionssendEmailAlert');

app.use(cors());
app.use(express.json());
if (!fs.existsSync('./cache')) fs.mkdirSync('./cache');

app.get('/', (req, res) => {
  res.send('✅ Stock100 backend is running.');
});

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function incrementFetchCounter() {
  const file = './fetchCount.json';
  const today = getTodayKey();
  let data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : {};
  data[today] = (data[today] || 0) + 1;
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`📈 Fetch count for ${today}: ${data[today]}`);
}

async function fetchAndCache(endpoint) {
  try {
    const url = endpoint.includes('?') ? `${BASE}/${endpoint}&apikey=${API_KEY}` : `${BASE}/${endpoint}?apikey=${API_KEY}`;
    console.log('🌐 Fetching:', url);
    const res = await fetch(url);
    const data = await res.json();
    incrementFetchCounter();
    const filename = endpoint.replace(/[/?=&]/g, '_') + '.json';
    fs.writeFileSync(`./cache/${filename}`, JSON.stringify(data));
    console.log(`✅ Cached ${endpoint}`);
  } catch (err) {
    console.error(`❌ Error caching ${endpoint}`, err);
  }
}

function isWeekday() {
  const day = new Date().getDay();
  return day >= 1 && day <= 5;
}

function isMarketOpen() {
  const now = new Date();
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  return (hour > 13 && hour < 20) || (hour === 13 && minute >= 30);
}

// ✅ Group 1: Every 6 min (Gainers, Losers)
cron.schedule('*/6 * * * 1-5', async () => {
  if (!isMarketOpen()) return;
  await fetchAndCache('stock_market/gainers');
  await fetchAndCache('stock_market/losers');
});

// ✅ Group 2: Every 30 min (Volume)
cron.schedule('*/30 * * * 1-5', async () => {
  if (!isMarketOpen()) return;
  await fetchAndCache('stock_market/dollar_volume');
});

// ✅ Group 3: 3x/day (Volatile, RSI, Unusual)
cron.schedule('30 13,16,19 * * 1-5', async () => {
  await fetchAndCache('stock_market/most_volatile');
  await fetchAndCache('technical_indicator/rsi?period=14&type=stock&sort=desc');
  await fetchAndCache('technical_indicator/rsi?period=14&type=stock&sort=asc');
  await fetchAndCache('stock_market/unusual_volume');
});

// ✅ Group 4: AI Picks 2x/day
cron.schedule('0 14,19 * * 1-5', async () => {
  await getTopStockPredictions();
});

// ✅ Group 5: Sentiment, Gap, PE – Once per day
cron.schedule('0 14 * * 1-5', async () => {
  await fetchAndCache('stock_news?sentiment=positive&limit=100');
  await fetchAndCache('stock_news?sentiment=negative&limit=100');
  await fetchAndCache('stock_market/gap_up');
  await fetchAndCache('stock_market/gap_down');
  await fetchAndCache('stock-screener?limit=100&sort=asc&column=pe');
  await fetchAndCache('stock-screener?limit=100&sort=desc&column=pe');
});

// ✅ Group 6: Scheduled Technical Analysis (once per day, heavy load)
cron.schedule('0 15 * * 1-5', async () => {
  const indicators = [
    'technical_indicator/macd',
    'technical_indicator/bollinger',
    'technical_indicator/stochastic',
    'technical_indicator/sma50',
    'technical_indicator/sma200'
  ];
  for (let ind of indicators) {
    await fetchAndCache(`${ind}?type=stock&limit=100`);
  }
});

// 🧠 AI Endpoints
app.get('/ai-picks', async (req, res) => {
  try { res.json(await getTopStockPredictions()); } catch (err) {
    res.status(500).json({ error: 'AI picks failed', message: err.message });
  }
});

app.get('/ai-picks-buy', async (req, res) => {
  try { res.json(await getAIPicksBuy()); } catch (err) {
    res.status(500).json({ error: 'AI Buy picks failed', message: err.message });
  }
});

app.get('/ai-picks-sell', async (req, res) => {
  try { res.json(await getAIPicksSell()); } catch (err) {
    res.status(500).json({ error: 'AI Sell picks failed', message: err.message });
  }
});

// 📁 Cached Endpoints
const dataRoutes = [
  { path: '/gainers', file: 'stock_market_gainers.json' },
  { path: '/losers', file: 'stock_market_losers.json' },
  { path: '/volume', file: 'stock_market_dollar_volume.json' },
  { path: '/most-volatile', file: 'stock_market_most_volatile.json' },
  { path: '/gapup', file: 'stock_market_gap_up.json' },
  { path: '/gapdown', file: 'stock_market_gap_down.json' },
  { path: '/rsi-high', file: 'technical_indicator_rsi_period_14_type_stock_sort_desc.json' },
  { path: '/rsi-low', file: 'technical_indicator_rsi_period_14_type_stock_sort_asc.json' }
];

for (let { path, file } of dataRoutes) {
  app.get(path, (req, res) => {
    try {
      const data = JSON.parse(fs.readFileSync(`./cache/${file}`));
      res.json(data.slice(0, 100));
    } catch {
      res.status(500).json({ error: `No data available for ${path}` });
    }
  });
}

// 📊 PE and Sentiment
app.get('/pe-low', async (req, res) => {
  try {
    const url = `${BASE}/stock-screener?limit=100&sort=asc&column=pe&apikey=${API_KEY}`;
    const data = await (await fetch(url)).json();
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Failed to fetch PE low data' });
  }
});

app.get('/pe-high', async (req, res) => {
  try {
    const url = `${BASE}/stock-screener?limit=100&sort=desc&column=pe&apikey=${API_KEY}`;
    const data = await (await fetch(url)).json();
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Failed to fetch PE high data' });
  }
});

app.get('/sentiment-positive', async (req, res) => {
  try {
    const url = `${BASE}/stock_news?sentiment=positive&limit=100&apikey=${API_KEY}`;
    const data = await (await fetch(url)).json();
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Failed to fetch positive sentiment news' });
  }
});

app.get('/sentiment-negative', async (req, res) => {
  try {
    const url = `${BASE}/stock_news?sentiment=negative&limit=100&apikey=${API_KEY}`;
    const data = await (await fetch(url)).json();
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Failed to fetch negative sentiment news' });
  }
});

// ⭐ Favorite Alert
app.post('/alert-favorite', async (req, res) => {
  const { email, symbol } = req.body;
  if (!email || !symbol) return res.status(400).json({ error: 'Missing email or symbol' });
  try {
    await sendFavoriteAlert(email, symbol);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send email alert', message: err.message });
  }
});

// 🔄 Manual Cache
app.get('/manual-fetch', async (req, res) => {
  try {
    await fetchAllAndCache();
    res.send('✅ Manual fetch completed and cached.');
  } catch (err) {
    res.status(500).send('❌ Manual fetch failed.');
  }
});

// 📊 Algorithmic Screens (mock for now)
app.get('/algorithmic-screens', (req, res) => {
  try {
    const data = fs.readFileSync('./cache/algorithmic_screens.json', 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    res.status(500).json({ error: 'Could not load algorithmic screens.' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Stock100 backend running on http://localhost:${PORT}`);
});
