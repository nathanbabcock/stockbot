import fetch from 'node-fetch';
import parse from 'csv-parse/lib/sync.js';
import fs from 'fs';
const fsp = fs.promises;
// import { promises as fsp } from 'fs';

import { AverageGain, AverageLoss, SD } from 'technicalindicators';

import simulateTradingRSI from './strategies/rsi.js';
import simulateTradingMACD from './strategies/macd.js';
import simulateTradingMACDLong from './strategies/macd-long.js';
import simulateTradingReactive from './strategies/reactive.js';
import simulateTradingMACD_RSI from './strategies/macd-rsi.js';
import simulateTradingMultiSMA from './strategies/multi-sma.js';
import { standardDeviation } from './util.js';

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
  // manifest = manifest.slice(0, 10);
  // let manifest = [{Symbol: 'MSFT'}];
  let blacklist = (await readCSV('stock-data/404.csv')).map(x => x.Symbol);
  let min_date = new Date();
  const PERIOD = 60;
  const PORTFOLIO_SIZE = 100;

  console.log(`PERIOD = ${PERIOD}`);
  console.log(`PORTFOLIO_SIZE = ${PORTFOLIO_SIZE}`);

  let timeSeries = [];

  for (const stock of manifest) {
    if (blacklist.includes(stock.Symbol)) continue;
    let stockData = stock.stockData = await getStockData(stock.Symbol);
    stockData = stock.stockData = stockData.filter(x => !isNaN(x.Close) && x.Close !== null);

    console.log(`Calculating average gain/loss and standard deviation for ${stock.Symbol}`);

    const input = {
      period: PERIOD,
      values: stockData.map(x => x.Close),
    };

    const averageGain = AverageGain.calculate(input);
    const averageLoss = AverageLoss.calculate(input);
    const averageChange = averageGain.map((x, index) => x - averageLoss[index]);
    // console.log(`Sample averageChange for ${stock.Symbol} = `, averageChange.slice(0, 10));
    const averageReturn = averageChange.map((x, index) => x / stockData[PERIOD + index].Close);
    // console.log(`Sample averageReturn for ${stock.Symbol} = `, averageReturn.slice(0, 10));
    const averageReturnSD = standardDeviation(averageReturn);
    // console.log(`averageReturnSD`, averageReturnSD);
    const score = averageReturn.map(x => x - averageReturnSD);
    // console.log(`Sample ROI score for ${stock.Symbol} = `, score.slice(0, 10));

    for (let i = PERIOD; i < stockData.length; i++) {
      let day = stockData[i];
      if (isNaN(day.Close)) { continue; }
      const roi = score[i - PERIOD];
      let timeSeriesEntry = timeSeries.find(x => x.date.getTime() === day.Date.getTime());
      if (!timeSeriesEntry) {
        const newEntry = {date: day.Date, roiData: []};
        timeSeries.push(newEntry);
        timeSeriesEntry = newEntry;
      }
      timeSeriesEntry.roiData.push({stock: stock.Symbol, roi, price: day.Close});
    }
  }

  console.log('Sorting by date');
  timeSeries.sort((a, b) => a.date.getTime() - b.date.getTime());

  console.log('Sorting daily stocks by ROI');
  timeSeries.forEach(day => day.roiData.sort((a, b) => b.roi - a.roi));

  // console.log(timeSeries[0].date);
  // console.log(timeSeries[timeSeries.length-1].date);
  // console.log(timeSeries[0].roiData[0].roi);
  // console.log(timeSeries[0].roiData[timeSeries[0].roiData.length - 1].roi);
  // process.exit(0);

  let investment = 0;
  let profit = 0;
  let portfolio = [];

  // Simulate trading
  timeSeries.forEach(day => {
    if (!day.roiData) return;

    // Update portfolio prices
    portfolio.forEach(asset => {
      const latest = day.roiData.find(data => data.stock === asset.stock);
      if (!latest) { asset.roi = 0; return; }
      asset.roi = latest.roi;
      asset.price = latest.price;
    });

    // Buy (all top stocks which aren't already owned)
    const topStocks = day.roiData.slice(0, PORTFOLIO_SIZE);
    topStocks.forEach(topStock => {
      if (!portfolio.find(asset => asset.stock === topStock.stock)) {
        investment += topStock.price;
        profit -= topStock.price;
        topStock.boughtPrice = topStock.price;
        portfolio.push(topStock);
        console.log(`${day.date.toLocaleDateString()}: Buying ${topStock.stock} for ${topStock.price} (roi = ${topStock.roi.toFixed(2)})`);
      }
    });

    // Sell (extra stocks which don't make the cut)
    portfolio.sort((a, b) => b.roi - a.roi);
    for (let i = PORTFOLIO_SIZE; i < portfolio.length; i++) {
      profit += portfolio[i].price;
      console.log(`${day.date.toLocaleDateString()}: Selling ${portfolio[i].stock} for ${portfolio[i].price.toFixed(2)} (return = ${(((portfolio[i].price - portfolio[i].boughtPrice) / portfolio[i].boughtPrice) * 100).toFixed(2)}%, roi = ${portfolio[i].roi.toFixed(2)})`);
    }
    portfolio = portfolio.slice(0, PORTFOLIO_SIZE);
    // console.log(`${day.date.toLocaleDateString()}: EOD portfolio = ${portfolio.map(x => `${x.stock} (${x.roi.toFixed(2)})`)}`);
  });

  console.log('============');
  console.log(`${timeSeries[timeSeries.length-1].date.toLocaleDateString()} Experiment ended; selling all remaining assets`)
  portfolio.forEach(asset => {
    profit += asset.price;
    console.log(`- Selling ${asset.stock} for ${asset.price.toFixed(2)}`);
  })

  console.log('============');
  console.log(`Investment: $${investment}`);
  console.log(`Profit: $${profit}`);
  console.log(`Total ROI: ${((profit / investment) * 100).toFixed(2)}%`);
}

await simulateTradingROI();

// generateReport(simulateTradingMultiSMA, 'multi-sma');

// (async function main() {
//   const stock = 'MSFT';
//   console.log(`Buying ${stock}`);
//   let stockData = await getStockData(stock);
//   simulateTradingMultiSMA(stockData);
// })//();