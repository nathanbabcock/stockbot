'use strict';

const fetch = require('node-fetch');
const fs = require('fs');
const fsp = fs.promises;
const parse = require('csv-parse/lib/sync');

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
    return parse(content, {columns: true});
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
  const symbol = chooseRandom(manifest).Symbol;
  if (symbol.includes('/')) {
    console.warn (`Random symbol ${symbol} contains unsupported characters and may cause errors`);
  }
  return symbol;
}

async function main() {
  console.log(await getRandomStock());
}

main();