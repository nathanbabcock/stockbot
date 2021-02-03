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
  const res = await fetch(url);

  await new Promise((resolve, reject) => {
    if (res.status !== 200) {
      console.error(`Status code ${res.status} for symbol ${symbol}`);
      return reject();
    } 
    
    const file = fs.createWriteStream(`stock-data/${symbol}.csv`);
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
function addMACD(stockData) {
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
      // console.log(`${day.Date.toLocaleDateString()}: Bought 1 share at $${day.Close.toFixed(2)}`);
    }

    // Sell
    const MACD_SELL_SIGNAL = day.macd.MACD >= 0 && stockData[index-1].macd.MACD < 0;
    const PROFITABLE = day.Close > bought_price;
    const LAST_DAY = index === stockData.length - 1;
    const STOP_LOSS = day.Close <= bought_price * 0.9;
    if (shares > 0 && ((MACD_SELL_SIGNAL && PROFITABLE) || STOP_LOSS || LAST_DAY )) {
      profit += shares * day.Close;
      // console.log(`${day.Date.toLocaleDateString()}: Sold ${shares} share(s) at $${day.Close.toFixed(2)} ea. (${(((day.Close - bought_price) / bought_price) * 100).toFixed(2)}%)`);
      shares = 0;
    }
  });

  let roi = ((profit / investment) * 100).toFixed(2);
  console.log(`$${profit.toFixed(2)} (${roi}% return)`);
  return { investment, profit, roi };
}

function simulateTradingMaxHold(stockData) {
  let investment = 0;
  let shares = 0;
  let profit = 0;

  // Buy
  const firstDay = stockData[0];
  profit -= firstDay.Close;
  investment += firstDay.Close;
  shares++;

  // Sell
  const lastDay = stockData[stockData.length - 1];
  profit += shares * lastDay.Close;
  shares = 0;

  if (isNaN(profit)) profit = 0;
  if (isNaN(investment)) investment = 0;

  let roi = ((profit / investment) * 100).toFixed(2);
  console.log(`$${profit.toFixed(2)} (${roi}% return)`);
  return { investment, profit, roi };
}

async function harvestData() {
  let manifest = await readCSV('stock-data/NYSE_manifest.csv');
  let failed = ['Symbol'];

  for (const stock of manifest) {
    try {
      await getStockData(stock.Symbol);
    } catch {
      failed.push(stock);
    }
  };

  const failedManifest = 'stock-data/404.csv';
  await fsp.writeFile(failedManifest, failed.map(x => x.Symbol).join('\n'));
  console.log(`Wrote ${failed.length} failed entries to ${failedManifest}`)
}

async function generateReport(simFunc, reportId) {
  let manifest = await readCSV('stock-data/NYSE_manifest.csv');
  let blacklist = (await readCSV('stock-data/404.csv')).map(x => x.Symbol);
  let report = 'symbol,investment,profit,roi\n';
  let n = 0;

  let total_investment = 0;
  let total_profit = 0;
  let total_roi = 0;

  // Simulation
  for (const stock of manifest) {
    if (blacklist.includes(stock.Symbol)) continue;
    let stockData = addMACD(await getStockData(stock.Symbol));
    const simulation = await simFunc(stockData);
    report += `${stock.Symbol},${simulation.investment},${simulation.profit},${simulation.roi}\n`;
    total_investment += simulation.investment;
    total_profit += simulation.profit;
    n++;
  }

  // Compute totals
  total_roi = ((total_profit / total_investment) * 100).toFixed(2);
  report += `__TOTAL__,${total_investment},${total_profit},${total_roi}`;

  // Write output
  const reportName = `reports/${reportId}.csv`;
  await fsp.writeFile(reportName, report);
  console.log(`Wrote ${n} simulation results to ${reportName}`);
}

generateReport(simulateTradingMaxHold, 'max-hold');

(async function main() {
  const stock = 'MSFT';
  console.log(`Buying ${stock}`);
  let stockData = await getStockData(stock);
  simulateTradingMaxHold(stockData);
})//();