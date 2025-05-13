const express = require('express');
const {
  createGLSShipment,
  getGLSShipmentLabel,
  getGLSShipmentStatus,
  generateGLSShipmentsCsv,
  prepareShipmentsFromOrders,
} = require('../controllers/shippingController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas para GLS
router.post('/gls/create', createGLSShipment);
router.get('/gls/label/:expeditionNumber', getGLSShipmentLabel);
router.get('/gls/status/:expeditionNumber/:postalCode', getGLSShipmentStatus);
router.post('/gls/generate-csv', generateGLSShipmentsCsv);
router.post('/gls/prepare-shipments', prepareShipmentsFromOrders);

module.exports = router;
