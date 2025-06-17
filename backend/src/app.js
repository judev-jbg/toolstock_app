require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { connectDB } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const productScheduler = require('./services/schedulers/productScheduler');
const pricingScheduler = require('./services/schedulers/pricingScheduler');

if (process.env.NODE_ENV === 'development') {
  productScheduler.init();
  // pricingScheduler.init();
}

// Inicializar Express
const app = express();

app.use(
  cors({
    origin: 'http://localhost:5173', // o el origen de tu frontend
    optionsSuccessStatus: 200,
  })
); // Permitir CORS
app.use(
  helmet({
    crossOriginResourcePolicy: false, // Esto permite que los archivos estáticos sean accesibles desde diferentes orígenes
  })
); // Seguridad HTTP
app.use(express.json()); // Parsear body como JSON
app.use(morgan('dev')); // Logging de HTTP requests

// Conectar a MongoDB
connectDB();

// Rutas
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/uploads/avatars', express.static(path.join(__dirname, '../uploads/avatars')));
app.use('/api/pricing', require('./routes/pricingRoutes'));
app.use('/api/webhooks', require('./routes/webhookRoutes'));

// Ruta raíz
app.get('/', (req, res) => {
  res.json({ message: 'Toolstock local API' });
});

// Middleware de manejo de errores
app.use(errorHandler);

// Puerto
const PORT = process.env.PORT || 4000;

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
