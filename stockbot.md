# Stockbot

## Philosophy
- Panning for gold
- All output is cached and built on

## Plan
- Download & cache historical price data CSVs from Yahoo Finance and/or Alpha Vantage
- Code a technical indicator (MACD) and verify it works
- Simulate automated MACD trading on entire stock history and analyze profits
- Repeat for all 3000+ stocks and find total return
- Cluster analysis for most & least profitable stocks
- `argmax` for technical indicator parameters
- Rinse and repeat for **as many technical indicators as possible**
- Tournament-style/survival of the fittest competition between determinstic trading strategies

## Naïve strategies
- Buy and hold one of every stock in existence forever
- Buy and hold the most profitable ETFs
- Buy and hold only the N most expensive stocks at all times
- Buy and hold N of the least expensive penny stocks
- Buy at the beginning of every rise, sell at the beginning of every dip
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
