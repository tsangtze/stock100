// ✅ server.js – FINAL CLEAN FULL BACKEND WITH TRUE 1/MIN BULK FETCH + ADVANCED FILTERING + AI/TECH ROUTES

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const fs = require('fs');
const cron = require('node-cron');
const cleanup = require('./cleanupCache');
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

function isMarketOpen() {
    const now = new Date();
    const day = now.getUTCDay();
    const hour = now.getUTCHours();
    const min = now.getUTCMinutes();
    return day >= 1 && day <= 5 && (hour > 13 || (hour === 13 && min >= 30)) && hour < 20;
}

cron.schedule('* * * * *', async () => {
    if (!isMarketOpen()) return console.log("⏸️ Market closed, skipping bulk fetch.");
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

            let techData = {};
            if (fs.existsSync(TECH_CACHE)) {
                techData = JSON.parse(fs.readFileSync(TECH_CACHE));
            }

            const clean = allQuotes.filter(s => s.symbol && s.price > 0);
            const hasRSIData = Array.isArray(techData.rsi) && techData.rsi.some(t => t.rsi);
            const hasSMAData = Array.isArray(techData.sma50) && techData.sma50.some(t => t.sma50) &&
                               Array.isArray(techData.sma200) && techData.sma200.some(t => t.sma200);

            const screens = {
                'ai-picks-buy': clean.filter(s => s.changesPercentage > 0).slice(0, 10),
                'ai-picks-sell': clean.filter(s => s.changesPercentage < 0).slice(0, 10),
                'overbought': hasRSIData ? clean.filter(s => techData.rsi.some(t => t.symbol.toUpperCase() === s.symbol.toUpperCase() && t.rsi > 40)).slice(0, 10) : [{ message: "none" }],
                'oversold': hasRSIData ? clean.filter(s => techData.rsi.some(t => t.symbol.toUpperCase() === s.symbol.toUpperCase() && t.rsi < 20)).slice(0, 10) : [{ message: "none" }],
                'volatility': clean.sort((a, b) => (b.beta || 0) - (a.beta || 0)).slice(0, 10),
                'trend-strength': hasSMAData ? clean.filter(s =>
                    techData.sma50.some(t => t.symbol.toUpperCase() === s.symbol.toUpperCase() && s.price > t.sma50) &&
                    techData.sma200.some(t => t.symbol.toUpperCase() === s.symbol.toUpperCase() && s.price > t.sma200)
                ).slice(0, 10) : [{ message: "none" }],
                'top-100-eps': clean.sort((a, b) => (b.eps || 0) - (a.eps || 0)).slice(0, 100),
                'top-100-momentum-50ma': hasSMAData ? clean.filter(s => techData.sma50.some(t => t.symbol.toUpperCase() === s.symbol.toUpperCase() && s.price > t.sma50)).slice(0, 100) : [{ message: "none" }],
                'top-100-momentum-200ma': hasSMAData ? clean.filter(s => techData.sma200.some(t => t.symbol.toUpperCase() === s.symbol.toUpperCase() && s.price > t.sma200)).slice(0, 100) : [{ message: "none" }],
                'top-100-high-beta': clean.sort((a, b) => (b.beta || 0) - (a.beta || 0)).slice(0, 100),
                'top-100-low-beta': clean.sort((a, b) => (a.beta || 0) - (b.beta || 0)).slice(0, 100),
                'top-100-consolidation': hasSMAData ? clean.filter(s => {
                    const sma50 = techData.sma50.find(t => t.symbol.toUpperCase() === s.symbol.toUpperCase())?.sma50;
                    const sma200 = techData.sma200.find(t => t.symbol.toUpperCase() === s.symbol.toUpperCase())?.sma200;
                    if (sma50 && sma200) {
                        const diff = Math.abs(sma50 - sma200);
                        return diff / sma200 < 0.02;
                    }
                    return false;
                }).slice(0, 100) : [{ message: "none" }],
            };

            fs.writeFileSync(ALGO_CACHE, JSON.stringify(screens));
            console.log("📊 AI/TECH screens updated using daily tech data", new Date().toLocaleTimeString());
        } else {
            console.log("⚠️ Bulk fetch returned empty, retaining previous cache.");
        }
    } catch (err) {
        console.error("❌ Bulk fetch error:", err.message);
    }
});

// Serve AI/TECH JSON routes for frontend fetch
const routes = [
    'ai-picks-buy','ai-picks-sell','overbought','oversold','volatility','trend-strength',
    'top-100-eps','top-100-momentum-50ma','top-100-momentum-200ma','top-100-high-beta','top-100-low-beta','top-100-consolidation'
];

routes.forEach(route => {
    app.get(`/${route}`, (req, res) => {
        try {
            if (fs.existsSync(ALGO_CACHE)) {
                const data = JSON.parse(fs.readFileSync(ALGO_CACHE));
                return res.json(data[route] || { message: 'No data available for this route.' });
            } else {
                return res.json({ message: 'Cache not ready yet, try again shortly.' });
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    });
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
