// backend/src/routes/erpIntegrationRoutes.js (actualización)
const express = require('express');
const {
  exportOrdersForERP,
  importOrderUpdates,
  importProducts,
  recalculatePrices,
  uploadMiddleware,
} = require('../controllers/erpIntegrationController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas para exportación e importación
router.post('/export-orders', exportOrdersForERP);
router.post('/import-updates', uploadMiddleware, importOrderUpdates);
router.post('/import-products', uploadMiddleware, importProducts);
router.post('/recalculate-prices', authorize('admin', 'root'), recalculatePrices);

module.exports = router;
