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
const productScheduler = require('../services/schedulers/productScheduler');

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

// Agregar esta ruta para testing manual TODO: ELIMINAR
router.post('/milwaukee-stock/:action', protect, authorize('admin', 'root'), async (req, res) => {
  try {
    const { action } = req.params;

    if (!['activate', 'deactivate'].includes(action)) {
      return res.status(400).json({
        message: 'Action must be "activate" or "deactivate"',
      });
    }

    await productScheduler.forceMilwaukeeStockUpdate(action);

    res.json({
      message: `MILWAUKEE stock ${action} completed successfully`,
    });
  } catch (error) {
    logger.error(`Error in manual MILWAUKEE stock ${req.params.action}:`, error);
    res.status(500).json({
      message: `Error executing MILWAUKEE stock ${req.params.action}`,
      error: error.message,
    });
  }
});

// Agregar este endpoint con las otras rutas de administración
/**
 * @desc    Obtener estado de todos los jobs programados
 * @route   GET /api/products/jobs/status
 * @access  Private/Admin
 */
// En productRoutes.js, actualizar el endpoint GET /api/products/jobs/status
router.get('/jobs/status', protect, authorize('admin', 'root'), (req, res) => {
  try {
    const jobsStatus = productScheduler.getJobsStatus();

    // Enriquecer la información con detalles más útiles
    const enhancedStatus = {};

    for (const [jobName, status] of Object.entries(jobsStatus)) {
      enhancedStatus[jobName] = {
        ...status,
        isActive: status.active,
        nextRun: status.nextInvocation ? status.nextInvocation.toISOString() : null,
        nextRunLocal: status.nextInvocation
          ? status.nextInvocation.toLocaleString('es-ES', {
              timeZone: 'Europe/Madrid',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          : null,
        description: getJobDescription(jobName),
        // Información adicional de debug
        hasError: !!status.error,
        errorMessage: status.error || null,
      };
    }

    res.json({
      message: 'Estado de jobs programados',
      timestamp: new Date().toISOString(),
      timezone: 'Europe/Madrid',
      jobs: enhancedStatus,
      totalJobs: Object.keys(enhancedStatus).length,
      activeJobs: Object.values(enhancedStatus).filter((job) => job.isActive).length,
    });
  } catch (error) {
    console.error('Error getting jobs status:', error);
    res.status(500).json({
      message: 'Error obteniendo estado de jobs',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

/**
 * @desc    Ejecutar manualmente un job específico
 * @route   POST /api/products/jobs/execute/:jobName
 * @access  Private/Admin
 */
router.post('/jobs/execute/:jobName', protect, authorize('admin', 'root'), async (req, res) => {
  try {
    const { jobName } = req.params;

    const validJobs = ['productSync', 'healthCheck', 'milwaukee-activate', 'milwaukee-deactivate'];

    if (!validJobs.includes(jobName)) {
      return res.status(400).json({
        message: 'Job no válido',
        validJobs: validJobs,
      });
    }

    const result = await productScheduler.forceJob(jobName);

    res.json({
      message: `Job ${jobName} ejecutado correctamente`,
      jobName: jobName,
      executedAt: new Date().toISOString(),
      result: result,
    });
  } catch (error) {
    console.error(`Error executing job ${req.params.jobName}:`, error);
    res.status(500).json({
      message: `Error ejecutando job ${req.params.jobName}`,
      error: error.message,
    });
  }
});

/**
 * @desc    Obtener información general del scheduler
 * @route   GET /api/products/jobs/info
 * @access  Private/Admin
 */
router.get('/jobs/info', protect, authorize('admin', 'root'), (req, res) => {
  try {
    const jobsStatus = productScheduler.getJobsStatus();
    const now = new Date();

    const summary = {
      serverTime: now.toISOString(),
      serverTimeLocal: now.toLocaleString('es-ES', {
        timeZone: 'Europe/Madrid',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      timezone: 'Europe/Madrid',
      environment: process.env.NODE_ENV,
      schedulerActive: process.env.NODE_ENV === 'production',
      totalJobs: Object.keys(jobsStatus).length,
      activeJobs: Object.values(jobsStatus).filter((job) => job.active).length,
      jobsList: Object.keys(jobsStatus).map((jobName) => ({
        name: jobName,
        description: getJobDescription(jobName),
        nextRun: jobsStatus[jobName].nextInvocation
          ? jobsStatus[jobName].nextInvocation.toLocaleString('es-ES', {
              timeZone: 'Europe/Madrid',
            })
          : 'No programado',
      })),
    };

    res.json(summary);
  } catch (error) {
    console.error('Error getting scheduler info:', error);
    res.status(500).json({
      message: 'Error obteniendo información del scheduler',
      error: error.message,
    });
  }
});

// Función helper para describir los jobs
function getJobDescription(jobName) {
  const descriptions = {
    productSync: 'Sincronización automática de productos con Amazon (cada 6 horas)',
    healthCheck: 'Verificación de salud del sistema (cada hora)',
    'milwaukee-activate-stock': 'Activar stock MILWAUKEE = 10 (L-V a las 17:00)',
    'milwaukee-deactivate-stock': 'Desactivar stock MILWAUKEE = 0 (L-V a las 05:00)',
    quickSync: 'Sincronización rápida de productos modificados (cada 30 minutos)',
  };

  return descriptions[jobName] || 'Descripción no disponible';
}

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
