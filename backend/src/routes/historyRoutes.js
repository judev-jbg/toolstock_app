const express = require('express');
const {
  getHistoryDashboard,
  getHistory,
  getHistoryEntry,
  getProductHistory,
  getHistoryStats,
  exportHistory,
} = require('../controllers/historyController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Dashboard de historial
router.get('/dashboard', protect, getHistoryDashboard);

// Estadísticas
router.get('/stats', protect, getHistoryStats);

// Exportación (solo admin)
router.get('/export', protect, authorize('admin', 'root'), exportHistory);

// Historial general
router.get('/', protect, getHistory);

// Historial específico
router.get('/:id', protect, getHistoryEntry);

// Historial por producto
router.get('/product/:productId', protect, getProductHistory);

module.exports = router;
