const express = require('express');
const {
  // Configuración global
  getPricingConfig,
  updatePricingConfig,
  getShippingCalculator,
  validatePricingConfig,
  calculateProductPVPM,
  recalculateAllPVPM,
  updateProductAuxFields,
  getProductsNeedingPVPMUpdate,
  validateProductPVPM,
  getProductPVPMPreview,
} = require('../controllers/pricingController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// ===== CONFIGURACIÓN GLOBAL =====
router
  .route('/config')
  .get(protect, authorize('admin', 'root'), getPricingConfig)
  .put(protect, authorize('admin', 'root'), updatePricingConfig);

router.get('/config/validate', protect, authorize('admin', 'root'), validatePricingConfig);

// ===== CALCULADORA DE ENVÍOS =====
router.get('/shipping-calculator', protect, getShippingCalculator);

// ===== PVPM CALCULATOR =====

// Recálculo masivo - Solo admin/root
router.post('/recalculate-all', protect, authorize('admin', 'root'), recalculateAllPVPM);

// Productos que necesitan actualización
router.get('/products/needs-update', protect, getProductsNeedingPVPMUpdate);

// Operaciones específicas por producto
router.post('/products/:id/calculate-pvpm', protect, calculateProductPVPM);
router.put('/products/:id/aux-fields', protect, updateProductAuxFields);
router.get('/products/:id/validate', protect, validateProductPVPM);
router.get('/products/:id/pvpm-preview', protect, getProductPVPMPreview);

module.exports = router;
