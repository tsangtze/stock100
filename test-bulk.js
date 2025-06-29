// ✅ Load .env first
require('dotenv').config();
const fs = require('fs');
const fetch = require('node-fetch');

const API_KEY = process.env.FMP_API_KEY;
const BASE = 'https://financialmodelingprep.com/api/v3';

console.log("🔑 API_KEY loaded:", API_KEY);

// ✅ Bulk quote fetch (max 5000)
async function fetchBulkQuotes() {
  try {
    const url = `${BASE}/stock-screener?limit=5000&apikey=${API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    // ✅ Check for valid array
    if (!Array.isArray(data)) {
      console.error("❌ FMP API error or wrong key:", data);
      return;
    }

    fs.writeFileSync('./cache/stock_bulk.json', JSON.stringify(data, null, 2));
    console.log(`✅ Saved ${data.length} stocks to cache`);
  } catch (err) {
    console.error("❌ Fetch error:", err.message);
  }
}

fetchBulkQuotes();
