module.exports = function simulateTradingMaxHold(stockData) {
  let investment = 0;
  let shares = 0;
  let profit = 0;

  // Buy
  const firstDay = stockData[0];
  profit -= firstDay.Close;
  investment += firstDay.Close;
  shares++;

  // Sell
  const lastDay = stockData[stockData.length - 1];
  profit += shares * lastDay.Close;
  shares = 0;

  if (isNaN(profit)) profit = 0;
  if (isNaN(investment)) investment = 0;

  let roi = ((profit / investment) * 100).toFixed(2);
  console.log(`$${profit.toFixed(2)} (${roi}% return)`);
  return { investment, profit, roi };
}