import { readCSV, getStockData } from '../util.js';
import path from 'path';

export function addROI(stockData, period, key) {
  for (let i = period; i < stockData.length; i++) {
    stockData[i][key] = (stockData[i].Close - stockData[i - period].Close) / (stockData[i - period].Close);
  }
  return stockData;
}

export default async function simulateTradingROI() {
  let manifest = await readCSV(path.join(process.cwd(), 'stock-data/NYSE_manifest.csv'));
  console.log(path.join(process.cwd(), 'stock-data/NYSE_manifest.csv'));
  console.log(manifest.length);
  let blacklist = (await readCSV(`${__dirname}/stock-data/404.csv`)).map(x => x.Symbol);
  let min_date = new Date();
  const period = 7;

  for (const stock of manifest) {
    if (blacklist.includes(stock.Symbol)) continue;
    stock.stockData = await getStockData(stock.Symbol);
    console.log(`Calculating ${period}-day ROI for ${stock.Symbol}`);
    stock.stockData = addROI(stockData, period, 'roi_weekly');
    if (stock.stockData[0].Date.getTime() < min_date.getTime()) {
      min_date = stock.stockData[0].Date;
    } 
  }
}