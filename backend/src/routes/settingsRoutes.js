// backend/src/routes/settingsRoutes.js
const express = require('express');
const { getPriceConfig, updatePriceConfig } = require('../controllers/priceConfigController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas para configuración de precios
router.get('/price-config', getPriceConfig);
router.put('/price-config', authorize('admin', 'root'), updatePriceConfig);

module.exports = router;
