// backend/src/routes/catalogRoutes.js
const express = require('express');
const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  updateProductField,
  deleteProduct,
  getCategories,
  getManufacturers,
  syncProductWithAmazon,
  syncProductWithPrestashop,
  updateCompetitorPrices,
  optimizePrice,
  bulkUpdateStock,
  bulkUpdatePrices,
  recalculatePrices,
} = require('../controllers/catalogController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas para obtener y filtrar productos
router.route('/').get(getProducts).post(authorize('admin', 'root'), createProduct);
router.get('/categories', getCategories);
router.get('/manufacturers', getManufacturers);

// Rutas para producto individual
router
  .route('/:id')
  .get(getProductById)
  .put(authorize('admin', 'root'), updateProduct)
  .patch(updateProductField)
  .delete(authorize('admin', 'root'), deleteProduct);

// Rutas para sincronización
router.post('/:id/sync-amazon', authorize('admin', 'root'), syncProductWithAmazon);
router.post('/:id/sync-prestashop', authorize('admin', 'root'), syncProductWithPrestashop);

// Rutas para precios de competencia
router.post('/:id/update-competitor-prices', updateCompetitorPrices);
router.post('/:id/optimize-price', authorize('admin', 'root'), optimizePrice);

// Rutas para actualizaciones masivas
router.post('/bulk-update-stock', authorize('admin', 'root'), bulkUpdateStock);
router.post('/bulk-update-prices', authorize('admin', 'root'), bulkUpdatePrices);
router.post('/recalculate-prices', authorize('admin', 'root'), recalculatePrices);

module.exports = router;
