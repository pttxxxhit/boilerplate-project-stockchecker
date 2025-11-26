'use strict';
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const apiRoutes = require('./routes/api.js');
const fccTestingRoutes = require('./routes/fcctesting.js');
const runner = require('./test-runner');

const app = express();

// Confía en el proxy para obtener la IP real (Render, Cloudflare, etc.)
app.set('trust proxy', true);

// Política de seguridad de contenido requerida por FreeCodeCamp
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self';"
  );
  next();
});

// Archivos estáticos y middlewares
app.use('/public', express.static(process.cwd() + '/public'));
app.use(cors({ origin: '*' })); // Solo para pruebas de FCC
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Página principal
app.route('/')
  .get((req, res) => {
    res.sendFile(process.cwd() + '/views/index.html');
  });

// Rutas de testing de FCC (debe ir antes de las rutas de la API)
fccTestingRoutes(app);

// Rutas de la API
apiRoutes(app);

// 404 Not Found
app.use((req, res, next) => {
  res.status(404).type('text').send('Not Found');
});

// Arranque del servidor usando el puerto de Render o 3000
const PORT = process.env.PORT || 3000;
const listener = app.listen(PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);

  // Ejecutar tests solo en entorno de test (local)
  if (process.env.NODE_ENV === 'test') {
    console.log('Running Tests...');
    setTimeout(function () {
      try {
        runner.run();
      } catch (e) {
        console.log('Tests are not valid:');
        console.error(e);
      }
    }, 3500);
  }
});

// Exportar la app para que las pruebas de FCC la importen
module.exports = app;