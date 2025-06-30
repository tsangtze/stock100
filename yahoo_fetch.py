# yahoo_fetch_batch.py

import yfinance as yf
import pandas as pd
import time

def fetch_and_save(ticker_symbol):
    try:
        ticker = yf.Ticker(ticker_symbol)
        hist = ticker.history(period="5d")
        if hist.empty:
            print(f"⚠️ No data for {ticker_symbol}")
            return
        print(f"\n=== {ticker_symbol} ===")
        print(hist)

        json_data = hist.reset_index().to_json(orient='records', date_format='iso')
        filename = f"{ticker_symbol}_last5days.json"
        with open(filename, "w") as f:
            f.write(json_data)
        print(f"✅ Saved data to {filename}")
    except Exception as e:
        print(f"❌ Error fetching {ticker_symbol}: {e}")

if __name__ == "__main__":
    # Example 50 tickers for test
    symbols = [
        "AAPL", "MSFT", "GOOG", "AMZN", "META", "TSLA", "NVDA", "NFLX", "INTC", "AMD",
        "ADBE", "CRM", "PYPL", "CSCO", "ORCL", "QCOM", "AVGO", "TXN", "INTU", "IBM",
        "SHOP", "BABA", "UBER", "LYFT", "SQ", "TWLO", "ZM", "PLTR", "ROKU", "SPOT",
        "DIS", "V", "MA", "JPM", "BAC", "WFC", "C", "GS", "MS", "AXP", "COIN",
        "T", "VZ", "TMUS", "PFE", "MRNA", "JNJ", "UNH", "CVS", "TMO", "ABT"
    ]

    for symbol in symbols:
        fetch_and_save(symbol)
        time.sleep(1)  # 1-second pause per fetch for safety
