'use strict';

const axios = require('axios');
const crypto = require('crypto');
const mongoose = require('mongoose');

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/stocklikes';
const isTest = process.env.NODE_ENV === 'test';

// Conectar solo si no estamos en modo test
if (!isTest) {
  mongoose.connect(mongoUri)
    .catch(err => console.error('Mongo connection error:', err));
}

// Esquema y modelo (se definen aunque no se conecte)
const StockSchema = new mongoose.Schema({
  symbol: { type: String, required: true, unique: true, index: true },
  ips: { type: [String], default: [] }
});
const Stock = mongoose.models.Stock || mongoose.model('Stock', StockSchema);

// Almacenamiento en memoria para tests
const memoryStore = new Map(); // key: SYMBOL, value: Set(anonIps)

module.exports = function (app) {
  app.get('/api/stock-prices', async function (req, res) {
    try {
      const { stock, like } = req.query;
      const likeFlag = (like === 'true' || like === true);

      if (!stock) {
        return res.status(400).json({ error: 'Stock symbol is required' });
      }

      // Obtener IP y anonimizarla
      const ip = req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '';
      const anonIp = crypto.createHash('sha256').update(String(ip)).digest('hex');

      // Normalizar a array de símbolos en mayúsculas
      const stocks = Array.isArray(stock) ? stock.map(s => String(s).toUpperCase()) : [String(stock).toUpperCase()];

      // Obtener precios en paralelo
      const responses = await Promise.all(
        stocks.map(sym =>
          axios.get(`https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${sym}/quote`)
        )
      );

      // Procesar resultados usando DB real o memoria según el entorno
      const results = await Promise.all(responses.map(async (response) => {
        const symbol = String(response.data.symbol).toUpperCase();
        const price = Number(response.data.latestPrice);

        if (isTest) {
          // Uso memoria: Set de IPs por símbolo
          if (!memoryStore.has(symbol)) memoryStore.set(symbol, new Set());
          if (likeFlag) memoryStore.get(symbol).add(anonIp);
          const likesCount = memoryStore.get(symbol).size;
          return { stock: symbol, price, likes: likesCount };
        } else {
          // Uso MongoDB
          if (likeFlag) {
            await Stock.findOneAndUpdate(
              { symbol },
              { $addToSet: { ips: anonIp } },
              { upsert: true, new: true }
            );
          }
          const doc = await Stock.findOne({ symbol }).lean();
          const likesCount = doc ? (doc.ips ? doc.ips.length : 0) : 0;
          return { stock: symbol, price, likes: likesCount };
        }
      }));

      // Si se pidieron dos acciones, devolver rel_likes
      if (results.length === 2) {
        const [a, b] = results;
        const relA = a.likes - b.likes;
        const relB = b.likes - a.likes;
        return res.json({
          stockData: [
            { stock: a.stock, price: a.price, rel_likes: relA },
            { stock: b.stock, price: b.price, rel_likes: relB }
          ]
        });
      }

      // Una sola acción: devolver likes
      return res.json({
        stockData: {
          stock: results[0].stock,
          price: results[0].price,
          likes: results[0].likes
        }
      });
    } catch (err) {
      console.error('Error in /api/stock-prices:', err && err.message ? err.message : err);
      return res.status(500).json({ error: 'Failed to fetch stock data' });
    }
  });
};