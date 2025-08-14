const PriceHistory = require('../models/priceHistoryModel');
const Product = require('../models/productModel');
const historyService = require('../services/pricing/historyService');
const logger = require('../utils/logger');

/**
 * @desc    Obtener dashboard del historial
 * @route   GET /api/history/dashboard
 * @access  Private
 */
const getHistoryDashboard = async (req, res) => {
  try {
    const { days = 7 } = req.query;

    // Calcular fechas
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Obtener estadísticas del período
    const periodStats = await historyService.getPeriodStats(startDate, endDate);

    // Cambios recientes
    const recentChanges = await historyService.getRecentHistory(20, {
      dateFrom: startDate,
      dateTo: endDate,
    });

    // Estadísticas adicionales
    const totalEntriesEver = await PriceHistory.countDocuments();
    const successfulChanges = await PriceHistory.countDocuments({
      'execution.status': 'applied',
      createdAt: { $gte: startDate, $lte: endDate },
    });
    const failedChanges = await PriceHistory.countDocuments({
      'execution.status': 'failed',
      createdAt: { $gte: startDate, $lte: endDate },
    });

    // Cambios por día (para gráfico)
    const dailyChanges = await PriceHistory.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          'execution.status': 'applied',
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          count: { $sum: 1 },
          priceIncreases: {
            $sum: { $cond: [{ $eq: ['$impact.priceDirection', 'increase'] }, 1, 0] },
          },
          priceDecreases: {
            $sum: { $cond: [{ $eq: ['$impact.priceDirection', 'decrease'] }, 1, 0] },
          },
          totalImpact: { $sum: '$impact.changeAmount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      period: {
        days: parseInt(days),
        startDate,
        endDate,
      },
      summary: {
        totalChanges: periodStats.totalChanges,
        totalProducts: periodStats.totalProducts,
        successfulChanges,
        failedChanges,
        successRate:
          periodStats.totalChanges > 0
            ? ((successfulChanges / periodStats.totalChanges) * 100).toFixed(1)
            : 0,
        totalPriceImpact: periodStats.totalPriceImpact.toFixed(2),
        totalEntriesEver,
      },
      breakdown: {
        byType: periodStats.changesByType,
        byDirection: periodStats.priceDirection,
        dailyTrend: dailyChanges,
      },
      recentChanges: recentChanges.slice(0, 10),
    });
  } catch (error) {
    logger.error('Error getting history dashboard:', error);
    res.status(500).json({
      message: 'Error obteniendo dashboard de historial',
      error: error.message,
    });
  }
};

/**
 * @desc    Obtener historial con filtros y paginación
 * @route   GET /api/history
 * @access  Private
 */
const getHistory = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      changeType,
      status,
      changedBy,
      productId,
      erp_sku,
      dateFrom,
      dateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    // Construir filtros
    const filters = {};

    if (changeType && changeType !== 'all') {
      if (changeType.includes(',')) {
        filters.changeType = { $in: changeType.split(',') };
      } else {
        filters.changeType = changeType;
      }
    }

    if (status && status !== 'all') {
      filters['execution.status'] = status;
    }

    if (changedBy) {
      filters['execution.changedBy'] = new RegExp(changedBy, 'i');
    }

    if (productId) {
      filters.productId = productId;
    }

    if (erp_sku) {
      filters.erp_sku = new RegExp(erp_sku, 'i');
    }

    if (dateFrom || dateTo) {
      filters.createdAt = {};
      if (dateFrom) filters.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filters.createdAt.$lte = new Date(dateTo);
    }

    // Configurar paginación
    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * pageSize;

    // Configurar ordenación
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Ejecutar consulta
    const [history, totalCount] = await Promise.all([
      PriceHistory.find(filters)
        .populate('productId', 'erp_sku erp_name amz_title amz_asin')
        .sort(sortOptions)
        .skip(skip)
        .limit(pageSize)
        .lean(),
      PriceHistory.countDocuments(filters),
    ]);

    // Calcular información de paginación
    const totalPages = Math.ceil(totalCount / pageSize);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    // Formatear respuesta
    const formattedHistory = history.map((entry) => ({
      ...entry,
      product: entry.productId
        ? {
            erp_sku: entry.productId.erp_sku,
            erp_name: entry.productId.erp_name,
            amz_title: entry.productId.amz_title,
            amz_asin: entry.productId.amz_asin,
          }
        : null,
      // Simplificar algunos campos para la vista de lista
      priceChange: {
        from: entry.prices.previousPrice.amazon,
        to: entry.prices.appliedPrice,
        amount: entry.impact.changeAmount,
        percentage: entry.impact.priceChangePercentage,
        direction: entry.impact.priceDirection,
      },
    }));

    res.json({
      history: formattedHistory,
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
    logger.error('Error getting history:', error);
    res.status(500).json({
      message: 'Error obteniendo historial',
      error: error.message,
    });
  }
};

/**
 * @desc    Obtener entrada específica del historial
 * @route   GET /api/history/:id
 * @access  Private
 */
const getHistoryEntry = async (req, res) => {
  try {
    const historyEntry = await PriceHistory.findById(req.params.id)
      .populate('productId')
      .populate('references.originatingActionId');

    if (!historyEntry) {
      return res.status(404).json({ message: 'Entrada de historial no encontrada' });
    }

    res.json({
      historyEntry,
      product: historyEntry.productId,
    });
  } catch (error) {
    logger.error('Error getting history entry:', error);
    res.status(500).json({
      message: 'Error obteniendo entrada de historial',
      error: error.message,
    });
  }
};

/**
 * @desc    Obtener historial de un producto específico
 * @route   GET /api/history/product/:productId
 * @access  Private
 */
const getProductHistory = async (req, res) => {
  try {
    const { days = 30, limit = 50 } = req.query;

    // Verificar que el producto existe
    const product = await Product.findById(req.params.productId).select(
      'erp_sku erp_name amz_title'
    );

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    // Obtener resumen del producto
    const summary = await historyService.getProductSummary(req.params.productId, parseInt(days));

    // Obtener historial completo del producto
    const history = await PriceHistory.getChangesByProduct(req.params.productId, parseInt(limit));

    res.json({
      product: {
        _id: product._id,
        erp_sku: product.erp_sku,
        erp_name: product.erp_name,
        amz_title: product.amz_title,
      },
      period: {
        days: parseInt(days),
        limit: parseInt(limit),
      },
      summary,
      history,
    });
  } catch (error) {
    logger.error('Error getting product history:', error);
    res.status(500).json({
      message: 'Error obteniendo historial del producto',
      error: error.message,
    });
  }
};

/**
 * @desc    Obtener estadísticas del historial
 * @route   GET /api/history/stats
 * @access  Private
 */
const getHistoryStats = async (req, res) => {
  try {
    const { period = '7d', groupBy = 'day' } = req.query;

    // Calcular fechas según período
    const endDate = new Date();
    const startDate = new Date();

    switch (period) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }

    // Obtener estadísticas
    const periodStats = await historyService.getPeriodStats(startDate, endDate);

    // Estadísticas por actor
    const actorStats = await PriceHistory.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          'execution.status': 'applied',
        },
      },
      {
        $group: {
          _id: {
            changedBy: '$execution.changedBy',
            actorType: '$execution.actorType',
          },
          count: { $sum: 1 },
          totalImpact: { $sum: '$impact.changeAmount' },
          increases: {
            $sum: { $cond: [{ $eq: ['$impact.priceDirection', 'increase'] }, 1, 0] },
          },
          decreases: {
            $sum: { $cond: [{ $eq: ['$impact.priceDirection', 'decrease'] }, 1, 0] },
          },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Top productos con más cambios
    const topChangedProducts = await PriceHistory.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          'execution.status': 'applied',
        },
      },
      {
        $group: {
          _id: '$productId',
          erp_sku: { $first: '$erp_sku' },
          changeCount: { $sum: 1 },
          totalImpact: { $sum: '$impact.changeAmount' },
          avgImpact: { $avg: '$impact.changeAmount' },
        },
      },
      { $sort: { changeCount: -1 } },
      { $limit: 10 },
    ]);

    res.json({
      period: {
        startDate,
        endDate,
        duration: period,
      },
      overview: periodStats,
      breakdown: {
        byActor: actorStats,
        topChangedProducts,
      },
    });
  } catch (error) {
    logger.error('Error getting history stats:', error);
    res.status(500).json({
      message: 'Error obteniendo estadísticas',
      error: error.message,
    });
  }
};

/**
 * @desc    Exportar historial a CSV
 * @route   GET /api/history/export
 * @access  Private/Admin
 */
const exportHistory = async (req, res) => {
  try {
    const { format = 'csv', dateFrom, dateTo, changeType, limit = 1000 } = req.query;

    // Construir filtros
    const filters = {};

    if (dateFrom || dateTo) {
      filters.createdAt = {};
      if (dateFrom) filters.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filters.createdAt.$lte = new Date(dateTo);
    }

    if (changeType && changeType !== 'all') {
      filters.changeType = changeType;
    }

    // Obtener datos
    const history = await PriceHistory.find(filters)
      .populate('productId', 'erp_sku erp_name amz_title')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    if (format === 'csv') {
      // Generar CSV
      const csvHeaders = [
        'Fecha',
        'SKU',
        'Producto',
        'Tipo de Cambio',
        'Precio Anterior',
        'Precio Nuevo',
        'Diferencia',
        'Porcentaje',
        'Motivo',
        'Cambiado Por',
        'Estado',
      ].join(',');

      const csvRows = history.map((entry) =>
        [
          entry.createdAt.toISOString(),
          entry.erp_sku,
          `"${entry.productId?.erp_name || entry.productId?.amz_title || ''}"`,
          entry.changeType,
          entry.prices.previousPrice.amazon || 0,
          entry.prices.appliedPrice,
          entry.impact.changeAmount.toFixed(2),
          entry.impact.priceChangePercentage.toFixed(2) + '%',
          `"${entry.context.trigger}"`,
          entry.execution.changedBy,
          entry.execution.status,
        ].join(',')
      );

      const csvContent = [csvHeaders, ...csvRows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="historial-precios.csv"');
      res.send(csvContent);
    } else {
      // Formato JSON
      res.json({
        exportInfo: {
          totalRecords: history.length,
          filters,
          exportedAt: new Date(),
        },
        data: history,
      });
    }
  } catch (error) {
    logger.error('Error exporting history:', error);
    res.status(500).json({
      message: 'Error exportando historial',
      error: error.message,
    });
  }
};

module.exports = {
  getHistoryDashboard,
  getHistory,
  getHistoryEntry,
  getProductHistory,
  getHistoryStats,
  exportHistory,
};
