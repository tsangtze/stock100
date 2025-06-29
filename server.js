// ✅ server.js – Full Backend with All Consistent Routes and No Lost Features

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

// Market open check for cron
function isMarketOpen() {
    const now = new Date();
    const day = now.getUTCDay();
    const hour = now.getUTCHours();
    const min = now.getUTCMinutes();
    return day >= 1 && day <= 5 && (hour > 13 || (hour === 13 && min >= 30)) && hour < 20;
}

// 1/min bulk fetch cron
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

// Helper to safely load algo screens
targetRoutes = [
    'ai-picks-buy', 'ai-picks-sell', 'overbought', 'oversold', 'volatility',
    'trend-strength', 'top-100-eps', 'top-100-momentum-50ma', 'top-100-momentum-200ma',
    'top-100-high-beta', 'top-100-low-beta', 'top-100-consolidation'
];

targetRoutes.forEach(route => {
    app.get(`/${route}`, (req, res) => {
        try {
            let data = {};
            try {
                data = JSON.parse(fs.readFileSync(ALGO_CACHE, 'utf-8'));
            } catch {
                console.error('⚠️ algo-screens.json missing or unreadable, returning empty array');
                return res.status(200).json([]);
            }
            if (data[route]) {
                res.json(data[route]);
            } else {
                res.status(200).json([]);
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: `Failed to load ${route}` });
        }
    });
});

// Gainers route
app.get('/gainers', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(REALTIME_CACHE, 'utf-8'));
        const sorted = data.sort((a, b) => (b.changesPercentage || 0) - (a.changesPercentage || 0));
        res.json(sorted);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load gainers' });
    }
});

// Losers route
app.get('/losers', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(REALTIME_CACHE, 'utf-8'));
        const sorted = data.sort((a, b) => (a.changesPercentage || 0) - (b.changesPercentage || 0));
        res.json(sorted);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load losers' });
    }
});

// Volume route
app.get('/volume', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(REALTIME_CACHE, 'utf-8'));
        const sorted = data.sort((a, b) => (b.volume || 0) - (a.volume || 0));
        res.json(sorted);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load volume' });
    }
});

// Most volatile route
app.get('/most-volatile', (req, res) => {
    try {
        const data = JSON.parse(fs.readFileSync(REALTIME_CACHE, 'utf-8'));
        const sorted = data.sort((a, b) => (b.beta || 0) - (a.beta || 0));
        res.json(sorted);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load most volatile' });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
