process.stderr.setEncoding('utf8');
process.stdout.setEncoding('utf8');
const logger = require('./utils/logger');
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { connectDB } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const productScheduler = require('./services/schedulers/productScheduler');
const notificationScheduler = require('./services/schedulers/notificationScheduler');

if (process.env.NODE_ENV === 'development') {
  logger.info(`Iniciando en modo ${process.env.NODE_ENV}`);
  productScheduler.init();
  notificationScheduler.init();
  notificationScheduler.startJobs();
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
app.use('/uploads/avatars', express.static(path.join(__dirname, '../uploads/avatars')));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/pricing', require('./routes/pricingRoutes'));
app.use('/api/actions', require('./routes/actionsRoutes'));
app.use('/api/history', require('./routes/historyRoutes'));
app.use('/api/pricing-engine', require('./routes/pricingEngineRoutes'));
app.use('/api/notifications', require('./routes/notificationsRoutes'));

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
  logger.info(`Server running on port ${PORT}`);
});

module.exports = app;
