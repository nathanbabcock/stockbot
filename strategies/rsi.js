import { RSI } from 'technicalindicators';

export function addRSI(stockData) {
  const values = stockData.map(x => x.Close);
  const period = 14;
  const rsi = RSI.calculate({
    values,
    period,
  });
  rsi.forEach((rsi, index) => stockData[index + period].rsi = rsi);
  return stockData;
}

export default function simulateTradingRSI(stockData) {
  stockData = addRSI(stockData);

  let investment = 0;
  let shares = 0;
  let profit = 0;
  let bought_price;

  stockData.forEach((day, index) => {
    if (!day.rsi) { return; }
    if (!day.Close && day.Close !== 0) { return; }

    // Buy
    if (shares === 0 && day.rsi <= 30) {
      profit -= day.Close;
      investment += day.Close;
      shares++;
      bought_price = day.Close;
      // console.log(`${day.Date.toLocaleDateString()}: Bought 1 share at $${day.Close.toFixed(2)}`);
    }

    // Sell
    const RSI_SELL_SIGNAL = day.rsi >= 70;
    const LAST_DAY = index === stockData.length - 1;
    const TIGHT_STOP_LOSS = day.Close <= bought_price * 0.99;
    if (shares > 0 && (RSI_SELL_SIGNAL || TIGHT_STOP_LOSS || LAST_DAY )) {
      profit += shares * day.Close;
      // console.log(`${day.Date.toLocaleDateString()}: Sold ${shares} share(s) at $${day.Close.toFixed(2)} ea. (${(((day.Close - bought_price) / bought_price) * 100).toFixed(2)}%)`);
      shares = 0;
    }
  });

  let roi = ((profit / investment) * 100).toFixed(2);
  console.log(`$${profit.toFixed(2)} (${roi}% return)`);
  return { investment, profit, roi };
}