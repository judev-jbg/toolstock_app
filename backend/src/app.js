const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectDB } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const orderSyncScheduler = require('./services/schedulers/orderSyncScheduler');

if (process.env.NODE_ENV === 'production') {
  orderSyncScheduler.init();
}

// Cargar variables de entorno
require('dotenv').config();

// Inicializar Express
const app = express();

// Middleware
app.use(helmet()); // Seguridad HTTP
app.use(cors()); // Permitir CORS
app.use(express.json()); // Parsear body como JSON
app.use(morgan('dev')); // Logging de HTTP requests

const exportDirs = ['exports', 'exports/reports', 'exports/shipments', 'uploads'];
exportDirs.forEach((dir) => {
  const dirPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
});

// Conectar a MongoDB
connectDB();

// Rutas
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/catalog', require('./routes/catalogRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/integrations/amazon', require('./routes/amazonIntegrationRoutes'));
app.use('/api/integrations/prestashop', require('./routes/prestashopIntegrationRoutes'));
app.use('/api/integrations/sync', require('./routes/syncIntegrationRoutes'));
app.use('/api/integrations/erp', require('./routes/erpIntegrationRoutes'));
app.use('/api/shipping', require('./routes/shippingRoutes'));

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

// Para tests
module.exports = app;
