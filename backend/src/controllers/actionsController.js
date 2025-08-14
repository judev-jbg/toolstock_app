const PendingAction = require('../models/pendingActionModel');
const Product = require('../models/productModel');
const actionDetector = require('../services/pricing/actionDetector');
const logger = require('../utils/logger');

/**
 * @desc    Obtener resumen de acciones pendientes
 * @route   GET /api/actions/dashboard
 * @access  Private
 */
const getActionsDashboard = async (req, res) => {
  try {
    // Estadísticas generales
    const totalActions = await PendingAction.countDocuments({ status: 'pending' });
    const criticalActions = await PendingAction.countDocuments({
      status: 'pending',
      priority: 'critical',
    });
    const highActions = await PendingAction.countDocuments({
      status: 'pending',
      priority: 'high',
    });

    // Acciones por tipo
    const actionsByType = await PendingAction.getPendingByType();

    // Acciones por prioridad
    const actionsByPriority = await PendingAction.getPendingByPriority();

    // Acciones críticas recientes
    const recentCritical = await PendingAction.getCriticalActions(10);

    // Productos más problemáticos
    const problematicProducts = await PendingAction.aggregate([
      { $match: { status: 'pending' } },
      {
        $group: {
          _id: '$productId',
          erp_sku: { $first: '$erp_sku' },
          actionCount: { $sum: 1 },
          criticalCount: {
            $sum: { $cond: [{ $eq: ['$priority', 'critical'] }, 1, 0] },
          },
          highCount: {
            $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] },
          },
          actionTypes: { $push: '$actionType' },
        },
      },
      { $sort: { criticalCount: -1, highCount: -1, actionCount: -1 } },
      { $limit: 10 },
    ]);

    res.json({
      summary: {
        totalActions,
        criticalActions,
        highActions,
        mediumActions: await PendingAction.countDocuments({
          status: 'pending',
          priority: 'medium',
        }),
        lowActions: await PendingAction.countDocuments({
          status: 'pending',
          priority: 'low',
        }),
      },
      breakdown: {
        byType: actionsByType,
        byPriority: actionsByPriority,
      },
      recentCritical: recentCritical.map((action) => ({
        _id: action._id,
        actionType: action.actionType,
        priority: action.priority,
        title: action.title,
        erp_sku: action.erp_sku,
        productName: action.productId?.erp_name || action.productId?.amz_title,
        createdAt: action.createdAt,
        data: action.data,
      })),
      problematicProducts,
    });
  } catch (error) {
    logger.error('Error getting actions dashboard:', error);
    res.status(500).json({
      message: 'Error obteniendo dashboard de acciones',
      error: error.message,
    });
  }
};

/**
 * @desc    Obtener acciones pendientes con filtros y paginación
 * @route   GET /api/actions
 * @access  Private
 */
const getActions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      priority,
      actionType,
      status = 'pending',
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    // Construir filtros
    const filters = {};

    if (status && status !== 'all') {
      if (status.includes(',')) {
        filters.status = { $in: status.split(',') };
      } else {
        filters.status = status;
      }
    }

    if (priority && priority !== 'all') {
      if (priority.includes(',')) {
        filters.priority = { $in: priority.split(',') };
      } else {
        filters.priority = priority;
      }
    }

    if (actionType && actionType !== 'all') {
      if (actionType.includes(',')) {
        filters.actionType = { $in: actionType.split(',') };
      } else {
        filters.actionType = actionType;
      }
    }

    if (search) {
      filters.$or = [
        { erp_sku: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Configurar paginación
    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * pageSize;

    // Configurar ordenación
    const sortOptions = {};
    // Ordenación especial por prioridad
    if (sortBy === 'priority') {
      const priorityOrder = { critical: 1, high: 2, medium: 3, low: 4 };
      sortOptions._priorityOrder = sortOrder === 'desc' ? -1 : 1;
    } else {
      sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;
    }

    // Ejecutar consulta
    let query = PendingAction.find(filters)
      .populate('productId', 'erp_sku erp_name amz_title amz_asin')
      .skip(skip)
      .limit(pageSize);

    if (sortBy === 'priority') {
      // Ordenación manual por prioridad
      query = query.sort({
        priority: sortOrder === 'desc' ? -1 : 1,
        createdAt: -1,
      });
    } else {
      query = query.sort(sortOptions);
    }

    const [actions, totalCount] = await Promise.all([
      query.lean(),
      PendingAction.countDocuments(filters),
    ]);

    // Calcular información de paginación
    const totalPages = Math.ceil(totalCount / pageSize);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.json({
      actions: actions.map((action) => ({
        ...action,
        product: action.productId
          ? {
              erp_sku: action.productId.erp_sku,
              erp_name: action.productId.erp_name,
              amz_title: action.productId.amz_title,
              amz_asin: action.productId.amz_asin,
            }
          : null,
      })),
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: pageSize,
        hasNextPage,
        hasPrevPage,
      },
    });
  } catch (error) {
    logger.error('Error getting actions:', error);
    res.status(500).json({
      message: 'Error obteniendo acciones',
      error: error.message,
    });
  }
};

/**
 * @desc    Obtener acción específica por ID
 * @route   GET /api/actions/:id
 * @access  Private
 */
const getActionById = async (req, res) => {
  try {
    const action = await PendingAction.findById(req.params.id).populate('productId');

    if (!action) {
      return res.status(404).json({ message: 'Acción no encontrada' });
    }

    res.json({
      action,
      product: action.productId,
    });
  } catch (error) {
    logger.error('Error getting action by ID:', error);
    res.status(500).json({
      message: 'Error obteniendo acción',
      error: error.message,
    });
  }
};

/**
 * @desc    Resolver una acción pendiente
 * @route   PUT /api/actions/:id/resolve
 * @access  Private
 */
const resolveAction = async (req, res) => {
  try {
    const { resolutionNote } = req.body;
    const action = await PendingAction.findById(req.params.id);

    if (!action) {
      return res.status(404).json({ message: 'Acción no encontrada' });
    }

    if (action.status !== 'pending' && action.status !== 'in_progress') {
      return res.status(400).json({
        message: `No se puede resolver una acción con estado ${action.status}`,
      });
    }

    const resolvedBy = req.user?.name || req.user?.email || 'usuario';
    await action.resolve(resolvedBy, resolutionNote, 'manual');

    logger.info(
      `Action resolved: ${action.actionType} for product ${action.erp_sku} by ${resolvedBy}`
    );

    res.json({
      message: 'Acción resuelta correctamente',
      action,
    });
  } catch (error) {
    logger.error('Error resolving action:', error);
    res.status(500).json({
      message: 'Error resolviendo acción',
      error: error.message,
    });
  }
};

/**
 * @desc    Descartar una acción pendiente
 * @route   PUT /api/actions/:id/dismiss
 * @access  Private
 */
const dismissAction = async (req, res) => {
  try {
    const { dismissalNote } = req.body;
    const action = await PendingAction.findById(req.params.id);

    if (!action) {
      return res.status(404).json({ message: 'Acción no encontrada' });
    }

    if (action.status !== 'pending' && action.status !== 'in_progress') {
      return res.status(400).json({
        message: `No se puede descartar una acción con estado ${action.status}`,
      });
    }

    const dismissedBy = req.user?.name || req.user?.email || 'usuario';
    await action.dismiss(dismissedBy, dismissalNote);

    logger.info(
      `Action dismissed: ${action.actionType} for product ${action.erp_sku} by ${dismissedBy}`
    );

    res.json({
      message: 'Acción descartada correctamente',
      action,
    });
  } catch (error) {
    logger.error('Error dismissing action:', error);
    res.status(500).json({
      message: 'Error descartando acción',
      error: error.message,
    });
  }
};

/**
 * @desc    Resolver múltiples acciones en lote
 * @route   PUT /api/actions/bulk-resolve
 * @access  Private
 */
const bulkResolveActions = async (req, res) => {
  try {
    const { actionIds, resolutionNote } = req.body;

    if (!Array.isArray(actionIds) || actionIds.length === 0) {
      return res.status(400).json({
        message: 'Se requiere un array de IDs de acciones',
      });
    }

    const resolvedBy = req.user?.name || req.user?.email || 'usuario';
    const results = {
      resolved: 0,
      errors: 0,
      errorDetails: [],
    };

    for (const actionId of actionIds) {
      try {
        const action = await PendingAction.findById(actionId);

        if (!action) {
          results.errors++;
          results.errorDetails.push({
            actionId,
            error: 'Acción no encontrada',
          });
          continue;
        }

        if (action.status === 'pending' || action.status === 'in_progress') {
          await action.resolve(resolvedBy, resolutionNote, 'bulk_operation');
          results.resolved++;
        } else {
          results.errors++;
          results.errorDetails.push({
            actionId,
            error: `Estado inválido: ${action.status}`,
          });
        }
      } catch (error) {
        results.errors++;
        results.errorDetails.push({
          actionId,
          error: error.message,
        });
      }
    }

    logger.info(`Bulk action resolution by ${resolvedBy}:`, results);

    res.json({
      message: `Operación en lote completada: ${results.resolved} resueltas, ${results.errors} errores`,
      results,
    });
  } catch (error) {
    logger.error('Error in bulk resolve actions:', error);
    res.status(500).json({
      message: 'Error en resolución masiva',
      error: error.message,
    });
  }
};

/**
 * @desc    Detectar acciones para un producto específico
 * @route   POST /api/actions/detect/:productId
 * @access  Private
 */
const detectActionsForProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.productId);

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    const result = await actionDetector.processProductActions(product);

    res.json({
      message: `Detección completada para producto ${product.erp_sku}`,
      result,
    });
  } catch (error) {
    logger.error('Error detecting actions for product:', error);
    res.status(500).json({
      message: 'Error detectando acciones',
      error: error.message,
    });
  }
};

/**
 * @desc    Ejecutar detección masiva de acciones
 * @route   POST /api/actions/detect-all
 * @access  Private/Admin
 */
const detectAllActions = async (req, res) => {
  try {
    logger.info('Starting bulk action detection...');

    // Ejecutar detección en segundo plano para no bloquear respuesta
    setImmediate(async () => {
      try {
        await actionDetector.detectActionsForAllProducts();
      } catch (error) {
        logger.error('Error in background action detection:', error);
      }
    });

    res.json({
      message: 'Detección masiva de acciones iniciada en segundo plano',
      note: 'El proceso puede tardar varios minutos dependiendo del número de productos',
    });
  } catch (error) {
    logger.error('Error starting bulk action detection:', error);
    res.status(500).json({
      message: 'Error iniciando detección masiva',
      error: error.message,
    });
  }
};

module.exports = {
  getActionsDashboard,
  getActions,
  getActionById,
  resolveAction,
  dismissAction,
  bulkResolveActions,
  detectActionsForProduct,
  detectAllActions,
};
