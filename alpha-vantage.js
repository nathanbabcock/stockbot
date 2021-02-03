'use strict';

const StocksJS = require('stocks.js');
const ALPHA_VANTAGE_API_KEY = '77TANWPQ4K5EVDY0'; // Generated here: https://www.alphavantage.co/support/#api-key
const stocks = new StocksJS(ALPHA_VANTAGE_API_KEY);

async function main() {
  const SYMBOL = 'SD';
  const AMOUNT = 365;
  const INTERVAL = 'daily';

  const options = {
    symbol: SYMBOL,
    interval: INTERVAL,
    amount: AMOUNT,
  };
  const STOCK = await stocks.timeSeries(options);

  const macd_options = {
    symbol: SYMBOL,
    interval: INTERVAL,
    amount: AMOUNT,
    time_period: 9,
    series_type: 'close',
    indicator: 'MACD'
  };
  const STOCK_MACD = await stocks.technicalIndicator(macd_options);

  let invested = 0;
  let capital = 0;
  let shares = 0;

  STOCK.reverse();
  STOCK_MACD.reverse();

  let bought_price = null;
  STOCK.forEach((price, index) => {
    if (index === 0) { return; } // Skip first

    if (price.date.getDay() !== STOCK_MACD[index].date) {
      console.warn('Date mismatch!');
    }

    // Buy
    if (STOCK_MACD[index].MACD <= 0 && STOCK_MACD[index-1].MACD > 0) {
      capital -= price.close;
      invested += price.close;
      shares++;
      bought_price = price.close;
      console.log(`${price.date.toLocaleDateString()}: Bought 1 share at $${price.close.toFixed(2)}`);
    }
    
    // Sell
    const MACD_SELL_SIGNAL = STOCK_MACD[index].MACD >= 0 && STOCK_MACD[index-1].MACD < 0;
    const LAST_DAY = index === STOCK.length - 1;
    const STOP_LOSS = price.close <= bought_price * 0.9;
    if (shares > 0 && (MACD_SELL_SIGNAL || LAST_DAY || STOP_LOSS)) {
      capital += shares * price.close;
      console.log(`${price.date.toLocaleDateString()}: Sold ${shares} share(s) at $${price.close.toFixed(2)} each (${(((price.close - bought_price) / bought_price) * 100).toFixed(2)}%)`);
      shares = 0;
    }
  });

  console.log(`$${capital.toFixed(2)} (${((capital / invested) * 100).toFixed(2)}% return)`);
}

main();