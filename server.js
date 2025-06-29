// ✅ server.js – FINAL CLEAN FULL BACKEND WITH ALL ROUTES FOR STOCK100

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs');
const cron = require('node-cron');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;
const API_KEY = process.env.FMP_API_KEY;
const BASE_URL = 'https://financialmodelingprep.com/api/v3';

const CACHE_DIR = './cache';
const REALTIME_CACHE = `${CACHE_DIR}/realtime-quote.json`;
const ALGO_CACHE = `${CACHE_DIR}/algo-screens.json`;
const TECH_CACHE = `${CACHE_DIR}/technical-screens.json`;
const FAVORITES_CACHE = `${CACHE_DIR}/favorites.json`;
const CRYPTO_CACHE = `${CACHE_DIR}/crypto-top.json`;

app.use(cors());
app.use(express.json());
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);

function loadCache(path) {
    try {
        return JSON.parse(fs.readFileSync(path, 'utf-8'));
    } catch {
        return [];
    }
}

app.get('/gainers', (req, res) => {
    const data = loadCache(REALTIME_CACHE);
    res.json([...data].sort((a, b) => (b.changesPercentage || 0) - (a.changesPercentage || 0)).slice(0, 100));
});

app.get('/losers', (req, res) => {
    const data = loadCache(REALTIME_CACHE);
    res.json([...data].sort((a, b) => (a.changesPercentage || 0) - (b.changesPercentage || 0)).slice(0, 100));
});

app.get('/volume', (req, res) => {
    const data = loadCache(REALTIME_CACHE);
    res.json([...data].sort((a, b) => (b.volume || 0) - (a.volume || 0)).slice(0, 100));
});

app.get('/most-volatile', (req, res) => {
    const data = loadCache(REALTIME_CACHE);
    res.json([...data].sort((a, b) => (b.beta || 0) - (a.beta || 0)).slice(0, 100));
});

app.get('/gap-up', (req, res) => {
    const data = loadCache(REALTIME_CACHE);
    res.json([...data].filter(s => s.open > s.previousClose).slice(0, 100));
});

app.get('/gap-down', (req, res) => {
    const data = loadCache(REALTIME_CACHE);
    res.json([...data].filter(s => s.open < s.previousClose).slice(0, 100));
});

app.get('/market-cap', (req, res) => {
    const data = loadCache(REALTIME_CACHE);
    res.json([...data].sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0)).slice(0, 100));
});

app.get('/price-per-share', (req, res) => {
    const data = loadCache(REALTIME_CACHE);
    res.json([...data].sort((a, b) => (b.price || 0) - (a.price || 0)).slice(0, 100));
});

app.get('/dollar-volume', (req, res) => {
    const data = loadCache(REALTIME_CACHE);
    res.json([...data].sort((a, b) => ((b.price * b.volume) || 0) - ((a.price * a.volume) || 0)).slice(0, 100));
});

app.get('/rsi-high', (req, res) => {
    const data = loadCache(TECH_CACHE);
    res.json(data.rsi ? data.rsi.filter(t => t.rsi > 70).slice(0, 100) : []);
});

app.get('/rsi-low', (req, res) => {
    const data = loadCache(TECH_CACHE);
    res.json(data.rsi ? data.rsi.filter(t => t.rsi < 30).slice(0, 100) : []);
});

app.get('/macd', (req, res) => {
    const data = loadCache(TECH_CACHE);
    res.json(data.macd || []);
});

app.get('/bollinger', (req, res) => {
    const data = loadCache(TECH_CACHE);
    res.json(data.bollinger || []);
});

app.get('/stochastic', (req, res) => {
    const data = loadCache(TECH_CACHE);
    res.json(data.stochastic || []);
});

app.get('/crypto-top', (req, res) => {
    const data = loadCache(CRYPTO_CACHE);
    res.json(data.slice(0, 50));
});

app.get('/sentiment', (req, res) => {
    const data = loadCache('./cache/sentiment.json');
    res.json(data || []);
});

app.get('/favorites', (req, res) => {
    const data = loadCache(FAVORITES_CACHE);
    res.json(data || []);
});

app.get('/', (req, res) => {
    res.send('✅ Stock100 backend is live.');
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
