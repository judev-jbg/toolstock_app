const Product = require('../models/productModel');
const PricingConfig = require('../models/pricingConfigModel');
const pvpmCalculator = require('../services/pricing/pvpmCalculator');
const priceUpdater = require('../services/pricing/priceUpdater');
const competitorMonitor = require('../services/pricing/competitorMonitor');
const logger = require('../utils/logger').createLogger('pricingController');

/**
 * @desc    Obtener configuración de precios
 * @route   GET /api/pricing/config
 * @access  Private/Admin
 */
const getPricingConfig = async (req, res) => {
  try {
    const config = await PricingConfig.getInstance();
    res.json(config);
  } catch (error) {
    logger.error('Error getting pricing config:', error);
    res.status(500).json({
      message: 'Error obteniendo configuración de precios',
      error: error.message,
    });
  }
};

/**
 * @desc    Actualizar configuración de precios
 * @route   PUT /api/pricing/config
 * @access  Private/Admin
 */
const updatePricingConfig = async (req, res) => {
  try {
    const {
      defaultMargin,
      defaultIva,
      defaultShippingCost,
      shippingCostTable,
      competitorSettings,
    } = req.body;

    const config = await PricingConfig.getInstance();

    // Actualizar campos
    if (defaultMargin !== undefined) config.defaultMargin = defaultMargin;
    if (defaultIva !== undefined) config.defaultIva = defaultIva;
    if (defaultShippingCost !== undefined) config.defaultShippingCost = defaultShippingCost;
    if (shippingCostTable) config.shippingCostTable = shippingCostTable;
    if (competitorSettings)
      config.competitorSettings = { ...config.competitorSettings, ...competitorSettings };

    config.updatedAt = new Date();
    await config.save();

    // Trigger recálculo de PVPM para productos afectados
    const affectedProductsCount = await triggerPVPMRecalculation();

    res.json({
      message: 'Configuración actualizada correctamente',
      config,
      affectedProducts: affectedProductsCount,
    });
  } catch (error) {
    logger.error('Error updating pricing config:', error);
    res.status(500).json({
      message: 'Error actualizando configuración',
      error: error.message,
    });
  }
};

/**
 * @desc    Calcular PVPM para un producto específico
 * @route   POST /api/pricing/calculate-pvpm/:id
 * @access  Private
 */
const calculateProductPVPM = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    const result = await pvpmCalculator.calculatePVPM(product);

    // Actualizar PVPM en la base de datos
    await Product.findByIdAndUpdate(product._id, {
      'pricing.pvpm': result.pvpm,
    });

    res.json({
      message: 'PVPM calculado correctamente',
      productSku: product.erp_sku,
      ...result,
    });
  } catch (error) {
    logger.error('Error calculating PVPM:', error);
    res.status(500).json({
      message: 'Error calculando PVPM',
      error: error.message,
    });
  }
};

/**
 * @desc    Recalcular PVPM para múltiples productos
 * @route   POST /api/pricing/recalculate-pvpm
 * @access  Private/Admin
 */
const recalculateBulkPVPM = async (req, res) => {
  try {
    const { productIds, filters } = req.body;

    let products;

    if (productIds && productIds.length > 0) {
      // Productos específicos
      products = await Product.find({ _id: { $in: productIds } });
    } else if (filters) {
      // Filtros de productos
      const query = buildProductQuery(filters);
      products = await Product.find(query);
    } else {
      // Todos los productos
      products = await Product.find({});
    }

    const results = await pvpmCalculator.recalculateBulkPVPM(products);

    // Actualizar PVPM en base de datos para productos exitosos
    const bulkUpdates = results.success.map((result) => ({
      updateOne: {
        filter: { _id: result.productId },
        update: {
          'pricing.pvpm': result.newPvpm,
          'pricing.lastPriceUpdate': new Date(),
        },
      },
    }));

    if (bulkUpdates.length > 0) {
      await Product.bulkWrite(bulkUpdates);
    }

    // Trigger actualizaciones de precio automáticas
    if (req.body.updatePrices) {
      const priceUpdates = results.success
        .filter((result) => result.newPvpm !== result.oldPvpm)
        .map((result) => ({
          productId: result.productId,
          newPrice: result.newPvpm,
          reason: 'pvpm_recalculation',
          userId: req.user._id.toString(),
        }));

      if (priceUpdates.length > 0) {
        await priceUpdater.bulkUpdatePrices(priceUpdates);
      }
    }

    res.json({
      message: 'Recálculo de PVPM completado',
      results: {
        total: products.length,
        successful: results.success.length,
        errors: results.errors.length,
        priceUpdatesQueued: req.body.updatePrices
          ? results.success.filter((r) => r.newPvpm !== r.oldPvpm).length
          : 0,
      },
      details: results,
    });
  } catch (error) {
    logger.error('Error recalculating bulk PVPM:', error);
    res.status(500).json({
      message: 'Error recalculando PVPM',
      error: error.message,
    });
  }
};

/**
 * @desc    Actualizar precio de un producto
 * @route   PUT /api/pricing/update-price/:id
 * @access  Private
 */
const updateProductPrice = async (req, res) => {
  try {
    const { newPrice, reason = 'manual' } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    const result = await priceUpdater.updateProductPrice(
      product,
      newPrice,
      reason,
      req.user._id.toString()
    );

    res.json({
      message: 'Precio actualizado correctamente',
      productSku: product.erp_sku,
      ...result,
    });
  } catch (error) {
    logger.error('Error updating product price:', error);
    res.status(500).json({
      message: 'Error actualizando precio',
      error: error.message,
    });
  }
};

/**
 * @desc    Obtener historial de cambios de precio
 * @route   GET /api/pricing/price-history
 * @access  Private
 */
const getPriceHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20, productId, dateFrom, dateTo, reason } = req.query;

    const pipeline = [
      { $unwind: '$pricing.priceHistory' },
      {
        $match: {
          ...(productId && { erp_sku: productId }),
          ...(dateFrom && { 'pricing.priceHistory.changedAt': { $gte: new Date(dateFrom) } }),
          ...(dateTo && { 'pricing.priceHistory.changedAt': { $lte: new Date(dateTo) } }),
          ...(reason && { 'pricing.priceHistory.reason': reason }),
        },
      },
      {
        $project: {
          _id: '$_id',
          erp_sku: 1,
          erp_name: 1,
          amz_title: 1,
          change: '$pricing.priceHistory',
        },
      },
      { $sort: { 'change.changedAt': -1 } },
      { $skip: (page - 1) * limit },
      { $limit: parseInt(limit) },
    ];

    const history = await Product.aggregate(pipeline);

    const totalPipeline = [
      { $unwind: '$pricing.priceHistory' },
      {
        $match: {
          ...(productId && { erp_sku: productId }),
          ...(dateFrom && { 'pricing.priceHistory.changedAt': { $gte: new Date(dateFrom) } }),
          ...(dateTo && { 'pricing.priceHistory.changedAt': { $lte: new Date(dateTo) } }),
          ...(reason && { 'pricing.priceHistory.reason': reason }),
        },
      },
      { $count: 'total' },
    ];

    const totalResult = await Product.aggregate(totalPipeline);
    const total = totalResult[0]?.total || 0;

    res.json({
      history,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    logger.error('Error getting price history:', error);
    res.status(500).json({
      message: 'Error obteniendo historial de precios',
      error: error.message,
    });
  }
};

/**
 * @desc    Establecer precio fijo para un producto
 * @route   PUT /api/pricing/set-fixed-price/:id
 * @access  Private
 */
const setFixedPrice = async (req, res) => {
  try {
    const { fixedPrice, reason } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    // Validar precio
    if (fixedPrice !== null && fixedPrice <= 0) {
      return res
        .status(400)
        .json({ message: 'El precio fijo debe ser mayor a 0 o null para remover' });
    }

    // Actualizar precio fijo
    const updateData = {
      'pricing.fixedPrice': fixedPrice,
      'pricing.fixedPriceReason': reason || '',
      'pricing.fixedPriceSetAt': fixedPrice ? new Date() : null,
      'pricing.fixedPriceSetBy': fixedPrice ? req.user._id.toString() : '',
    };

    await Product.findByIdAndUpdate(req.params.id, updateData);

    // Si se estableció precio fijo, actualizar precio en Amazon
    if (fixedPrice) {
      const priceUpdater = require('../services/pricing/priceUpdater');
      await priceUpdater.updateProductPrice(
        await Product.findById(req.params.id), // Recargar producto actualizado
        null, // Precio automático (usará el precio fijo)
        'fixed_price_set',
        req.user._id.toString()
      );
    }

    res.json({
      message: fixedPrice ? `Precio fijo establecido: ${fixedPrice}€` : 'Precio fijo removido',
      productSku: product.erp_sku,
      fixedPrice,
      reason,
    });
  } catch (error) {
    logger.error('Error setting fixed price:', error);
    res.status(500).json({
      message: 'Error estableciendo precio fijo',
      error: error.message,
    });
  }
};

/**
 * @desc    Obtener acciones pendientes
 * @route   GET /api/pricing/pending-actions
 * @access  Private
 */
const getPendingActions = async (req, res) => {
  try {
    // Productos sin peso (necesitan actualización en ERP)
    const productsWithoutWeight = await Product.countDocuments({
      $or: [{ erp_weight: { $exists: false } }, { erp_weight: 0 }, { erp_weight: null }],
    });

    // Productos con PVPM desactualizado
    const outdatedPVPM = await Product.countDocuments({
      $or: [
        { 'pricing.pvpm': { $exists: false } },
        { 'pricing.pvpm': 0 },
        { 'pricing.pvpm': null },
        // Usar $expr para comparar campos entre sí
        {
          $expr: {
            $and: [
              { $ne: ['$pricing.lastPriceUpdate', null] },
              { $ne: ['$updatedAt', null] },
              { $gt: ['$updatedAt', '$pricing.lastPriceUpdate'] },
            ],
          },
        },
      ],
    });

    // Productos con precios por debajo del PVPM
    const belowPVPM = await Product.countDocuments({
      $expr: {
        $and: [
          { $gt: ['$pricing.pvpm', 0] },
          { $gt: ['$amz_price', 0] },
          { $lt: ['$amz_price', '$pricing.pvpm'] },
        ],
      },
    });

    // Amazon más caro que WEB (4%)
    const amazonCheaperThanWeb = await Product.countDocuments({
      $expr: {
        $and: [
          { $gt: ['$erp_price', 0] },
          { $gt: ['$amz_price', 0] },
          { $lt: ['$amz_price', { $multiply: ['$erp_price', 1.04] }] },
        ],
      },
    });

    // Productos con errores de sincronización
    const syncErrors = await Product.countDocuments({
      amz_syncStatus: 'error',
    });

    // Productos sin coste definido - NUEVO
    const withoutCost = await Product.countDocuments({
      $or: [{ erp_cost: { $exists: false } }, { erp_cost: 0 }, { erp_cost: null }],
    });

    // Productos con precio de Amazon = 0 - NUEVO
    const withoutPrice = await Product.countDocuments({
      $or: [{ amz_price: { $exists: false } }, { amz_price: 0 }, { amz_price: null }],
    });

    const withFixedPrice = await Product.countDocuments({
      'pricing.fixedPrice': { $gt: 0 },
    });

    res.json({
      pendingActions: {
        productsWithoutWeight: {
          count: productsWithoutWeight,
          description: 'Productos sin peso definido en ERP',
          priority: 'low',
          action: 'update_weight',
        },
        productsWithoutCost: {
          count: withoutCost,
          description: 'Productos sin coste definido',
          priority: 'high',
          action: 'update_cost',
        },
        productsWithoutPrice: {
          count: withoutPrice,
          description: 'Productos sin precio en Amazon',
          priority: 'high',
          action: 'update_price',
        },
        outdatedPVPM: {
          count: outdatedPVPM,
          description: 'Productos con PVPM desactualizado',
          priority: 'medium',
          action: 'recalculate_pvpm',
        },
        belowPVPM: {
          count: belowPVPM,
          description: 'Productos con precio por debajo del PVPM',
          priority: 'high',
          action: 'update_price',
        },
        syncErrors: {
          count: syncErrors,
          description: 'Productos con errores de sincronización',
          priority: 'high',
          action: 'fix_sync',
        },
        amazonCheaperThanWeb: {
          count: amazonCheaperThanWeb,
          description: 'Amazon más barato que WEB (debe ser 4% más caro)',
          priority: 'medium',
          action: 'adjust_web_amazon_price',
        },
        withFixedPrice: {
          count: withFixedPrice,
          description: 'Productos con precio fijo activo (informativo)',
          priority: 'info',
          action: 'review_fixed_prices',
        },
      },
      totalActions:
        productsWithoutWeight + withoutCost + withoutPrice + outdatedPVPM + belowPVPM + syncErrors,
    });
  } catch (error) {
    logger.error('Error getting pending actions:', error);
    res.status(500).json({
      message: 'Error obteniendo acciones pendientes',
      error: error.message,
    });
  }
};

/**
 * @desc    Obtener productos específicos para una acción pendiente
 * @route   GET /api/pricing/pending-actions/:actionType
 * @access  Private
 */
const getPendingActionProducts = async (req, res) => {
  try {
    const { actionType } = req.params;
    const { page = 1, limit = 20 } = req.query;

    let query = {};
    let title = '';

    switch (actionType) {
      case 'update_weight':
        query = {
          $or: [{ erp_weight: { $exists: false } }, { erp_weight: 0 }, { erp_weight: null }],
        };
        title = 'Productos sin peso definido';
        break;

      case 'update_cost':
        query = {
          $or: [{ erp_cost: { $exists: false } }, { erp_cost: 0 }, { erp_cost: null }],
        };
        title = 'Productos sin coste definido';
        break;

      case 'update_price':
        query = {
          $or: [{ amz_price: { $exists: false } }, { amz_price: 0 }, { amz_price: null }],
        };
        title = 'Productos sin precio en Amazon';
        break;

      case 'recalculate_pvpm':
        query = {
          $or: [
            { 'pricing.pvpm': { $exists: false } },
            { 'pricing.pvpm': 0 },
            { 'pricing.pvpm': null },
            {
              $expr: {
                $and: [
                  { $ne: ['$pricing.lastPriceUpdate', null] },
                  { $ne: ['$updatedAt', null] },
                  { $gt: ['$updatedAt', '$pricing.lastPriceUpdate'] },
                ],
              },
            },
          ],
        };
        title = 'Productos con PVPM desactualizado';
        break;

      case 'below_pvpm':
        query = {
          $expr: {
            $and: [
              { $gt: ['$pricing.pvpm', 0] },
              { $gt: ['$amz_price', 0] },
              { $lt: ['$amz_price', '$pricing.pvpm'] },
            ],
          },
        };
        title = 'Productos por debajo del PVPM';
        break;

      case 'fix_sync':
        query = { amz_syncStatus: 'error' };
        title = 'Productos con errores de sincronización';
        break;

      case 'adjust_web_amazon_price':
        query = {
          $expr: {
            $and: [
              { $gt: ['$erp_price', 0] },
              { $gt: ['$amz_price', 0] },
              { $lt: ['$amz_price', { $multiply: ['$erp_price', 1.04] }] },
            ],
          },
        };
        title = 'Amazon más barato que WEB (debe ser 4% más caro)';
        break;
      case 'review_fixed_prices':
        query = { 'pricing.fixedPrice': { $gt: 0 } };
        title = 'Productos con precio fijo activo';
        break;

      default:
        return res.status(400).json({
          message: 'Tipo de acción no válido',
        });
    }

    const products = await Product.find(query)
      .select(
        'erp_sku erp_name erp_manufacturer amz_title amz_price erp_cost erp_weight pricing amz_syncStatus'
      )
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ updatedAt: -1 });

    const total = await Product.countDocuments(query);

    const processedProducts = products.map((product) => ({
      _id: product._id,
      erp_sku: product.erp_sku,
      erp_name: product.erp_name,
      erp_manufacturer: product.erp_manufacturer,
      amz_title: product.amz_title,
      amz_price: product.amz_price,
      erp_cost: product.erp_cost,
      erp_weight: product.erp_weight,
      pvpm: product.pricing?.pvpm || 0,
      syncStatus: product.amz_syncStatus,
      issue: getProductIssueDescription(product, actionType),
    }));

    res.json({
      title,
      products: processedProducts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    logger.error('Error getting pending action products:', error);
    res.status(500).json({
      message: 'Error obteniendo productos de la acción',
      error: error.message,
    });
  }
};

// Función auxiliar para describir el problema del producto
function getProductIssueDescription(product, actionType) {
  switch (actionType) {
    case 'update_weight':
      return `Sin peso definido (${product.erp_weight || 0} kg)`;
    case 'update_cost':
      return `Sin coste definido (${product.erp_cost || 0}€)`;
    case 'update_price':
      return `Sin precio en Amazon (${product.amz_price || 0}€)`;
    case 'recalculate_pvpm':
      return `PVPM desactualizado (${product.pricing?.pvpm || 0}€)`;
    case 'below_pvpm':
      return `Precio (${product.amz_price}€) < PVPM (${product.pricing?.pvpm}€)`;
    case 'fix_sync':
      return `Error de sincronización: ${product.amz_syncStatus}`;
    case 'adjust_web_amazon_price':
      const webPrice = product.erp_price || 0;
      const amazonPrice = product.amz_price || 0;
      const requiredPrice = webPrice * 1.04;
      return `Amazon (${amazonPrice}€) debe ser 4% > WEB (${webPrice}€). Mínimo: ${requiredPrice.toFixed(2)}€`;

    case 'review_fixed_prices':
      return `Precio fijo: ${product.pricing?.fixedPrice}€ (${product.pricing?.fixedPriceReason || 'Sin razón'})`;
    default:
      return 'Problema no especificado';
  }
}

/**
 * @desc    Actualizar campos auxiliares de un producto
 * @route   PUT /api/pricing/product-settings/:id
 * @access  Private
 */
const updateProductPricingSettings = async (req, res) => {
  try {
    const { customCost, customMargin, customShippingCost, autoUpdateEnabled } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    const updateData = {};

    if (customCost !== undefined) updateData['pricing.customCost'] = customCost || null;
    if (customMargin !== undefined) updateData['pricing.customMargin'] = customMargin || null;
    if (customShippingCost !== undefined)
      updateData['pricing.customShippingCost'] = customShippingCost || null;
    if (autoUpdateEnabled !== undefined)
      updateData['pricing.autoUpdateEnabled'] = autoUpdateEnabled;

    await Product.findByIdAndUpdate(req.params.id, updateData);

    // Recalcular PVPM si se modificaron campos que lo afectan
    if (
      customCost !== undefined ||
      customMargin !== undefined ||
      customShippingCost !== undefined
    ) {
      const updatedProduct = await Product.findById(req.params.id);
      const pvpmResult = await pvpmCalculator.calculatePVPM(updatedProduct);

      await Product.findByIdAndUpdate(req.params.id, {
        'pricing.pvpm': pvpmResult.pvpm,
      });

      return res.json({
        message: 'Configuración actualizada y PVPM recalculado',
        productSku: product.erp_sku,
        newPvpm: pvpmResult.pvpm,
        breakdown: pvpmResult.breakdown,
      });
    }

    res.json({
      message: 'Configuración actualizada correctamente',
      productSku: product.erp_sku,
    });
  } catch (error) {
    logger.error('Error updating product pricing settings:', error);
    res.status(500).json({
      message: 'Error actualizando configuración del producto',
      error: error.message,
    });
  }
};

/**
 * @desc    Obtener estadísticas del historial de precios
 * @route   GET /api/pricing/price-history/stats
 * @access  Private
 */
const getPriceHistoryStats = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;

    // Construir filtro de fechas
    let dateFilter = {};
    if (dateFrom || dateTo) {
      dateFilter['pricing.priceHistory.changedAt'] = {};
      if (dateFrom) dateFilter['pricing.priceHistory.changedAt'].$gte = new Date(dateFrom);
      if (dateTo) dateFilter['pricing.priceHistory.changedAt'].$lte = new Date(dateTo);
    }

    // Pipeline de agregación para estadísticas
    const pipeline = [
      { $unwind: '$pricing.priceHistory' },
      ...(Object.keys(dateFilter).length > 0 ? [{ $match: dateFilter }] : []),
      {
        $group: {
          _id: null,
          totalChanges: { $sum: 1 },
          avgPriceChange: {
            $avg: {
              $subtract: ['$pricing.priceHistory.newPrice', '$pricing.priceHistory.previousPrice'],
            },
          },
          maxPriceChange: {
            $max: {
              $subtract: ['$pricing.priceHistory.newPrice', '$pricing.priceHistory.previousPrice'],
            },
          },
          minPriceChange: {
            $min: {
              $subtract: ['$pricing.priceHistory.newPrice', '$pricing.priceHistory.previousPrice'],
            },
          },
          lastUpdate: { $max: '$pricing.priceHistory.changedAt' },
          reasonCounts: {
            $push: '$pricing.priceHistory.reason',
          },
        },
      },
    ];

    const [stats] = await Product.aggregate(pipeline);

    if (!stats) {
      return res.json({
        totalChanges: 0,
        thisMonth: 0,
        thisWeek: 0,
        avgChangePercentage: 0,
        avgPriceChange: 0,
        maxPriceChange: 0,
        minPriceChange: 0,
        lastUpdate: null,
        reasonBreakdown: {},
      });
    }

    // Calcular cambios del mes actual
    const thisMonthStart = new Date();
    thisMonthStart.setDate(1);
    thisMonthStart.setHours(0, 0, 0, 0);

    const thisMonthChanges = await Product.aggregate([
      { $unwind: '$pricing.priceHistory' },
      {
        $match: {
          'pricing.priceHistory.changedAt': { $gte: thisMonthStart },
        },
      },
      { $count: 'thisMonth' },
    ]);

    // Calcular cambios de esta semana
    const thisWeekStart = new Date();
    thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);

    const thisWeekChanges = await Product.aggregate([
      { $unwind: '$pricing.priceHistory' },
      {
        $match: {
          'pricing.priceHistory.changedAt': { $gte: thisWeekStart },
        },
      },
      { $count: 'thisWeek' },
    ]);

    // Contar razones
    const reasonBreakdown = {};
    stats.reasonCounts.forEach((reason) => {
      reasonBreakdown[reason] = (reasonBreakdown[reason] || 0) + 1;
    });

    // Calcular porcentaje promedio de cambio
    const avgChangePercentage = stats.avgPriceChange
      ? Math.abs((stats.avgPriceChange / 10) * 100) // Estimación basada en precio promedio
      : 0;

    res.json({
      totalChanges: stats.totalChanges,
      thisMonth: thisMonthChanges[0]?.thisMonth || 0,
      thisWeek: thisWeekChanges[0]?.thisWeek || 0,
      avgChangePercentage: Number(avgChangePercentage.toFixed(2)),
      avgPriceChange: Number(stats.avgPriceChange?.toFixed(2) || 0),
      maxPriceChange: Number(stats.maxPriceChange?.toFixed(2) || 0),
      minPriceChange: Number(stats.minPriceChange?.toFixed(2) || 0),
      lastUpdate: stats.lastUpdate,
      reasonBreakdown,
    });
  } catch (error) {
    logger.error('Error getting price history stats:', error);
    res.status(500).json({
      message: 'Error obteniendo estadísticas del historial',
      error: error.message,
    });
  }
};

/**
 * @desc    Obtener estadísticas generales de pricing
 * @route   GET /api/pricing/stats
 * @access  Private
 */
const getPricingStats = async (req, res) => {
  try {
    // Productos con pricing configurado
    const withPricing = await Product.countDocuments({
      'pricing.pvpm': { $gt: 0 },
    });

    // Productos con precios automáticos habilitados
    const autoUpdateEnabled = await Product.countDocuments({
      'pricing.autoUpdateEnabled': true,
    });

    // Productos con campos personalizados
    const withCustomCost = await Product.countDocuments({
      'pricing.customCost': { $gt: 0 },
    });

    const withCustomMargin = await Product.countDocuments({
      'pricing.customMargin': { $gt: 0 },
    });

    const withCustomShipping = await Product.countDocuments({
      'pricing.customShippingCost': { $gt: 0 },
    });

    // Promedio de PVPM
    const avgPvpmResult = await Product.aggregate([
      {
        $match: {
          'pricing.pvpm': { $gt: 0 },
        },
      },
      {
        $group: {
          _id: null,
          avgPvpm: { $avg: '$pricing.pvpm' },
          minPvpm: { $min: '$pricing.pvpm' },
          maxPvpm: { $max: '$pricing.pvpm' },
        },
      },
    ]);

    const avgPvpm = avgPvpmResult[0] || { avgPvpm: 0, minPvpm: 0, maxPvpm: 0 };

    // Productos por debajo del PVPM
    const belowPvpmCount = await Product.countDocuments({
      $expr: {
        $and: [
          { $gt: ['$pricing.pvpm', 0] },
          { $gt: ['$amz_price', 0] },
          { $lt: ['$amz_price', '$pricing.pvpm'] },
        ],
      },
    });

    // Última actualización de precios
    const lastPriceUpdate = await Product.findOne({
      'pricing.lastPriceUpdate': { $exists: true },
    })
      .sort({ 'pricing.lastPriceUpdate': -1 })
      .select('pricing.lastPriceUpdate');

    res.json({
      totalProducts: await Product.countDocuments(),
      withPricing,
      autoUpdateEnabled,
      customFields: {
        withCustomCost,
        withCustomMargin,
        withCustomShipping,
      },
      pvpmStats: {
        average: Number(avgPvpm.avgPvpm?.toFixed(2) || 0),
        minimum: Number(avgPvpm.minPvpm?.toFixed(2) || 0),
        maximum: Number(avgPvpm.maxPvpm?.toFixed(2) || 0),
      },
      belowPvpmCount,
      lastPriceUpdate: lastPriceUpdate?.pricing?.lastPriceUpdate || null,
    });
  } catch (error) {
    logger.error('Error getting pricing stats:', error);
    res.status(500).json({
      message: 'Error obteniendo estadísticas de pricing',
      error: error.message,
    });
  }
};

/**
 * @desc    Obtener productos con mayor actividad de pricing
 * @route   GET /api/pricing/top-activity
 * @access  Private
 */
const getTopActivityProducts = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const pipeline = [
      {
        $match: {
          'pricing.priceHistory': { $exists: true, $not: { $size: 0 } },
        },
      },
      {
        $project: {
          erp_sku: 1,
          erp_name: 1,
          amz_title: 1,
          amz_price: 1,
          'pricing.pvpm': 1,
          priceChangeCount: { $size: '$pricing.priceHistory' },
          lastPriceChange: {
            $arrayElemAt: ['$pricing.priceHistory', -1],
          },
        },
      },
      { $sort: { priceChangeCount: -1 } },
      { $limit: parseInt(limit) },
    ];

    const topProducts = await Product.aggregate(pipeline);

    res.json({
      topProducts: topProducts.map((product) => ({
        _id: product._id,
        sku: product.erp_sku,
        name: product.erp_name || product.amz_title,
        currentPrice: product.amz_price,
        pvpm: product.pricing?.pvpm,
        changeCount: product.priceChangeCount,
        lastChange: product.lastPriceChange,
      })),
    });
  } catch (error) {
    logger.error('Error getting top activity products:', error);
    res.status(500).json({
      message: 'Error obteniendo productos con mayor actividad',
      error: error.message,
    });
  }
};

/**
 * @desc    Obtener tendencias de precios por período
 * @route   GET /api/pricing/trends
 * @access  Private
 */
const getPricingTrends = async (req, res) => {
  try {
    const { period = 'week' } = req.query; // week, month, quarter

    let groupBy;
    let startDate = new Date();

    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        groupBy = {
          year: { $year: '$pricing.priceHistory.changedAt' },
          month: { $month: '$pricing.priceHistory.changedAt' },
          day: { $dayOfMonth: '$pricing.priceHistory.changedAt' },
        };
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        groupBy = {
          year: { $year: '$pricing.priceHistory.changedAt' },
          month: { $month: '$pricing.priceHistory.changedAt' },
          day: { $dayOfMonth: '$pricing.priceHistory.changedAt' },
        };
        break;
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3);
        groupBy = {
          year: { $year: '$pricing.priceHistory.changedAt' },
          week: { $week: '$pricing.priceHistory.changedAt' },
        };
        break;
    }

    const pipeline = [
      { $unwind: '$pricing.priceHistory' },
      {
        $match: {
          'pricing.priceHistory.changedAt': { $gte: startDate },
        },
      },
      {
        $group: {
          _id: groupBy,
          totalChanges: { $sum: 1 },
          avgPriceChange: {
            $avg: {
              $subtract: ['$pricing.priceHistory.newPrice', '$pricing.priceHistory.previousPrice'],
            },
          },
          date: { $first: '$pricing.priceHistory.changedAt' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ];

    const trends = await Product.aggregate(pipeline);

    res.json({
      period,
      trends: trends.map((trend) => ({
        date: trend.date,
        totalChanges: trend.totalChanges,
        avgPriceChange: Number(trend.avgPriceChange?.toFixed(2) || 0),
        period: trend._id,
      })),
    });
  } catch (error) {
    logger.error('Error getting pricing trends:', error);
    res.status(500).json({
      message: 'Error obteniendo tendencias de precios',
      error: error.message,
    });
  }
};

// Función auxiliar para trigger de recálculo masivo
async function triggerPVPMRecalculation() {
  try {
    const products = await Product.find({}).select('_id');
    const results = await pvpmCalculator.recalculateBulkPVPM(products);

    const bulkUpdates = results.success.map((result) => ({
      updateOne: {
        filter: { _id: result.productId },
        update: { 'pricing.pvpm': result.newPvpm },
      },
    }));

    if (bulkUpdates.length > 0) {
      await Product.bulkWrite(bulkUpdates);
    }

    return results.success.length;
  } catch (error) {
    logger.error('Error in bulk PVPM recalculation:', error);
    return 0;
  }
}

// Función auxiliar para construir query de productos
function buildProductQuery(filters) {
  const query = {};

  if (filters.brand)
    query.$or = [{ erp_manufacturer: filters.brand }, { amz_brand: filters.brand }];
  if (filters.status) query.amz_status = filters.status;
  if (filters.withoutWeight) {
    query.$or = [{ erp_weight: { $exists: false } }, { erp_weight: 0 }, { erp_weight: null }];
  }

  return query;
}

module.exports = {
  getPricingConfig,
  updatePricingConfig,
  calculateProductPVPM,
  recalculateBulkPVPM,
  updateProductPrice,
  setFixedPrice,
  getPriceHistory,
  getPriceHistoryStats,
  getPricingStats,
  getTopActivityProducts,
  getPricingTrends,
  getPendingActions,
  getPendingActionProducts,
  updateProductPricingSettings,
};
