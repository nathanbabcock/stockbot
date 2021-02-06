import fetch from 'node-fetch';
import parse from 'csv-parse/lib/sync.js';
import fs from 'fs';
const fsp = fs.promises;
// import { promises as fsp } from 'fs';

import simulateTradingRSI from './strategies/rsi.js';
import simulateTradingMACD from './strategies/macd.js';
import simulateTradingMACDLong from './strategies/macd-long.js';
import simulateTradingReactive from './strategies/reactive.js';
import simulateTradingMACD_RSI from './strategies/macd-rsi.js';
import simulateTradingMultiSMA from './strategies/multi-sma.js';

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
    let stockData = await getStockData(stock.Symbol)
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

generateReport(simulateTradingMultiSMA, 'multi-sma');

(async function main() {
  const stock = 'MSFT';
  console.log(`Buying ${stock}`);
  let stockData = await getStockData(stock);
  simulateTradingMultiSMA(stockData);
})//();