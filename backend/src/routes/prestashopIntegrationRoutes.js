// backend/src/routes/prestashopIntegrationRoutes.js (actualización)

const express = require('express');
const {
  syncPrestashopOrders,
  syncFromAmazon,
  syncOrderStatuses,
} = require('../controllers/prestashopIntegrationController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas para sincronización de pedidos
router.post('/sync-orders', authorize('admin', 'root'), syncPrestashopOrders);
router.post('/sync-from-amazon', authorize('admin', 'root'), syncFromAmazon);
router.post('/sync-statuses', authorize('admin', 'root'), syncOrderStatuses);

module.exports = router;
