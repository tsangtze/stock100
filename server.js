// ✅ server.js – Fully Polished with Technical Indicator Route Fix and Temporary Logging

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs');
const cron = require('node-cron');
const cleanup = require('./cleanupCache');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;
const API_KEY = process.env.FMP_API_KEY;
const BASE_URL = 'https://financialmodelingprep.com/api/v3';

const CACHE_DIR = './cache';
const REALTIME_CACHE = `${CACHE_DIR}/realtime-quote.json`;
const ALGO_CACHE = `${CACHE_DIR}/algo-screens.json`;
const TECH_CACHE = `${CACHE_DIR}/technical-screens.json`;

app.use(cors());
app.use(express.json());
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);

function isMarketOpen() {
    const now = new Date();
    const day = now.getUTCDay();
    const hour = now.getUTCHours();
    const min = now.getUTCMinutes();
    return day >= 1 && day <= 5 && (hour > 13 || (hour === 13 && min >= 30)) && hour < 20;
}

cron.schedule('* * * * *', async () => {
    if (!isMarketOpen()) return console.log('⏸️ Market closed, skipping bulk fetch.');
    try {
        const symbolsRes = await fetch(`${BASE_URL}/stock/list?apikey=${API_KEY}`);
        const symbolsData = await symbolsRes.json();
        const allSymbols = symbolsData.filter(s => s.symbol).map(s => s.symbol).slice(0, 5000);
        const batches = [];
        for (let i = 0; i < allSymbols.length; i += 200) {
            batches.push(allSymbols.slice(i, i + 200));
        }
        let allQuotes = [];
        for (const batch of batches) {
            const res = await fetch(`${BASE_URL}/quote/${batch.join(',')}?apikey=${API_KEY}`);
            const data = await res.json();
            if (Array.isArray(data)) allQuotes = allQuotes.concat(data);
            await new Promise(r => setTimeout(r, 2500));
        }
        if (allQuotes.length > 0) {
            fs.writeFileSync(REALTIME_CACHE, JSON.stringify(allQuotes));
            console.log(`✅ Bulk quotes cached (${allQuotes.length} stocks)`, new Date().toLocaleTimeString());
        } else {
            console.log('⚠️ Bulk fetch returned empty, retaining previous cache.');
        }
    } catch (err) {
        console.error('❌ Bulk fetch error:', err.message);
    }
});

const advancedRoutes = [
    'ai-picks-buy', 'ai-picks-sell', 'overbought', 'oversold', 'volatility',
    'trend-strength', 'top-100-eps', 'top-100-momentum-50ma', 'top-100-momentum-200ma',
    'top-100-high-beta', 'top-100-low-beta', 'top-100-consolidation'
];

advancedRoutes.forEach(route => {
    app.get(`/${route}`, (req, res) => {
        try {
            console.log(`🔹 Request received: /${route}`);
            let data = {};
            if (fs.existsSync(ALGO_CACHE)) {
                data = JSON.parse(fs.readFileSync(ALGO_CACHE, 'utf-8'));
            } else {
                console.warn(`⚠️ ${ALGO_CACHE} missing for ${route}, returning empty array`);
                return res.status(200).json([]);
            }
            res.json(data[route] || []);
        } catch (err) {
            console.error(`❌ Error on /${route}:`, err);
            res.status(500).json({ error: `Failed to load ${route}` });
        }
    });
});

const technicalRoutes = ['rsi', 'sma50', 'sma200'];

technicalRoutes.forEach(route => {
    app.get(`/${route}`, (req, res) => {
        try {
            console.log(`🔹 Request received: /${route}`);
            let data = {};
            if (fs.existsSync(TECH_CACHE)) {
                data = JSON.parse(fs.readFileSync(TECH_CACHE, 'utf-8'));
            } else {
                console.warn(`⚠️ ${TECH_CACHE} missing for ${route}, returning empty array`);
                return res.status(200).json([]);
            }
            res.json(data[route] || []);
        } catch (err) {
            console.error(`❌ Error on /${route}:`, err);
            res.status(500).json({ error: `Failed to load ${route}` });
        }
    });
});

const coreRoutes = [
    { path: '/gainers', sortFn: (a, b) => (b.changesPercentage || 0) - (a.changesPercentage || 0) },
    { path: '/losers', sortFn: (a, b) => (a.changesPercentage || 0) - (b.changesPercentage || 0) },
    { path: '/volume', sortFn: (a, b) => (b.volume || 0) - (a.volume || 0) },
    { path: '/most-volatile', sortFn: (a, b) => (b.beta || 0) - (a.beta || 0) },
];

coreRoutes.forEach(route => {
    app.get(route.path, (req, res) => {
        try {
            console.log(`🔹 Request received: ${route.path}`);
            const data = JSON.parse(fs.readFileSync(REALTIME_CACHE, 'utf-8'));
            const sorted = data.sort(route.sortFn);
            res.json(sorted);
        } catch (err) {
            console.error(`❌ Error on ${route.path}:`, err);
            res.status(500).json({ error: `Failed to load ${route.path.replace('/', '')}` });
        }
    });
});

app.get('/', (req, res) => {
    res.send('✅ Stock100 Backend is running. Use /gainers, /losers, /ai-picks-buy, /rsi, etc. to fetch data.');
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
