// ✅ server.js – Switched to Yahoo fetch for testing, FMP fetch disabled, all other features untouched

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const cron = require('node-cron');
const cleanup = require('./cleanupCache');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

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

// ✅ Replace FMP fetch with Yahoo fetch for testing, using local yahoo_fetch.py
cron.schedule('*/30 * * * *', async () => {
    if (!isMarketOpen()) return console.log('⏸️ Market closed, skipping Yahoo fetch.');
    try {
        console.log('🚀 Running Yahoo fetch test...');
        const { exec } = require('child_process');
        exec('python yahoo_fetch.py', (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Yahoo fetch error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`⚠️ Yahoo fetch stderr: ${stderr}`);
                return;
            }
            console.log(`✅ Yahoo fetch output:\n${stdout}`);
        });
    } catch (err) {
        console.error('❌ Yahoo fetch execution failed:', err.message);
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
    res.send('✅ Stock100 Backend (Yahoo Testing) is running. Use /gainers, /losers, /ai-picks-buy, /rsi, etc. to fetch data.');
});
// Serve Yahoo JSON data
const path = require('path');
app.get('/yahoo/:symbol', (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const filePath = path.join(__dirname, `${symbol}_last5days.json`);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: `No data for ${symbol}. Please run yahoo_fetch_batch.py first.` });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
