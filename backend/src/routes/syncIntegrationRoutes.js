const express = require('express');
const { fullSync } = require('../controllers/prestashopIntegrationController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Ruta para sincronización completa
router.post('/full', authorize('admin', 'root'), fullSync);

module.exports = router;
