// server.js – Full Version with Cron Fetch + AI Picks + RSI + P/E + Sentiment Routes

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

app.use(cors());
app.use(express.json());

if (!fs.existsSync('./cache')) fs.mkdirSync('./cache');

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

// 🕒 Auto-fetch AI Picks at 10 AM and 3 PM ET (7 & 12 PT)
cron.schedule('0 7,12 * * 1-5', async () => {
  console.log('🧠 Cron job running for AI Picks...');
  await getTopStockPredictions();
});

// Routes
app.get('/', (req, res) => res.send('✅ Backend is working!'));

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
  } catch (err) {
    res.status(500).json({ error: 'No data available' });
  }
});

app.get('/losers', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./cache/stock_market_losers.json'));
    res.json(data.slice(0, 100));
  } catch (err) {
    res.status(500).json({ error: 'No data available' });
  }
});

app.get('/volume', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync('./cache/stock_market_dollar_volume.json'));
    res.json(data.slice(0, 100));
  } catch (err) {
    res.status(500).json({ error: 'No data available' });
  }
});

// RSI Routes
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

// P/E Ratio Routes
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

// Sentiment News Routes
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

// Manual test/fetch
app.get('/fetch-now', async (req, res) => {
  await fetchAndCache('stock_market/gainers');
  res.send('Gainers fetched and cached.');
});

app.get('/fetch-volume', async (req, res) => {
  await fetchAndCache('stock_market/dollar_volume');
  res.send('Volume fetched and cached.');
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

app.listen(PORT, () => {
  console.log(`🚀 Stock100 backend running on http://localhost:${PORT}`);
});
