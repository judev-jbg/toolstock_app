const pricingEngine = require('../services/pricing/pricingEngine');
const notificationHandler = require('../services/amazon/notificationHandler');
const Product = require('../models/productModel');
const logger = require('../utils/logger').createLogger('pricingEngineController');

/**
 * @desc    Procesar pricing para un producto específico
 * @route   POST /api/pricing-engine/process/:productId
 * @access  Private
 */
const processProduct = async (req, res) => {
  try {
    const { trigger = 'manual', forceUpdate = false, urgency = 'normal' } = req.body;

    const product = await Product.findById(req.params.productId);
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    const context = {
      trigger,
      source: 'user',
      forceUpdate,
      urgency,
      changedBy: req.user?.name || req.user?.email || 'manual',
    };

    const result = await pricingEngine.processProduct(product, context);

    res.json({
      message: `Pricing procesado para producto ${product.erp_sku}`,
      result: {
        success: result.success,
        previousPrice:
          result.decision?.metadata?.competitorData?.previousCompetitorPrice || product.amz_price,
        newPrice: result.decision?.finalPrice,
        strategy: result.decision?.strategy,
        reasoning: result.decision?.reasoning,
        confidence: result.decision?.confidence,
        validation: result.validation,
        execution: result.execution,
      },
    });
  } catch (error) {
    logger.error('Error processing product pricing:', error);
    res.status(500).json({
      message: 'Error procesando pricing',
      error: error.message,
    });
  }
};

/**
 * @desc    Procesar pricing en lote
 * @route   POST /api/pricing-engine/process-batch
 * @access  Private/Admin
 */
const processBatch = async (req, res) => {
  try {
    const { productIds, trigger = 'bulk_operation', filters } = req.body;

    let targetProductIds = productIds;

    // Si no se proporcionan IDs específicos, usar filtros
    if (!productIds && filters) {
      const query = {};

      if (filters.pricingStatus) {
        query['pricing.pricingStatus'] = filters.pricingStatus;
      }

      if (filters.hasCompetitorData) {
        query['pricing.competitorPrice'] = { $ne: null };
      }

      if (filters.needsPriceUpdate) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        query['pricing.lastPriceUpdate'] = { $lt: oneHourAgo };
      }

      const products = await Product.find(query).select('_id').limit(1000);
      targetProductIds = products.map((p) => p._id);
    }

    if (!targetProductIds || targetProductIds.length === 0) {
      return res.status(400).json({
        message: 'No se especificaron productos para procesar',
      });
    }

    const context = {
      trigger,
      source: 'user',
      changedBy: req.user?.name || req.user?.email || 'bulk_operation',
    };

    // Ejecutar en segundo plano para respuesta rápida
    setImmediate(async () => {
      try {
        await pricingEngine.processBatch(targetProductIds, context);
      } catch (error) {
        logger.error('Error in background batch processing:', error);
      }
    });

    res.json({
      message: `Procesamiento en lote iniciado para ${targetProductIds.length} productos`,
      batchInfo: {
        productCount: targetProductIds.length,
        trigger: trigger,
        estimatedTime: `${Math.ceil(targetProductIds.length / 10)} minutos`,
      },
    });
  } catch (error) {
    logger.error('Error starting batch pricing process:', error);
    res.status(500).json({
      message: 'Error iniciando procesamiento en lote',
      error: error.message,
    });
  }
};

/**
 * @desc    Simular decisión de pricing sin aplicar
 * @route   POST /api/pricing-engine/simulate/:productId
 * @access  Private
 */
const simulateProduct = async (req, res) => {
  try {
    const { trigger = 'simulation', competitorPrice, fixedPrice } = req.body;

    const product = await Product.findById(req.params.productId);
    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    // Crear copia del producto para simulación
    const simulatedProduct = { ...product.toObject() };

    // Aplicar datos de simulación
    if (competitorPrice !== undefined) {
      simulatedProduct.pricing = simulatedProduct.pricing || {};
      simulatedProduct.pricing.competitorPrice = competitorPrice;
    }

    if (fixedPrice !== undefined) {
      simulatedProduct.pricing = simulatedProduct.pricing || {};
      simulatedProduct.pricing.fixedPrice = fixedPrice;
    }

    const context = {
      trigger,
      source: 'simulation',
      forceUpdate: false,
      simulation: true,
    };

    // Preparar contexto sin ejecutar
    const decisionContext = await pricingEngine.prepareDecisionContext(simulatedProduct, context);
    const decision = await pricingEngine.applyPricingStrategy(simulatedProduct, decisionContext);
    const validation = await pricingEngine.validatePricingDecision(
      simulatedProduct,
      decision,
      decisionContext
    );

    res.json({
      message: 'Simulación de pricing completada',
      simulation: {
        currentPrice: product.amz_price || 0,
        simulatedPrice: decision.finalPrice,
        priceChange: decision.finalPrice - (product.amz_price || 0),
        strategy: decision.strategy,
        reasoning: decision.reasoning,
        confidence: decision.confidence,
        wouldExecute: validation.isValid && !validation.blocked,
        validation: validation,
        recommendations: decision.recommendations,
      },
      inputs: {
        competitorPrice: competitorPrice || simulatedProduct.pricing?.competitorPrice,
        fixedPrice: fixedPrice || simulatedProduct.pricing?.fixedPrice,
        pvpm: simulatedProduct.pricing?.pvpm || 0,
      },
    });
  } catch (error) {
    logger.error('Error simulating product pricing:', error);
    res.status(500).json({
      message: 'Error en simulación de pricing',
      error: error.message,
    });
  }
};

/**
 * @desc    Procesar notificación de Amazon
 * @route   POST /api/pricing-engine/notification
 * @access  Private (webhook)
 */
const processNotification = async (req, res) => {
  try {
    const notification = req.body;

    logger.info('Received Amazon notification:', {
      type: notification.notificationType,
      eventTime: notification.eventTime,
    });

    let result = null;

    switch (notification.notificationType) {
      case 'ANY_OFFER_CHANGED':
        result = await notificationHandler.handleOfferChanged(notification);
        break;
      case 'PRICING_HEALTH':
        result = await notificationHandler.handlePricingHealth(notification);
        break;
      default:
        logger.warn(`Unhandled notification type: ${notification.notificationType}`);
        return res.status(200).json({
          message: 'Notification received but not processed',
          type: notification.notificationType,
        });
    }

    res.status(200).json({
      message: 'Notification processed successfully',
      type: notification.notificationType,
      result: result
        ? {
            success: result.success,
            strategy: result.decision?.strategy,
            priceChanged: result.decision?.finalPrice !== result.product?.amz_price,
          }
        : null,
    });
  } catch (error) {
    logger.error('Error processing notification:', error);
    res.status(500).json({
      message: 'Error processing notification',
      error: error.message,
    });
  }
};

/**
 * @desc    Obtener estado del motor de pricing
 * @route   GET /api/pricing-engine/status
 * @access  Private
 */
const getEngineStatus = async (req, res) => {
  try {
    // Estadísticas de productos por estado de pricing
    const statusStats = await Product.aggregate([
      { $match: { erp_sku: { $exists: true, $ne: '' } } },
      {
        $group: {
          _id: '$pricing.pricingStatus',
          count: { $sum: 1 },
        },
      },
    ]);

    // Productos que necesitan procesamiento
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const needsProcessing = await Product.countDocuments({
      $or: [
        { 'pricing.lastPriceUpdate': { $lt: oneHourAgo } },
        { 'pricing.pricingStatus': { $in: ['competitor_alert', 'manual_review'] } },
        { 'pricing.competitorPriceUpdatedAt': { $gt: oneHourAgo } },
      ],
    });

    // Productos con datos de competencia
    const withCompetitorData = await Product.countDocuments({
      'pricing.competitorPrice': { $ne: null },
    });

    // Productos con precios fijos
    const withFixedPrices = await Product.countDocuments({
      'pricing.fixedPrice': { $ne: null },
    });

    res.json({
      status: 'operational',
      timestamp: new Date(),
      statistics: {
        totalProducts: await Product.countDocuments({ erp_sku: { $exists: true, $ne: '' } }),
        needsProcessing,
        withCompetitorData,
        withFixedPrices,
        byStatus: statusStats.reduce((acc, stat) => {
          acc[stat._id || 'unknown'] = stat.count;
          return acc;
        }, {}),
      },
      lastProcessed: {
        // Esta información vendría de un sistema de jobs/cron
        lastBatchRun: null,
        lastNotificationProcessed: null,
      },
    });
  } catch (error) {
    logger.error('Error getting engine status:', error);
    res.status(500).json({
      message: 'Error obteniendo estado del motor',
      error: error.message,
    });
  }
};

module.exports = {
  processProduct,
  processBatch,
  simulateProduct,
  processNotification,
  getEngineStatus,
};
