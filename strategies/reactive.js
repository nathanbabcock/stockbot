export default function simulateTradingReactive(stockData) {
  let investment = 0;
  let shares = 0;
  let profit = 0;
  let bought_price;

  stockData.forEach((day, index) => {
    if (index === 0) { return; }

    // Buy
    if (day.Close > stockData[index-1].Close && shares === 0) {
      profit -= day.Close;
      investment += day.Close;
      shares++;
      bought_price = day.Close;
      // console.log(`${day.Date.toLocaleDateString()}: Bought 1 share at $${day.Close.toFixed(2)}`);
    }

    // Sell
    const REACTIVE_SELL_SIGNAL = day.Close < stockData[index-1].Close;
    const LAST_DAY = index === stockData.length - 1;
    if (shares > 0 && (REACTIVE_SELL_SIGNAL || LAST_DAY)) {
      profit += shares * day.Close;
      // console.log(`${day.Date.toLocaleDateString()}: Sold ${shares} share(s) at $${day.Close.toFixed(2)} ea. (${(((day.Close - bought_price) / bought_price) * 100).toFixed(2)}%)`);
      shares = 0;
    }
  });

  if (isNaN(profit)) profit = 0;
  if (isNaN(investment)) investment = 0;

  let roi = ((profit / investment) * 100).toFixed(2);
  console.log(`$${profit.toFixed(2)} (${roi}% return)`);
  return { investment, profit, roi };
}