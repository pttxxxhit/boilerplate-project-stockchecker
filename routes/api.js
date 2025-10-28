'use strict';

const axios = require('axios');

// 🧠 Estructura en memoria para guardar likes por IP
const stockLikes = {};

module.exports = function (app) {
  app.get('/api/stock-prices', async function (req, res) {
    const stock = req.query.stock;
    const like = req.query.like; // 🧠 Detecta si se envió like=true
    const ip = req.ip; // 🧠 Captura la IP del usuario

    if (!stock) {
      return res.status(400).json({ error: 'Stock symbol is required' });
    }

    try {
      const response = await axios.get(`https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${stock}/quote`);
      const data = response.data;

      const symbol = data.symbol.toUpperCase();

      // 🧠 Inicializa el Set si no existe para este símbolo
      if (!stockLikes[symbol]) {
        stockLikes[symbol] = new Set();
      }

      // 🧠 Si el usuario envió like=true, guarda su IP (una sola vez)
      if (like === 'true') {
        stockLikes[symbol].add(ip);
      }

      // 🧠 Construye la respuesta incluyendo el número de likes únicos
      res.json({
        stockData: {
          stock: symbol,
          price: data.latestPrice,
          likes: stockLikes[symbol].size
        }
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch stock data' });
    }
  });
};
