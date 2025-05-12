const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { connectDB } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Cargar variables de entorno
require('dotenv').config();

// Inicializar Express
const app = express();

// Middleware
app.use(helmet()); // Seguridad HTTP
app.use(cors()); // Permitir CORS
app.use(express.json()); // Parsear body como JSON
app.use(morgan('dev')); // Logging de HTTP requests

// Conectar a MongoDB
connectDB();

// Rutas
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/catalog', require('./routes/catalogRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));

// Ruta raíz
app.get('/', (req, res) => {
  res.json({ message: 'Toolstock Automation API' });
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
