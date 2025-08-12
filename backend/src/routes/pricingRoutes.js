// backend/src/routes/pricingRoutes.js - NUEVO ARCHIVO
const express = require('express');
const {
  getPricingConfig,
  updatePricingConfig,
  getShippingCalculator,
  validatePricingConfig,
} = require('../controllers/pricingController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Configuración global - Solo admin/root
router
  .route('/config')
  .get(protect, authorize('admin', 'root'), getPricingConfig)
  .put(protect, authorize('admin', 'root'), updatePricingConfig);

// Validación de configuración
router.get('/config/validate', protect, authorize('admin', 'root'), validatePricingConfig);

// Calculadora de envíos - Todos los usuarios autenticados
router.get('/shipping-calculator', protect, getShippingCalculator);

module.exports = router;
