const express = require('express');
const {
  exportOrdersForERP,
  importOrderUpdates,
  uploadMiddleware,
} = require('../controllers/erpIntegrationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas para exportación e importación
router.post('/export-orders', exportOrdersForERP);
router.post('/import-updates', uploadMiddleware, importOrderUpdates);

module.exports = router;
