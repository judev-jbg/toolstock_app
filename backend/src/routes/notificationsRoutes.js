const express = require('express');
const {
  getNotificationsStatus,
  startPolling,
  stopPolling,
  executePollingCycle,
  startWebhookSimulation,
  stopWebhookSimulation,
  simulateProductNotification,
  processTestNotification,
  getSQSConfig,
} = require('../controllers/notificationsController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Estado general del sistema
router.get('/status', protect, authorize('admin', 'root'), getNotificationsStatus);

// Control de polling
router.post('/polling/start', protect, authorize('admin', 'root'), startPolling);
router.post('/polling/stop', protect, authorize('admin', 'root'), stopPolling);
router.post('/polling/execute', protect, authorize('admin', 'root'), executePollingCycle);

// Control de simulación
router.post('/simulation/start', protect, authorize('admin', 'root'), startWebhookSimulation);
router.post('/simulation/stop', protect, authorize('admin', 'root'), stopWebhookSimulation);
router.post(
  '/simulation/product/:productId',
  protect,
  authorize('admin', 'root'),
  simulateProductNotification
);

// Testing
router.post('/test/process', protect, authorize('admin', 'root'), processTestNotification);

// Configuración SQS (preparación futura)
router.get('/sqs/config', protect, authorize('admin', 'root'), getSQSConfig);

module.exports = router;
