const express = require('express');
const { check } = require('express-validator');
const {
  getProducts,
  getBrands,
  getProductStats,
  getProductById,
  syncProducts,
  updateProductStock,
  bulkUpdateStock,
  getProductsNeedingSync,
  getAvailableEndpoints,
  getTestOrders,
  checkAmazonConfig,
  updateProduct,
} = require('../controllers/productController');
const { importProducts, getImportTemplate } = require('../controllers/importController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { checkValidationResult } = require('../middleware/validation');
const { uploadExcel } = require('../middleware/excelMiddleware');

const router = express.Router();

// Rutas públicas (requieren autenticación básica)
router.get('/', protect, getProducts);
router.get('/brands', protect, getBrands);
router.get('/stats', protect, getProductStats);
router.get('/sync-needed', protect, getProductsNeedingSync);

// Rutas de importación de productos
router.get('/import/template', protect, authorize('admin', 'root'), getImportTemplate);
router.post(
  '/import',
  protect,
  authorize('admin', 'root'),
  uploadExcel.single('file'),
  importProducts
);

// Rutas de administración (requieren permisos de admin)
router.post('/sync', protect, authorize('admin', 'root'), syncProducts);
router.get('/debug/endpoints', protect, authorize('admin', 'root'), getAvailableEndpoints);
router.get('/debug/test-orders', protect, authorize('admin', 'root'), getTestOrders);
router.get('/debug/config-check', protect, authorize('admin', 'root'), checkAmazonConfig);

// IMPORTANTE: Rutas específicas ANTES de rutas con parámetros
// Rutas de actualización de stock (antes de /:id)
router.put(
  '/bulk-stock',
  [
    protect,
    check('updates', 'Se requiere un array de actualizaciones').isArray({ min: 1 }),
    check('updates.*.id', 'Cada actualización debe tener un ID válido').isMongoId(),
    check('updates.*.quantity', 'Cada actualización debe tener una cantidad válida')
      .isInt({ min: 0 })
      .toInt(),
    checkValidationResult,
  ],
  bulkUpdateStock
);

// Rutas con parámetros (deben ir DESPUÉS de las rutas específicas)
router.get('/:id', protect, getProductById);

router.put(
  '/:id',
  [
    protect,
    check('title', 'El título debe ser válido').optional().isLength({ min: 1 }),
    check('brand', 'La marca debe ser válida').optional().isLength({ min: 1 }),
    check('price', 'El precio debe ser un número válido').optional().isFloat({ min: 0 }),
    check('status', 'El estado debe ser válido')
      .optional()
      .isIn(['Active', 'Inactive', 'Incomplete']),
    checkValidationResult,
  ],
  updateProduct
);

router.put(
  '/:id/stock',
  [
    protect,
    check('quantity', 'La cantidad debe ser un número válido').isInt({ min: 0 }).toInt(),
    checkValidationResult,
  ],
  updateProductStock
);

module.exports = router;
