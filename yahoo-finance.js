'use strict';

const fetch = require('node-fetch');
const fs = require('fs');
const fsp = fs.promises;
const parse = require('csv-parse/lib/sync');
const technicalIndicators = require('technicalindicators');

// async function checkCache(symbol) {
//   return await fsp.access(`stock-data/${symbol}.csv`);
// }

const chooseRandom = (array) => array[Math.floor(Math.random() * array.length)];

async function readCSV(path) {
  console.log(`Reading ${path}`);
  let content;

  // Read the content
  try {
    content = await fsp.readFile(path)
      .catch(error => {
        console.warn(`No cache exists for ${path}`);
        throw error;
      });

    // Parse the CSV content
    return parse(content, {
      columns: true,
      cast: true,
      cast_date: true,
    });
  } catch {
    return undefined;
  }
}

async function downloadStockData(symbol) {
  console.log(`Downloading ${symbol}`);
  const url = `https://query1.finance.yahoo.com/v7/finance/download/${symbol}?period1=511056000&period2=1612310400&interval=1d&events=history&includeAdjustedClose=true`;
  const file = fs.createWriteStream(`stock-data/${symbol}.csv`);
  const res = await fetch(url);

  await new Promise((resolve, reject) => {
    res.body.pipe(file);
    res.body.on('error', reject);
    file.on('finish', resolve);
  });
}

async function getStockData(symbol) {
  const cachePath = `stock-data/${symbol}.csv`;
  let cache = await readCSV(cachePath);

  if (!cache) {
    await downloadStockData(symbol);
    cache = await readCSV(cachePath);
  }

  return cache;
}

async function getRandomStock() {
  const manifest = await readCSV('stock-data/NYSE_manifest.csv');
  const stock = chooseRandom(manifest);
  if (stock.Symbol.includes('/')) {
    console.warn (`Random symbol ${stock.Symbol} contains unsupported characters and may cause errors`);
  }
  return stock;
}

/**
 * Adds a MACD poperty to an array of stockData (in place)
 * @param {*} stockData 
 * @returns {*} stockData with MACD added
 */
function processMACD(stockData) {
  const values = stockData.map(x => x.Close);
  const slowPeriod = 26
  const macd = technicalIndicators.macd({
    values,
    fastPeriod: 12,
    slowPeriod,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });
  macd.forEach((macd, index) => stockData[index + slowPeriod - 1].macd = macd);
  return stockData;
}

function simulateTradingMACD(stockData) {
  let investment = 0;
  let shares = 0;
  let profit = 0;
  let bought_price;

  stockData.forEach((day, index) => {
    if (!day.macd || !stockData[index-1].macd) { return; }

    // Buy
    if (day.macd.MACD <= 0 && stockData[index-1].macd.MACD > 0) {
      profit -= day.Close;
      investment += day.Close;
      shares++;
      bought_price = day.Close;
      console.log(`${day.Date.toLocaleDateString()}: Bought 1 share at $${day.Close.toFixed(2)}`);
    }

    // Sell
    const MACD_SELL_SIGNAL = day.macd.MACD >= 0 && stockData[index-1].macd.MACD < 0;
    const PROFITABLE = day.Close > bought_price;
    const LAST_DAY = index === stockData.length - 1;
    const STOP_LOSS = day.Close <= bought_price * 0.9;
    if (shares > 0 && ((MACD_SELL_SIGNAL && PROFITABLE) || STOP_LOSS || LAST_DAY )) {
      profit += shares * day.Close;
      console.log(`${day.Date.toLocaleDateString()}: Sold ${shares} share(s) at $${day.Close.toFixed(2)} ea. (${(((day.Close - bought_price) / bought_price) * 100).toFixed(2)}%)`);
      shares = 0;
    }
  });

  console.log(`$${profit.toFixed(2)} (${((profit / investment) * 100).toFixed(2)}% return)`);
}

async function main() {
  const stock = await getRandomStock();
  console.log(`Buying ${stock.Symbol} - ${stock.Name}`);
  // const symbol = 'MSFT';
  let stockData = await getStockData(stock.Symbol);
  const thisYear = new Date().getFullYear();
  stockData = stockData.filter(day => day.Date.getFullYear() >= thisYear - 1)
  stockData = processMACD(stockData);
  simulateTradingMACD(stockData);
}

main();