'use strict';

const axios = require('axios');

// 🧠 Estructura en memoria para guardar likes por IP
const stockLikes = {};

module.exports = function (app) {
  app.get('/api/stock-prices', async function (req, res) {
    const { stock, like } = req.query;
    const ip = req.ip;

    if (!stock) {
      return res.status(400).json({ error: 'Stock symbol is required' });
    }

    // 🧠 Normaliza a array si vienen dos acciones
    const stocks = Array.isArray(stock) ? stock.map(s => s.toUpperCase()) : [stock.toUpperCase()];

    try {
      // 🧠 Consulta en paralelo los precios de ambas acciones
      const responses = await Promise.all(
        stocks.map(sym =>
          axios.get(`https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${sym}/quote`)
        )
      );

      const stockDataArray = responses.map((response, i) => {
        const symbol = response.data.symbol.toUpperCase();
        const price = response.data.latestPrice;

        // 🧠 Inicializa el Set si no existe
        if (!stockLikes[symbol]) {
          stockLikes[symbol] = new Set();
        }

        // 🧠 Si like=true, guarda la IP
        if (like === 'true') {
          stockLikes[symbol].add(ip);
        }

        return {
          stock: symbol,
          price,
          likes: stockLikes[symbol].size
        };
      });

      // 🧠 Si hay dos acciones, calcular rel_likes
      if (stockDataArray.length === 2) {
        const [stock1, stock2] = stockDataArray;
        const relLikes1 = stock1.likes - stock2.likes;
        const relLikes2 = stock2.likes - stock1.likes;

        return res.json({
          stockData: [
            {
              stock: stock1.stock,
              price: stock1.price,
              rel_likes: relLikes1
            },
            {
              stock: stock2.stock,
              price: stock2.price,
              rel_likes: relLikes2
            }
          ]
        });
      }

      // 🧠 Si solo hay una acción, responder con likes
      return res.json({
        stockData: {
          stock: stockDataArray[0].stock,
          price: stockDataArray[0].price,
          likes: stockDataArray[0].likes
        }
      });
    } catch (error) {
      console.error('Error al obtener datos del stock:', error.message);
      res.status(500).json({ error: 'Failed to fetch stock data' });
    }
  });
};
