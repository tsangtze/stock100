// ✅ Stock100 Yahoo Backend – server.js (Part 1: Imports, Config, Utilities)

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

// Initialize Firestore (Favorites Handling)
if (fs.existsSync('./firebaseServiceKey.json')) {
    admin.initializeApp({
        credential: admin.credential.cert(require('./firebaseServiceKey.json'))
    });
    console.log('✅ Firestore initialized for favorites handling.');
} else {
    console.log('⚠️ firebaseServiceKey.json not found. Firestore features will be disabled.');
}

// Utility: Ensure folders exist
const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

const DATA_DIR = path.join(__dirname, 'data');
const STOCKS_DIR = path.join(DATA_DIR, 'stocks');
const CRYPTO_DIR = path.join(DATA_DIR, 'crypto');
const NEWS_DIR = path.join(DATA_DIR, 'news');
const INDICATORS_DIR = path.join(DATA_DIR, 'indicators');
const AI_PICKS_DIR = path.join(DATA_DIR, 'ai_picks');
const LOGS_DIR = path.join(__dirname, 'logs');

[DATA_DIR, STOCKS_DIR, CRYPTO_DIR, NEWS_DIR, INDICATORS_DIR, AI_PICKS_DIR, LOGS_DIR].forEach(ensureDir);

// Utility: Write JSON data to file
const saveJSON = (dir, filename, data) => {
    fs.writeFileSync(path.join(dir, `${filename}.json`), JSON.stringify(data, null, 2));
};

// Utility: Read JSON data from file
const readJSON = (dir, filename) => {
    const filePath = path.join(dir, `${filename}.json`);
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath));
    }
    return null;
};

// Utility: Log to daily file
const log = (message) => {
    const logFile = path.join(LOGS_DIR, `${new Date().toISOString().slice(0, 10)}.log`);
    fs.appendFileSync(logFile, `${new Date().toISOString()} - ${message}\n`);
    console.log(message);
};

log('✅ Stock100 Yahoo backend initialized.');
// ✅ Stock100 Yahoo Backend – server.js (Part 2: Stocks Fetch Logic)

// Utility to fetch Yahoo pre-sorted stock lists
async function fetchYahooStocks(endpoint, filename) {
    try {
        const url = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?count=100&scrIds=${endpoint}`;
        const response = await axios.get(url);
        const quotes = response.data.finance.result[0].quotes || [];
        saveJSON(STOCKS_DIR, filename, quotes);
        log(`✅ Stocks fetched for ${filename} (${quotes.length} symbols)`);
    } catch (error) {
        log(`❌ Error fetching stocks for ${filename}: ${error.message}`);
    }
}

// Cron: 5-min during market hours (13:30–20:00 UTC) Mon-Fri
cron.schedule('*/5 13-20 * * 1-5', async () => {
    log('⏱️ Running 5-min stocks fetch (market hours)');
    await fetchYahooStocks('day_gainers', 'gainers');
    await fetchYahooStocks('day_losers', 'losers');
    await fetchYahooStocks('most_actives', 'most_active');
    await fetchYahooStocks('trending_tickers', 'trending');
}, { timezone: 'UTC' });

// Cron: 15-min pre/post-market (11:00–13:00 & 20:00–22:00 UTC) Mon-Fri
cron.schedule('*/15 11-13,20-22 * * 1-5', async () => {
    log('⏱️ Running 15-min stocks fetch (pre/post market)');
    await fetchYahooStocks('day_gainers', 'gainers');
    await fetchYahooStocks('day_losers', 'losers');
    await fetchYahooStocks('most_actives', 'most_active');
    await fetchYahooStocks('trending_tickers', 'trending');
}, { timezone: 'UTC' });

// 52-week high/low daily at 10:30 UTC (6:30 AM ET)
cron.schedule('30 10 * * 1-5', async () => {
    log('⏱️ Running daily 52w high/low fetch');
    await fetchYahooStocks('undervalued_growth_stocks', '52w_high'); // Use best available approximation
    await fetchYahooStocks('growth_technology_stocks', '52w_low');   // Use best available approximation
}, { timezone: 'UTC' });

// API routes to serve stocks data
app.get('/gainers', (req, res) => res.json(readJSON(STOCKS_DIR, 'gainers') || []));
app.get('/losers', (req, res) => res.json(readJSON(STOCKS_DIR, 'losers') || []));
app.get('/most-active', (req, res) => res.json(readJSON(STOCKS_DIR, 'most_active') || []));
app.get('/trending', (req, res) => res.json(readJSON(STOCKS_DIR, 'trending') || []));
app.get('/52w-high', (req, res) => res.json(readJSON(STOCKS_DIR, '52w_high') || []));
app.get('/52w-low', (req, res) => res.json(readJSON(STOCKS_DIR, '52w_low') || []));
// ✅ Stock100 Yahoo Backend – server.js (Part 3: Crypto Fetch Logic)

// Utility to fetch Yahoo crypto data
async function fetchYahooCrypto(endpoint, filename) {
    try {
        const url = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?count=100&scrIds=${endpoint}`;
        const response = await axios.get(url);
        const quotes = response.data.finance.result[0].quotes || [];
        saveJSON(CRYPTO_DIR, filename, quotes);
        log(`✅ Crypto fetched for ${filename} (${quotes.length} symbols)`);
    } catch (error) {
        log(`❌ Error fetching crypto for ${filename}: ${error.message}`);
    }
}

// Cron: Fetch crypto every 15 min
cron.schedule('*/15 * * * *', async () => {
    log('⏱️ Running 15-min crypto fetch');
    await fetchYahooCrypto('cryptocurrencies', 'crypto_volume');
    await fetchYahooCrypto('top_crypto_gainers', 'crypto_gainers');
    await fetchYahooCrypto('most_traded_cryptocurrencies', 'crypto_trending');
}, { timezone: 'UTC' });

// API routes to serve crypto data
app.get('/crypto-volume', (req, res) => res.json(readJSON(CRYPTO_DIR, 'crypto_volume') || []));
app.get('/crypto-gainers', (req, res) => res.json(readJSON(CRYPTO_DIR, 'crypto_gainers') || []));
app.get('/crypto-trending', (req, res) => res.json(readJSON(CRYPTO_DIR, 'crypto_trending') || []));
// ✅ Stock100 Yahoo Backend – server.js (Part 4: Hourly Indicators Calculation)

// Placeholder lightweight indicator calculation using dummy logic
async function calculateIndicatorsForSymbol(symbol) {
    try {
        // You can expand to fetch candles from Yahoo/AlphaVantage if you enable
        const indicators = {
            symbol,
            sma20: Math.random() * 100 + 50,
            sma50: Math.random() * 100 + 50,
            ema20: Math.random() * 100 + 50,
            ema50: Math.random() * 100 + 50,
            rsi14: Math.random() * 50 + 25,
            macd: Math.random() * 2 - 1,
            atr: Math.random() * 5,
            bollinger_upper: Math.random() * 100 + 100,
            bollinger_lower: Math.random() * 50,
            vwap: Math.random() * 100 + 50,
            timestamp: new Date()
        };
        saveJSON(INDICATORS_DIR, symbol, indicators);
        log(`✅ Indicators calculated for ${symbol}`);
    } catch (error) {
        log(`❌ Error calculating indicators for ${symbol}: ${error.message}`);
    }
}

// Cron: Calculate indicators hourly for top 10 gainers
cron.schedule('0 * * * *', async () => {
    log('⏱️ Running hourly indicators calculation');
    const gainers = readJSON(STOCKS_DIR, 'gainers') || [];
    const topSymbols = gainers.slice(0, 10).map(stock => stock.symbol);
    for (const symbol of topSymbols) {
        await calculateIndicatorsForSymbol(symbol);
    }
}, { timezone: 'UTC' });

// API route to fetch indicators
app.get('/indicators/:symbol', (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const indicators = readJSON(INDICATORS_DIR, symbol);
    if (indicators) {
        res.json(indicators);
    } else {
        res.status(404).json({ error: 'Indicators not found' });
    }
});
// ✅ Stock100 Yahoo Backend – server.js (Adjusted Part 5: AI Picks Generation with Buy/Sell Bias, Neutral hidden for frontend)

function classifyStock(indicators) {
    if (!indicators) return 'neutral';

    const { rsi14, sma20, sma50, vwap } = indicators;
    let buyScore = 0;
    let sellScore = 0;

    // Buy signals
    if (rsi14 > 40 && rsi14 < 60) buyScore++;
    if (sma20 && sma20 > sma50) buyScore++;
    if (vwap && vwap < sma20) buyScore++;
    if (Math.random() > 0.5) buyScore++; // Simulated sentiment

    // Sell signals
    if (rsi14 > 70 || rsi14 < 30) sellScore++;
    if (sma20 && sma20 < sma50) sellScore++;
    if (vwap && vwap > sma20) sellScore++;
    if (Math.random() > 0.5) sellScore++; // Simulated sentiment

    if (buyScore >= 3 && buyScore > sellScore) return 'buy';
    if (sellScore >= 3 && sellScore > buyScore) return 'sell';
    return 'neutral';
}

async function generateAIPicks() {
    try {
        log('⚡ Generating AI Picks with comparative scoring');

        const gainers = readJSON(STOCKS_DIR, 'gainers') || [];
        const losers = readJSON(STOCKS_DIR, 'losers') || [];
        const allSymbols = [...new Set([...gainers, ...losers].map(stock => stock.symbol))];

        const scoredStocks = [];

        for (const symbol of allSymbols) {
            const indicators = readJSON(INDICATORS_DIR, symbol);
            if (!indicators) continue;

            let score = 0;

            if (indicators.rsi14 > 40 && indicators.rsi14 < 60) score += 1;
            if (indicators.sma20 > indicators.sma50) score += 1;
            if (indicators.vwap < indicators.sma20) score += 1;
            if (indicators.volume && indicators.averageVolume && indicators.volume > 1.5 * indicators.averageVolume) score += 1;

            scoredStocks.push({
                symbol,
                score,
                rsi14: indicators.rsi14,
                sma20: indicators.sma20,
                sma50: indicators.sma50,
                vwap: indicators.vwap,
                volume: indicators.volume,
                avgVolume: indicators.averageVolume,
                timestamp: new Date()
            });
        }

        // Sort descending for buys, ascending for sells
        const sortedForBuy = [...scoredStocks].sort((a, b) => b.score - a.score);
        const sortedForSell = [...scoredStocks].sort((a, b) => a.score - b.score);

        const picks = {
            buy: sortedForBuy.slice(0, 10),
            sell: sortedForSell.slice(0, 10),
            generated: new Date()
        };

        saveJSON(AI_PICKS_DIR, 'stock_ai_picks', picks);
        log(`✅ AI Picks generated: ${picks.buy.length} Buy, ${picks.sell.length} Sell`);

    } catch (error) {
        log(`❌ Error generating AI Picks: ${error.message}`);
    }
}


// Cron: 10 AM ET and 3 PM ET
cron.schedule('0 10,15 * * 1-5', generateAIPicks, { timezone: 'America/New_York' });

// Route to fetch AI Picks
app.get('/ai-picks-stock', (req, res) => {
    const picks = readJSON(AI_PICKS_DIR, 'stock_ai_picks');
    if (picks) {
        // Frontend only needs 'buy' and 'sell'
        res.json({
            buy: picks.buy,
            sell: picks.sell,
            generated: picks.generated
        });
    } else {
        res.status(404).json({ error: 'AI Picks not found' });
    }
});
// ✅ Stock100 Yahoo Backend – server.js (Part 6: News Fetch Logic Recap)

async function fetchGeneralMarketNews() {
    try {
        log('📰 Fetching general market news at 10AM ET');
        // Placeholder simulated news
        const data = [{ headline: 'Market Update: Stocks Mixed Amid Economic Data', timestamp: new Date() }];
        saveJSON(NEWS_DIR, 'market_general', data);
        log('✅ General market news saved.');
    } catch (error) {
        log(`❌ Error fetching general market news: ${error.message}`);
    }
}

async function fetchNewsForSymbol(symbol) {
    try {
        log(`📰 Fetching news for ${symbol}`);
        // Placeholder simulated news
        const data = [{ headline: `News for ${symbol}`, timestamp: new Date() }];
        saveJSON(NEWS_DIR, symbol, data);
        log(`✅ News saved for ${symbol}`);
    } catch (error) {
        log(`❌ Error fetching news for ${symbol}: ${error.message}`);
    }
}

// Cleanup news older than 3 days
function cleanupOldNews() {
    const files = fs.readdirSync(NEWS_DIR);
    const now = Date.now();
    files.forEach(file => {
        const filePath = path.join(NEWS_DIR, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > 3 * 24 * 60 * 60 * 1000) {
            fs.unlinkSync(filePath);
            log(`🗑️ Deleted old news: ${file}`);
        }
    });
}

// Cron: 10AM ET general market news
cron.schedule('0 10 * * 1-5', fetchGeneralMarketNews, { timezone: 'America/New_York' });

// Cron: 2:00PM ET start, fetch 1 symbol every 20 sec for 50 min
cron.schedule('0 14 * * 1-5', () => {
    log('🕑 Starting sequential news fetch for top symbols (2:00–2:50 PM ET)');
    const gainers = readJSON(STOCKS_DIR, 'gainers') || [];
    const topSymbols = gainers.slice(0, 50).map(stock => stock.symbol);
    let index = 0;
    const interval = setInterval(() => {
        if (index >= topSymbols.length) {
            clearInterval(interval);
            log('✅ Completed sequential news fetch.');
            return;
        }
        fetchNewsForSymbol(topSymbols[index]);
        index++;
    }, 20000); // every 20 sec
}, { timezone: 'America/New_York' });

// Daily cleanup at midnight
cron.schedule('0 0 * * *', cleanupOldNews, { timezone: 'UTC' });

// Route to get news for a symbol
app.get('/news/:symbol', (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const news = readJSON(NEWS_DIR, symbol);
    if (news) {
        res.json({ symbol, news });
    } else {
        res.status(404).json({ error: 'News not found for this symbol' });
    }
});
// ✅ Stock100 Yahoo Backend – server.js (Part 7: Firestore Favorites Handling)

const db = admin.apps.length ? admin.firestore() : null;

// Refresh favorites hourly during market hours (13:30–20:00 UTC)
cron.schedule('0 * * * 1-5', async () => {
    if (!db) {
        log('⚠️ Firestore not initialized. Skipping favorites refresh.');
        return;
    }
    log('🔄 Refreshing user favorites...');
    try {
        const snapshot = await db.collection('favorites').get();
        snapshot.forEach(async doc => {
            const data = doc.data();
            if (data.symbols && Array.isArray(data.symbols)) {
                const updated = [];
                for (const symbol of data.symbols) {
                    // Placeholder refresh: you can expand to fetch live data if desired
                    updated.push({ symbol, refreshedAt: new Date() });
                }
                await db.collection('favorites').doc(doc.id).update({ symbols: updated });
                log(`✅ Favorites refreshed for user ${doc.id}`);
            }
        });
    } catch (error) {
        log(`❌ Error refreshing favorites: ${error.message}`);
    }
}, { timezone: 'UTC' });

// Cleanup favorites older than 7 days at 1 AM UTC
cron.schedule('0 1 * * *', async () => {
    if (!db) {
        log('⚠️ Firestore not initialized. Skipping favorites cleanup.');
        return;
    }
    log('🗑️ Cleaning up old favorites...');
    try {
        const snapshot = await db.collection('favorites').get();
        const now = Date.now();
        snapshot.forEach(async doc => {
            const data = doc.data();
            const createdAt = data.createdAt ? data.createdAt.toDate().getTime() : now;
            if (now - createdAt > 7 * 24 * 60 * 60 * 1000) {
                await db.collection('favorites').doc(doc.id).delete();
                log(`✅ Deleted stale favorites for user ${doc.id}`);
            }
        });
    } catch (error) {
        log(`❌ Error cleaning up favorites: ${error.message}`);
    }
}, { timezone: 'UTC' });

// Route to fetch a user's favorites
app.get('/favorites/:uid', async (req, res) => {
    if (!db) {
        return res.status(503).json({ error: 'Firestore not configured on server.' });
    }
    const uid = req.params.uid;
    try {
        const doc = await db.collection('favorites').doc(uid).get();
        if (doc.exists) {
            res.json(doc.data());
        } else {
            res.status(404).json({ error: 'Favorites not found for this user.' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ✅ Stock100 Yahoo Backend – server.js (Part 8: Disk Cleanup & Server Listener)

// General disk cleanup: remove stale JSON files older than 14 days
function cleanupOldDataFiles() {
    const now = Date.now();
    const cleanupDirs = [STOCKS_DIR, CRYPTO_DIR, INDICATORS_DIR, AI_PICKS_DIR];
    cleanupDirs.forEach(dir => {
        fs.readdirSync(dir).forEach(file => {
            const filePath = path.join(dir, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > 14 * 24 * 60 * 60 * 1000) {
                fs.unlinkSync(filePath);
                log(`🗑️ Deleted old data file: ${filePath}`);
            }
        });
    });
}

// Run cleanup daily at 2 AM UTC
cron.schedule('0 2 * * *', cleanupOldDataFiles, { timezone: 'UTC' });

// ✅ Stock100 Yahoo Backend – server.js (Part 9: Crypto Indicators Calculation)

async function calculateIndicatorsForCrypto(symbol) {
    try {
        // Placeholder: Replace with real candle fetch when ready
        const indicators = {
            symbol,
            sma20: Math.random() * 50000 + 1000,
            sma50: Math.random() * 50000 + 1000,
            ema20: Math.random() * 50000 + 1000,
            ema50: Math.random() * 50000 + 1000,
            rsi14: Math.random() * 50 + 25,
            macd: Math.random() * 2 - 1,
            atr: Math.random() * 500,
            bollinger_upper: Math.random() * 50000 + 1000,
            bollinger_lower: Math.random() * 1000,
            vwap: Math.random() * 50000 + 1000,
            timestamp: new Date()
        };
        saveJSON(INDICATORS_DIR, `crypto_${symbol}`, indicators);
        log(`✅ Crypto indicators calculated for ${symbol}`);
    } catch (error) {
        log(`❌ Error calculating crypto indicators for ${symbol}: ${error.message}`);
    }
}

// Cron: Calculate crypto indicators hourly for top 10 gainers
cron.schedule('0 * * * *', async () => {
    log('⏱️ Running hourly crypto indicators calculation');
    const gainers = readJSON(CRYPTO_DIR, 'crypto_gainers') || [];
    const topSymbols = gainers.slice(0, 10).map(crypto => crypto.symbol.replace(/-USD$/, ''));
    for (const symbol of topSymbols) {
        await calculateIndicatorsForCrypto(symbol);
    }
}, { timezone: 'UTC' });

// API route to fetch crypto indicators
app.get('/indicators-crypto/:symbol', (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const indicators = readJSON(INDICATORS_DIR, `crypto_${symbol}`);
    if (indicators) {
        res.json(indicators);
    } else {
        res.status(404).json({ error: 'Crypto indicators not found' });
    }
});
// ✅ Stock100 Yahoo Backend – server.js (Part 10: Crypto AI Picks Generation)

function classifyCrypto(indicators) {
    if (!indicators) return 'neutral';

    const { rsi14, sma20, sma50, vwap } = indicators;
    let buyScore = 0;
    let sellScore = 0;

    if (rsi14 > 40 && rsi14 < 60) buyScore++;
    if (sma20 && sma20 > sma50) buyScore++;
    if (vwap && vwap < sma20) buyScore++;
    if (Math.random() > 0.5) buyScore++;

    if (rsi14 > 70 || rsi14 < 30) sellScore++;
    if (sma20 && sma20 < sma50) sellScore++;
    if (vwap && vwap > sma20) sellScore++;
    if (Math.random() > 0.5) sellScore++;

    if (buyScore >= 3 && buyScore > sellScore) return 'buy';
    if (sellScore >= 3 && sellScore > buyScore) return 'sell';
    return 'neutral';
}

async function generateCryptoAIPicks() {
    try {
        log('⚡ Generating Crypto AI Picks with Buy/Sell Bias');
        const gainers = readJSON(CRYPTO_DIR, 'crypto_gainers') || [];
        const topSymbols = gainers.slice(0, 20).map(crypto => crypto.symbol.replace(/-USD$/, ''));

        const picks = {
            buy: [],
            sell: [],
            neutral: [],
            generated: new Date()
        };

        for (const symbol of topSymbols) {
            const indicators = readJSON(INDICATORS_DIR, `crypto_${symbol}`);
            const bias = classifyCrypto(indicators);
            picks[bias].push({
                symbol,
                rsi14: indicators ? indicators.rsi14 : null,
                sma20: indicators ? indicators.sma20 : null,
                sma50: indicators ? indicators.sma50 : null,
                vwap: indicators ? indicators.vwap : null,
                timestamp: new Date()
            });
        }

        saveJSON(AI_PICKS_DIR, 'crypto_ai_picks', picks);
        log(`✅ Crypto AI Picks generated: ${picks.buy.length} Buy, ${picks.sell.length} Sell, ${picks.neutral.length} Neutral`);
    } catch (error) {
        log(`❌ Error generating Crypto AI Picks: ${error.message}`);
    }
}

// Cron: 10 AM ET and 3 PM ET
cron.schedule('0 10,15 * * *', generateCryptoAIPicks, { timezone: 'America/New_York' });

// Route to fetch crypto AI picks
app.get('/ai-picks-crypto', (req, res) => {
    const picks = readJSON(AI_PICKS_DIR, 'crypto_ai_picks');
    if (picks) {
        res.json({
            buy: picks.buy,
            sell: picks.sell,
            generated: picks.generated
        });
    } else {
        res.status(404).json({ error: 'Crypto AI Picks not found' });
    }
});
// ✅ Stock100 Yahoo Backend – server.js (Part 11: Crypto General News Fetch)

async function fetchGeneralCryptoNews() {
    try {
        log('📰 Fetching general crypto market news at 9AM ET');
        // Placeholder: Replace with Yahoo/CryptoPanic/CoinGecko fetch when ready
        const data = [
            { headline: 'Crypto Market Update: Bitcoin and Altcoins Show Mixed Signals', timestamp: new Date() },
            { headline: 'Ethereum Approaches Key Resistance Level as Market Awaits CPI Data', timestamp: new Date() }
        ];
        saveJSON(NEWS_DIR, 'crypto_general', data);
        log('✅ General crypto market news saved.');
    } catch (error) {
        log(`❌ Error fetching general crypto market news: ${error.message}`);
    }
}

// Cron: 9 AM ET daily
cron.schedule('0 9 * * *', fetchGeneralCryptoNews, { timezone: 'America/New_York' });

// Route to fetch general crypto news
app.get('/news/crypto', (req, res) => {
    const news = readJSON(NEWS_DIR, 'crypto_general');
    if (news) {
        res.json({ news });
    } else {
        res.status(404).json({ error: 'Crypto news not found' });
    }
});

// TEMP: Force initial fetch and AI Picks on Sunday for testing

(async () => {
    await fetchYahooStocks('day_gainers', 'gainers');
    await fetchYahooStocks('day_losers', 'losers');
    await generateAIPicks();
    await fetchNewsForSymbol('AAPL');
})();

// Final server listener
app.listen(PORT, () => {
    log(`🚀 Stock100 Yahoo backend is live on port ${PORT}`);
    console.log(`🚀 Stock100 Yahoo backend is live on port ${PORT}`);
});