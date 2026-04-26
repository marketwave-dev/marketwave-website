// netlify/functions/ticker.js
// Runs on Netlify's servers — no CORS issues
// Fetches last price from Yahoo Finance (works when market open OR closed)

const https = require('https');

const SYMBOLS = ['SPY','QQQ','IWM','NVDA','TSLA','META','MSFT','AAPL','GOOGL','AMD','MU','PLTR','HOOD','COIN','MSTR'];

function fetchURL(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Parse error')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

exports.handler = async () => {
  const syms   = SYMBOLS.join(',');
  const fields  = 'symbol,regularMarketPrice,regularMarketChange,regularMarketChangePercent,marketState';
  const urls    = [
    `https://query1.finance.yahoo.com/v8/finance/quote?symbols=${syms}&fields=${fields}`,
    `https://query2.finance.yahoo.com/v8/finance/quote?symbols=${syms}&fields=${fields}`,
  ];

  for (const url of urls) {
    try {
      const data   = await fetchURL(url);
      const quotes = data?.quoteResponse?.result;
      if (!quotes || quotes.length === 0) continue;

      const result = quotes.map(q => ({
        symbol:  q.symbol,
        price:   q.regularMarketPrice,
        change:  q.regularMarketChange,
        pct:     q.regularMarketChangePercent,
        state:   q.marketState, // REGULAR=open, CLOSED/PRE/POST=closed
      }));

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=30', // cache 30s
        },
        body: JSON.stringify({ success: true, quotes: result }),
      };
    } catch (e) {
      continue;
    }
  }

  return {
    statusCode: 500,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ success: false, error: 'Failed to fetch prices' }),
  };
};
