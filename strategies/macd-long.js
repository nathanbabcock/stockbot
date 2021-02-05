import { MACD } from 'technicalindicators';

function addMACDLong(stockData) {
  const values = stockData.map(x => x.Close);
  const slowPeriod = 50
  const macd = MACD.calculate({
    values,
    fastPeriod: 200,
    slowPeriod,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false
  });
  macd.forEach((macd, index) => stockData[index + slowPeriod - 1].macd_long = macd);
  return stockData;
}

export default function simulateTradingMACDLong(stockData) {
  stockData = addMACDLong(stockData);

  let investment = 0;
  let shares = 0;
  let profit = 0;
  let bought_price;

  stockData.forEach((day, index) => {
    if (!day.macd_long || !stockData[index-1].macd_long) { return; }

    // Buy
    if (day.macd_long.MACD <= 0 && stockData[index-1].macd_long.MACD > 0) {
      profit -= day.Close;
      investment += day.Close;
      shares++;
      bought_price = day.Close;
      // console.log(`${day.Date.toLocaleDateString()}: Bought 1 share at $${day.Close.toFixed(2)}`);
    }

    // Sell
    const MACD_SELL_SIGNAL = day.macd_long.MACD >= 0 && stockData[index-1].macd_long.MACD < 0;
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