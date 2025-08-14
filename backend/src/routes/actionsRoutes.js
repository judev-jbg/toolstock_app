const express = require('express');
const {
  getActionsDashboard,
  getActions,
  getActionById,
  resolveAction,
  dismissAction,
  bulkResolveActions,
  detectActionsForProduct,
  detectAllActions,
} = require('../controllers/actionsController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Dashboard de acciones
router.get('/dashboard', protect, getActionsDashboard);

// CRUD de acciones
router.get('/', protect, getActions);
router.get('/:id', protect, getActionById);

// Resolución de acciones
router.put('/:id/resolve', protect, resolveAction);
router.put('/:id/dismiss', protect, dismissAction);
router.put('/bulk-resolve', protect, bulkResolveActions);

// Detección de acciones
router.post('/detect/:productId', protect, detectActionsForProduct);
router.post('/detect-all', protect, authorize('admin', 'root'), detectAllActions);

module.exports = router;
