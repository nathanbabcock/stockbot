import { SMA } from 'technicalindicators';

export function addSMA(stockData, period, key) {
  const values = stockData.map(x => x.Close);
  const sma = SMA.calculate({
    values,
    period,
  });
  sma.forEach((sma, index) => index + period < stockData.length && (stockData[index + period][key] = sma));
  return stockData;
}

export default function simulateTradingMultiSMA(stockData) {
  stockData = addSMA(stockData, 7, 'sma_week');
  stockData = addSMA(stockData, 14, 'sma_2week');
  stockData = addSMA(stockData, 30, 'sma_month');
  stockData = addSMA(stockData, 90, 'sma_quarter');
  stockData = addSMA(stockData, 180, 'sma_6month');
  stockData = addSMA(stockData, 365, 'sma_year');
  stockData = addSMA(stockData, 365 * 2, 'sma_2year');

  let investment = 0;
  let shares = 0;
  let profit = 0;
  let bought_price;

  stockData.forEach((day, index) => {
    // Buy
    const BUY_SIGNAL_SMA_WEEK = day.sma_week && day.Close < day.sma_week;
    const BUY_SIGNAL_SMA_2WEEK = day.sma_2week && day.Close < day.sma_2week;
    const BUY_SIGNAL_SMA_MONTH = day.sma_month && day.Close < day.sma_month;
    const BUY_SIGNAL_SMA_QUARTER = day.sma_quarter && day.Close < day.sma_quarter;
    const BUY_SIGNAL_SMA_6MONTH = !day.sma_6month || day.Close < day.sma_6month;
    const BUY_SIGNAL_SMA_YEAR = !day.sma_year || day.Close < day.sma_year;
    const BUY_SIGNAL_SMA_2YEAR = !day.sma_2year || day.Close < day.sma_2year;
    const BUY_SIGNAL_SMA = BUY_SIGNAL_SMA_WEEK
      && BUY_SIGNAL_SMA_2WEEK
      && BUY_SIGNAL_SMA_MONTH
      && BUY_SIGNAL_SMA_QUARTER;
      // && BUY_SIGNAL_SMA_6MONTH
      // && BUY_SIGNAL_SMA_YEAR
      // && BUY_SIGNAL_SMA_2YEAR;
    if (BUY_SIGNAL_SMA) {
      profit -= day.Close;
      investment += day.Close;
      shares++;
      bought_price = day.Close;
      // console.log(`${day.Date.toLocaleDateString()}: Bought 1 share at $${day.Close.toFixed(2)}`);
    }

    // Sell
    const SELL_SIGNAL_SMA_WEEK = day.sma_week && day.Close > day.sma_week;
    const SELL_SIGNAL_SMA_2WEEK = day.sma_2week && day.Close > day.sma_2week;
    const SELL_SIGNAL_SMA_MONTH = day.sma_month && day.Close > day.sma_month;
    const SELL_SIGNAL_SMA_QUARTER = day.sma_quarter && day.Close > day.sma_quarter;
    const SELL_SIGNAL_SMA_6MONTH = !day.sma_6month || day.Close > day.sma_6month;
    const SELL_SIGNAL_SMA_YEAR = !day.sma_year || day.Close > day.sma_year;
    const SELL_SIGNAL_SMA_2YEAR = !day.sma_2year || day.Close > day.sma_2year;
    const SELL_SIGNAL_SMA = SELL_SIGNAL_SMA_WEEK
      && SELL_SIGNAL_SMA_2WEEK
      && SELL_SIGNAL_SMA_MONTH
      && SELL_SIGNAL_SMA_QUARTER;
      // && SELL_SIGNAL_SMA_6MONTH
      // && SELL_SIGNAL_SMA_YEAR
      // && SELL_SIGNAL_SMA_2YEAR;
    if (shares > 0 && SELL_SIGNAL_SMA) {
      profit += shares * day.Close;
      // console.log(`${day.Date.toLocaleDateString()}: Sold ${shares} share(s) at $${day.Close.toFixed(2)} ea. (${(((day.Close - bought_price) / bought_price) * 100).toFixed(2)}%)`);
      shares = 0;
    }
  });

  let roi = ((profit / investment) * 100).toFixed(2);
  console.log(`$${profit.toFixed(2)} (${roi}% return)`);
  return { investment, profit, roi };
}