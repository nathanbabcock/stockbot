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

export function addROI(stockData, period, key) {
  for (let i = period; i < stockData.length; i++) {
    stockData[i][key] = (stockData[i].Close - stockData[i - period].Close) / (stockData[i - period].Close);
  }
  return stockData;
}

export async function simulateTradingROI() {
  let manifest = await readCSV('stock-data/NYSE_manifest.csv');
  // manifest = manifest.slice(0, 30);
  // let manifest = [{Symbol: 'MSFT'}];
  let blacklist = (await readCSV('stock-data/404.csv')).map(x => x.Symbol);
  let min_date = new Date();
  const period = 30;

  let timeSeries = [];

  for (const stock of manifest) {
    if (blacklist.includes(stock.Symbol)) continue;
    const stockData = stock.stockData = await getStockData(stock.Symbol);

    console.log(`Calculating ${period}-day ROI for ${stock.Symbol}`);
    for (let i = period; i < stockData.length; i++) {
      let day = stockData[i];
      const roi = (stockData[i].Close - stockData[i - period].Close) / (stockData[i - period].Close);
      let timeSeriesEntry = timeSeries.find(x => x.date === day.Date);
      if (!timeSeriesEntry) {
        const newEntry = {date: day.Date, roiData: []}
        timeSeries.push(newEntry);
        timeSeriesEntry = newEntry;
      }
      timeSeriesEntry.roiData.push({stock: stock.Symbol, roi, price: day.Close});
    }
  }

  console.log('Sorting by date');
  timeSeries.sort((a, b) => a.date.getTime() - b.date.getTime());

  console.log('Sorting daily stocks by ROI');
  timeSeries.forEach(day => day.roiData.sort((a, b) => a.roi - b.roi));    

  let investment = 0;
  let profit = 0;
  let portfolio = [];
  const PORTFOLIO_SIZE = 10;

  // Simulate trading
  timeSeries.forEach(day => {
    console.log(day.date);
    if (!day.roiData) return;
    const topStocks = day.roiData.slice(0, PORTFOLIO_SIZE);
    topStocks.forEach(topStock => {
      const ownedStock = portfolio.find(asset => asset.stock === topStock.stock);
      if (!ownedStock) {
        // Buy
        investment += topStock.price;
        profit -= topStock.price;
        portfolio.push(topStock);
        console.log(`Buying ${topStock.stock} for ${topStock.price}`);
      } else {
        // Update
        ownedStock.price = topStock.price;
        ownedStock.toi = topStock.roi;
      }
    });
    portfolio.sort((a, b) => a.roi = b.roi);
    if (portfolio.length > PORTFOLIO_SIZE) {
      for (let i = PORTFOLIO_SIZE; i < portfolio.length; i++) {
        // Sell
        profit += portfolio[i].price;
        console.log(`Selling ${portfolio[i].stock} for ${portfolio[i].price}`);
      }
      portfolio = portfolio.slice(0, PORTFOLIO_SIZE);
    }
  });

  console.log(`Investment: $${investment}`);
  console.log(`Profit: $${profit}`);
  console.log(`Total ROI: $${(((profit - investment) / investment) * 100).toFixed(2)}%`);
  console.log(`Ending portfolio: ${portfolio.map(x => x.stock)}`);
}

await simulateTradingROI();

// generateReport(simulateTradingMultiSMA, 'multi-sma');

// (async function main() {
//   const stock = 'MSFT';
//   console.log(`Buying ${stock}`);
//   let stockData = await getStockData(stock);
//   simulateTradingMultiSMA(stockData);
// })//();