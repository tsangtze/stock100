// ✅ server.js – Full Version with Cron Fetch + AI Picks + RSI + P/E + Sentiment + Gap Up/Down + Volatile + Email Alert Route
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

const { sendFavoriteAlert } = require('./functionssendEmailAlert'); // ✅ NEW

app.use(cors());
app.use(express.json());

if (!fs.existsSync('./cache')) fs.mkdirSync('./cache');

// ✅ Moved below app init
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
    const url = endpoint.includes('?')
      ? `${BASE}/${endpoint}&apikey=${API_KEY}`
      : `${BASE}/${endpoint}?apikey=${API_KEY}`;
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

// 🕒 Cron: AI Picks + Volatile twice/day (10 AM + 3 PM ET)
cron.schedule('0 7,12 * * 1-5', async () => {
  console.log('🧠 Cron: AI Picks + Volatile...');
  await getTopStockPredictions();
  await fetchAndCache('stock_market/most_volatile');
});

// 🕕 Cron: Gap Up/Down once/day (9:30 AM ET)
cron.schedule('30 6 * * 1-5', async () => {
  console.log('📊 Cron: Gap Up & Down...');
  await fetchAndCache('stock_market/gap_up');
  await fetchAndCache('stock_market/gap_down');
});

// ✅ Routes
app.get('/ai-picks', async (req, res) => {
  try {
    const picks = await getTopStockPredictions();
    res.json(picks);
  } catch (err) {
    res.status(500).json({ error: 'AI picks failed', message: err.message });
  }
});

app.get('/ai-picks-buy', async (req, res) => {
  try {
    const picks = await getAIPicksBuy();
    res.json(picks);
  } catch (err) {
    res.status(500).json({ error: 'AI Buy picks failed', message: err.message });
  }
});

app.get('/ai-picks-sell', async (req, res) => {
  try {
    const picks = await getAIPicksSell();
    res.json(picks);
  } catch (err) {
    res.status(500).json({ error: 'AI Sell picks failed', message: err.message });
  }
});

app.get('/gainers', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./cache/stock_market_gainers.json'));
    res.json(data.slice(0, 100));
  } catch {
    res.status(500).json({ error: 'No data available' });
  }
});

app.get('/losers', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./cache/stock_market_losers.json'));
    res.json(data.slice(0, 100));
  } catch {
    res.status(500).json({ error: 'No data available' });
  }
});

app.get('/volume', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./cache/stock_market_dollar_volume.json'));
    res.json(data.slice(0, 100));
  } catch {
    res.status(500).json({ error: 'No data available' });
  }
});

app.get('/most-volatile', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./cache/stock_market_most_volatile.json'));
    res.json(data);
  } catch {
    res.status(500).json({ error: 'No most volatile data available' });
  }
});

app.get('/gapup', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./cache/stock_market_gap_up.json'));
    res.json(data);
  } catch {
    res.status(500).json({ error: 'No gap up data available' });
  }
});

app.get('/gapdown', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./cache/stock_market_gap_down.json'));
    res.json(data);
  } catch {
    res.status(500).json({ error: 'No gap down data available' });
  }
});

// RSI
app.get('/rsi-high', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./cache/technical_indicator_rsi_period_14_type_stock_sort_desc.json'));
    res.json(data);
  } catch {
    res.status(500).json({ error: 'No RSI high data available' });
  }
});

app.get('/rsi-low', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./cache/technical_indicator_rsi_period_14_type_stock_sort_asc.json'));
    res.json(data);
  } catch {
    res.status(500).json({ error: 'No RSI low data available' });
  }
});

// P/E Ratio
app.get('/pe-low', async (req, res) => {
  try {
    const url = `${BASE}/stock-screener?limit=100&sort=asc&column=pe&apikey=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Failed to fetch PE low data' });
  }
});

app.get('/pe-high', async (req, res) => {
  try {
    const url = `${BASE}/stock-screener?limit=100&sort=desc&column=pe&apikey=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Failed to fetch PE high data' });
  }
});

// Sentiment
app.get('/sentiment-positive', async (req, res) => {
  try {
    const url = `${BASE}/stock_news?sentiment=positive&limit=100&apikey=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Failed to fetch positive sentiment news' });
  }
});

app.get('/sentiment-negative', async (req, res) => {
  try {
    const url = `${BASE}/stock_news?sentiment=negative&limit=100&apikey=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Failed to fetch negative sentiment news' });
  }
});

// 📨 Email alert when favorited
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

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Stock100 backend running on http://localhost:${PORT}`);
});
