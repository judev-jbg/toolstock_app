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
  syncProductWithAmazon,
  syncProductWithPrestashop,
  updateCompetitorPrices,
  optimizePrice,
} = require('../controllers/catalogController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(protect);

// Rutas para productos
router.route('/').get(getProducts).post(authorize('admin', 'root'), createProduct);

router.route('/categories').get(getCategories);

router
  .route('/:id')
  .get(getProductById)
  .put(authorize('admin', 'root'), updateProduct)
  .patch(updateProductField)
  .delete(authorize('admin', 'root'), deleteProduct);

// Rutas para sincronización
router.route('/:id/sync-amazon').post(authorize('admin', 'root'), syncProductWithAmazon);

router.route('/:id/sync-prestashop').post(authorize('admin', 'root'), syncProductWithPrestashop);

// Rutas para precios de competencia
router
  .route('/:id/update-competitor-prices')
  .post(authorize('admin', 'root'), updateCompetitorPrices);

router.route('/:id/optimize-price').post(authorize('admin', 'root'), optimizePrice);

module.exports = router;
