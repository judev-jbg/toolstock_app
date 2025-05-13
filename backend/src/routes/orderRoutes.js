const express = require('express');
const {
  getOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderShipping,
  getPendingOrders,
  getPendingOrdersUntilToday,
  getDelayedOrders,
  getOutOfStockOrders,
  getOutOfStockOrdersUntilToday,
  getOutOfStockDelayedOrders,
  getShipFakeOrders,
  updateOrderStockStatus,
  updateOrderShipFake,
  markOrderForShipment,
  getShipmentsHistory,
  getShipmentsByFileName,
  getOrdersReadyToShip,
  addOrderToShipment,
  updateShipment,
  deleteShipment,
  processShipments,
} = require('../controllers/orderController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas base de órdenes
router.route('/').get(getOrders);

router.route('/:id').get(getOrderById).patch(updateOrderStatus);

router.route('/:id/shipping').put(updateOrderShipping);

// Rutas específicas para ts orders manager: órdenes pendientes
router.get('/pending', getPendingOrders);
router.get('/pending/until-today', getPendingOrdersUntilToday);
router.get('/pending/delayed', getDelayedOrders);

// Rutas para órdenes sin stock
router.get('/outofstock', getOutOfStockOrders);
router.get('/outofstock/until-today', getOutOfStockOrdersUntilToday);
router.get('/outofstock/delayed', getOutOfStockDelayedOrders);

// Rutas para órdenes con envío fake
router.get('/shipfake', getShipFakeOrders);

// Rutas para actualizar estados específicos
router.patch('/:id/stock', updateOrderStockStatus);
router.patch('/:id/shipfake', updateOrderShipFake);
router.patch('/:id/mark-for-shipment', markOrderForShipment);

// Rutas para shipments (envíos)
router.get('/shipments/history', getShipmentsHistory);
router.get('/shipments/file/:fileName', getShipmentsByFileName);
router.get('/readytoship', getOrdersReadyToShip);

router.route('/shipment').post(addOrderToShipment);

router.route('/shipment/:id').patch(updateShipment).delete(deleteShipment);

router.post('/shipments/process', processShipments);

module.exports = router;
