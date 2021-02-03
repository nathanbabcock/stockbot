# Stockbot

## Philosophy
- Panning for gold
- All output is cached and built on top of -- a sifting mechanism allowing the best to rise to the top

## Plan
- [X] Download & cache historical price data CSVs from Yahoo Finance and/or Alpha Vantage
- [X] Code a technical indicator (MACD) and verify it works
- [X] Simulate automated MACD trading on entire stock history and analyze profits
- [X] Download entire Yahoo Finance stock price history database
  - [X] Identify 404 stocks
  - [X] Use a VPN just in case
- [X] Repeat MACD for all 3000+ stocks and generate total return report
- [ ] Write naive strategy
- [ ] Repeat Naive strategy for all 3000+ stocks and generate report
- [ ] Cluster analysis for most & least profitable stocks
- [ ] `argmax` for technical indicator parameters
- [ ] Rinse and repeat for **as many technical indicators as possible**
- [ ] Tournament-style/survival of the fittest competition between determinstic trading strategies

## Naïve strategies
- Buy and hold one of every stock in existence forever
- Buy at the beginning of every rise, sell at the beginning of every dip
- Buy and hold the most profitable ETFs
- Buy and hold only the N most expensive stocks at all times
- Buy and hold N of the least expensive penny stocks
- Buy and sell N random stocks at random times
- Buy N stocks in the M sectors with the highest growth in the past Q time period

## Other variables to consider:
- Time period (past month, year, 5 years, max)
- Stock sector
- Diversification

## Future work
- Other exchanges
  - NYSE, NASDAQ, ...
  - Currency/foreign exchange
  - Crypto
- Day trading/intra-day arbitrage
- Machine learning/neural network approaches
- News media and social media correlation
