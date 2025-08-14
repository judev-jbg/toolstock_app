const express = require('express');
const {
  processProduct,
  processBatch,
  simulateProduct,
  processNotification,
  getEngineStatus,
} = require('../controllers/pricingEngineController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Estado del motor
router.get('/status', protect, getEngineStatus);

// Procesamiento individual
router.post('/process/:productId', protect, processProduct);

// Simulación (sin aplicar cambios)
router.post('/simulate/:productId', protect, simulateProduct);

// Procesamiento en lote (solo admin)
router.post('/process-batch', protect, authorize('admin', 'root'), processBatch);

// Webhook para notificaciones de Amazon (sin autenticación para webhook)
router.post('/notification', processNotification);

module.exports = router;
