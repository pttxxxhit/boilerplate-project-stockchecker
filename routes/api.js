'use strict';

const axios = require('axios');

module.exports = function (app) {
  app.get('/api/stock-prices', async function (req, res) {
    const stock = req.query.stock;

    if (!stock) {
      return res.status(400).json({ error: 'Stock symbol is required' });
    }

    try {
      const response = await axios.get(`https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${stock}/quote`);
      const data = response.data;

      res.json({
        stock: data.symbol,
        price: data.latestPrice
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch stock data' });
    }
  });
};
