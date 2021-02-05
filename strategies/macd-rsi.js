import { addMACD } from './macd.js';
import { addRSI } from './rsi.js';

export default function simulateTradingMACD_RSI(stockData) {
  stockData = addMACD(stockData);
  stockData = addRSI(stockData);

  let investment = 0;
  let shares = 0;
  let profit = 0;
  let bought_price;

  stockData.forEach((day, index) => {
    if (!day.macd || !stockData[index-1].macd) { return; }
    if (!day.rsi) { return; }
    if (!day.Close && day.Close !== 0) { return; }

    // Buy
    const MACD_BUY_SIGNAL = day.macd.histogram >= 0 && stockData[index-1].macd.histogram < 0;
    const RSI_BUY_SIGNAL = day.rsi <= 30;
    if (MACD_BUY_SIGNAL && RSI_BUY_SIGNAL) {
      profit -= day.Close;
      investment += day.Close;
      shares++;
      bought_price = day.Close;
      // console.log(`${day.Date.toLocaleDateString()}: Bought 1 share at $${day.Close.toFixed(2)} (MACD = ${day.macd.MACD.toFixed(2)})`);
    }

    // Sell
    const MACD_SELL_SIGNAL = day.macd.histogram <= 0 && stockData[index-1].macd.histogram > 0;
    const RSI_SELL_SIGNAL = day.rsi >= 70;
    const LAST_DAY = index === stockData.length - 1;
    const STOP_LOSS = day.Close <= bought_price * 0.95;
    if (shares > 0 && (MACD_SELL_SIGNAL && RSI_SELL_SIGNAL || STOP_LOSS || LAST_DAY)) {
      profit += shares * day.Close;
      // console.log(`${day.Date.toLocaleDateString()}: Sold ${shares} share(s) at $${day.Close.toFixed(2)} ea. (${(((day.Close - bought_price) / bought_price) * 100).toFixed(2)}%)  (MACD = ${day.macd.MACD.toFixed(2)})`);
      shares = 0;
    }
  });

  let roi = ((profit / investment) * 100).toFixed(2);
  console.log(`$${profit.toFixed(2)} (${roi}% return)`);
  return { investment, profit, roi };
}