const express = require('express');
const {
  syncAmazonOrders,
  updateAmazonOrderShipment,
  uploadOrderReport,
  uploadMiddleware,
} = require('../controllers/amazonIntegrationController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas para sincronización de pedidos
router.post('/sync-orders', authorize('admin', 'root'), syncAmazonOrders);

// Ruta para actualizar estado de pedido
router.post('/update-shipment', updateAmazonOrderShipment);

// Ruta para procesar reportes
router.post('/upload-report', uploadMiddleware, uploadOrderReport);

module.exports = router;
