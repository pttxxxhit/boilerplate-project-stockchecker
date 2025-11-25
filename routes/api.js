'use strict';

const axios = require('axios');
const mongoose = require('mongoose');
const crypto = require('crypto');

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/stocklikes';

// Conectar a MongoDB (se ejecuta una vez)
mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .catch(err => console.error('Mongo connection error:', err));

// Esquema y modelo
const StockSchema = new mongoose.Schema({
  symbol: { type: String, required: true, unique: true, index: true },
  ips: { type: [String], default: [] }
});
const Stock = mongoose.models.Stock || mongoose.model('Stock', StockSchema);

module.exports = function (app) {
  app.get('/api/stock-prices', async function (req, res) {
    try {
      const { stock, like } = req.query;
      // Asegurarse de aceptar like como 'true' o true
      const likeFlag = (like === 'true' || like === true);

      if (!stock) {
        return res.status(400).json({ error: 'Stock symbol is required' });
      }

      // Obtener IP (Express debe tener app.set('trust proxy', true) si hay proxy)
      const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';

      // Anonimizar IP con hash (cumple la consigna de privacidad)
      const anonIp = crypto.createHash('sha256').update(String(ip)).digest('hex');

      // Normalizar a array de símbolos en mayúsculas
      const stocks = Array.isArray(stock) ? stock.map(s => String(s).toUpperCase()) : [String(stock).toUpperCase()];

      // Obtener precios en paralelo
      const responses = await Promise.all(
        stocks.map(sym =>
          axios.get(`https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${sym}/quote`)
        )
      );

      // Para cada símbolo: si likeFlag -> $addToSet anonIp; luego contar likes
      const results = await Promise.all(responses.map(async (response) => {
        const symbol = String(response.data.symbol).toUpperCase();
        const price = Number(response.data.latestPrice);

        if (likeFlag) {
          await Stock.findOneAndUpdate(
            { symbol },
            { $addToSet: { ips: anonIp } },
            { upsert: true, new: true }
          );
        }

        const doc = await Stock.findOne({ symbol });
        const likesCount = doc ? doc.ips.length : 0;

        return { stock: symbol, price, likes: likesCount };
      }));

      // Si se pidieron dos acciones, devolver array con rel_likes
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

      // Si solo una acción, devolver objeto con likes
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