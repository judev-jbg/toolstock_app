const express = require('express');
const { check } = require('express-validator');
const {
  getPricingConfig,
  updatePricingConfig,
  calculateProductPVPM,
  recalculateBulkPVPM,
  updateProductPrice,
  getPriceHistoryStats,
  getPricingStats,
  getTopActivityProducts,
  getPricingTrends,
  getPriceHistory,
  getPendingActions,
  updateProductPricingSettings,
  getPendingActionProducts,
  setFixedPrice,
} = require('../controllers/pricingController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { checkValidationResult } = require('../middleware/validation');

const router = express.Router();

// Configuración de precios (solo admin)
router.get('/config', protect, authorize('admin', 'root'), getPricingConfig);
router.put(
  '/config',
  protect,
  authorize('admin', 'root'),
  [
    check('defaultMargin', 'Margen debe estar entre 0.1 y 0.9')
      .optional()
      .isFloat({ min: 0.1, max: 0.9 }),
    check('defaultIva', 'IVA debe estar entre 0 y 1').optional().isFloat({ min: 0, max: 1 }),
    check('defaultShippingCost', 'Coste de envío debe ser positivo').optional().isFloat({ min: 0 }),
    checkValidationResult,
  ],
  updatePricingConfig
);

// Historial y acciones pendientes
router.get('/price-history', protect, getPriceHistory);
router.get('/pending-actions', protect, getPendingActions);
router.get('/price-history/stats', protect, getPriceHistoryStats);
router.get('/stats', protect, getPricingStats);
router.get('/top-activity', protect, authorize('admin', 'root'), getTopActivityProducts);
router.get('/trends', protect, authorize('admin', 'root'), getPricingTrends);

// Cálculo de PVPM
router.post('/calculate-pvpm/:id', protect, calculateProductPVPM);
router.post(
  '/recalculate-pvpm',
  protect,
  authorize('admin', 'root'),
  [
    check('productIds', 'IDs de productos debe ser un array').optional().isArray(),
    checkValidationResult,
  ],
  recalculateBulkPVPM
);

// Actualización de precios
router.put(
  '/update-price/:id',
  protect,
  [
    check('newPrice', 'Precio debe ser mayor a 0').isFloat({ min: 0.01 }),
    check('reason', 'Razón es requerida').optional().isLength({ min: 1 }),
    checkValidationResult,
  ],
  updateProductPrice
);

// Configuración por producto
router.put(
  '/product-settings/:id',
  protect,
  [
    check('customCost', 'Coste personalizado debe ser positivo').optional().isFloat({ min: 0 }),
    check('customMargin', 'Margen personalizado debe estar entre 0.1 y 0.9')
      .optional()
      .isFloat({ min: 0.1, max: 0.9 }),
    check('customShippingCost', 'Coste de envío personalizado debe ser positivo')
      .optional()
      .isFloat({ min: 0 }),
    check('autoUpdateEnabled', 'Auto-actualización debe ser booleano').optional().isBoolean(),
    checkValidationResult,
  ],
  updateProductPricingSettings
);

router.get('/pending-actions/:actionType', protect, getPendingActionProducts);
router.put(
  '/set-fixed-price/:id',
  protect,
  [
    check('fixedPrice', 'Precio fijo debe ser mayor a 0 o null')
      .optional()
      .custom((value) => {
        return value === null || value > 0;
      }),
    check('reason', 'Razón es requerida cuando se establece precio fijo')
      .optional()
      .isLength({ min: 1 }),
    checkValidationResult,
  ],
  setFixedPrice
);

module.exports = router;
