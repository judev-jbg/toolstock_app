// backend/src/controllers/pricingController.js - NUEVO ARCHIVO
const PricingConfig = require('../models/pricingConfigModel');
const pvpmCalculator = require('../services/pricing/pvpmCalculator');
const Product = require('../models/productModel');
const logger = require('../utils/logger');

/**
 * @desc    Obtener configuración global de pricing
 * @route   GET /api/pricing/config
 * @access  Private/Admin
 */
const getPricingConfig = async (req, res) => {
  try {
    const config = await PricingConfig.getInstance();

    // Agregar estadísticas útiles
    const stats = {
      totalProducts: await Product.countDocuments({ erp_sku: { $exists: true, $ne: '' } }),
      productsWithCustomCost: await Product.countDocuments({ 'pricing.customCost': { $ne: null } }),
      productsWithCustomMargin: await Product.countDocuments({
        'pricing.customMargin': { $ne: null },
      }),
      productsWithFixedPrice: await Product.countDocuments({ 'pricing.fixedPrice': { $ne: null } }),
      productsWithPVPM: await Product.countDocuments({ 'pricing.pvpm': { $gt: 0 } }),
    };

    res.json({
      config,
      stats,
      operatingHours: {
        isWithinHours: config.isWithinOperatingHours(),
        currentTime: new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }),
      },
    });
  } catch (error) {
    logger.error('Error getting pricing config:', error);
    res.status(500).json({
      message: 'Error obteniendo configuración de pricing',
      error: error.message,
    });
  }
};

/**
 * @desc    Actualizar configuración global de pricing
 * @route   PUT /api/pricing/config
 * @access  Private/Admin
 */
// backend/src/controllers/pricingController.js - ACTUALIZAR la función updatePricingConfig

const updatePricingConfig = async (req, res) => {
  try {
    const config = await PricingConfig.getInstance();

    // Campos permitidos para actualización
    const allowedFields = [
      'defaultMargin',
      'defaultIva',
      'defaultShippingCost',
      'shippingCostTable',
      'competitorSettings',
      'alertSettings',
      'automationSettings',
    ];

    // Validar y actualizar solo campos permitidos
    let hasChanges = false;
    const changedFields = [];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        // Hacer deep comparison para objetos anidados
        if (JSON.stringify(config[field]) !== JSON.stringify(req.body[field])) {
          config[field] = req.body[field];
          hasChanges = true;
          changedFields.push(field);
          logger.info(`Updated config field: ${field}`);
        }
      }
    });

    if (!hasChanges) {
      return res.json({
        message: 'No se detectaron cambios en la configuración',
        config,
      });
    }

    // Actualizar metadatos
    config.lastUpdatedBy = req.user?.name || req.user?.email || 'unknown';
    await config.save();

    logger.info(`Pricing config updated by ${config.lastUpdatedBy}`, { changedFields });

    // Determinar si necesita recálculo PVPM
    const pvpmRelevantFields = [
      'defaultMargin',
      'defaultIva',
      'defaultShippingCost',
      'shippingCostTable',
    ];
    const shouldRecalculatePVPM = pvpmRelevantFields.some((field) => changedFields.includes(field));

    let recalculationResult = null;
    if (shouldRecalculatePVPM) {
      logger.info('Triggering PVPM recalculation due to config changes...');
      try {
        // Recálculo asíncrono para no bloquear respuesta
        setImmediate(async () => {
          try {
            const result = await pvpmCalculator.recalculateAllPVPM({
              changedBy: config.lastUpdatedBy,
              trigger: 'config_change',
              configFields: changedFields,
            });
            logger.info('Config-triggered PVPM recalculation completed:', result);
          } catch (error) {
            logger.error('Error in config-triggered PVPM recalculation:', error);
          }
        });

        recalculationResult = {
          triggered: true,
          message: 'Recálculo de PVPM iniciado en segundo plano',
        };
      } catch (error) {
        logger.error('Error triggering PVPM recalculation:', error);
        recalculationResult = {
          triggered: false,
          error: error.message,
        };
      }
    }

    res.json({
      message: 'Configuración actualizada correctamente',
      config,
      changedFields,
      pvpmRecalculation: recalculationResult,
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
 * @desc    Obtener configuración de envíos con cálculo de ejemplo
 * @route   GET /api/pricing/shipping-calculator
 * @access  Private
 */
const getShippingCalculator = async (req, res) => {
  try {
    const config = await PricingConfig.getInstance();
    const { weight } = req.query;

    let calculatedCost = null;
    if (weight && !isNaN(parseFloat(weight))) {
      calculatedCost = config.calculateShippingCostByWeight(parseFloat(weight));
    }

    res.json({
      shippingTable: config.shippingCostTable.sort((a, b) => a.maxWeight - b.maxWeight),
      defaultShippingCost: config.defaultShippingCost,
      calculatedCost,
      weight: weight ? parseFloat(weight) : null,
      formula: 'Para peso > 20kg: 9.25€ + (peso - 20) * 0.47€',
    });
  } catch (error) {
    logger.error('Error getting shipping calculator:', error);
    res.status(500).json({
      message: 'Error obteniendo calculadora de envíos',
      error: error.message,
    });
  }
};

/**
 * @desc    Validar configuración actual
 * @route   GET /api/pricing/config/validate
 * @access  Private/Admin
 */
const validatePricingConfig = async (req, res) => {
  try {
    const config = await PricingConfig.getInstance();
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // Validaciones de configuración
    if (config.defaultMargin <= 0.1 || config.defaultMargin >= 0.9) {
      validation.errors.push('Margen por defecto debe estar entre 10% y 90%');
      validation.isValid = false;
    }

    if (config.defaultIva < 0 || config.defaultIva > 1) {
      validation.errors.push('IVA debe estar entre 0% y 100%');
      validation.isValid = false;
    }

    if (config.shippingCostTable.length === 0) {
      validation.warnings.push('Tabla de costes de envío está vacía');
    }

    // Validar tabla de envíos ordenada
    const sortedTable = [...config.shippingCostTable].sort((a, b) => a.maxWeight - b.maxWeight);
    if (JSON.stringify(sortedTable) !== JSON.stringify(config.shippingCostTable)) {
      validation.warnings.push('Tabla de costes de envío no está ordenada por peso');
    }

    // Validar email de alertas si está configurado
    if (config.alertSettings.emailAlertsEnabled && !config.alertSettings.alertEmail) {
      validation.warnings.push('Alertas por email habilitadas pero no hay email configurado');
    }

    res.json({
      validation,
      config: {
        defaultMargin: config.defaultMargin,
        defaultIva: config.defaultIva,
        defaultShippingCost: config.defaultShippingCost,
        shippingTableEntries: config.shippingCostTable.length,
        emailAlertsEnabled: config.alertSettings.emailAlertsEnabled,
        autoUpdateEnabled: config.automationSettings.autoUpdateEnabled,
      },
    });
  } catch (error) {
    logger.error('Error validating pricing config:', error);
    res.status(500).json({
      message: 'Error validando configuración',
      error: error.message,
    });
  }
};

/**
 * @desc    Calcular PVPM para un producto específico
 * @route   POST /api/pricing/products/:id/calculate-pvpm
 * @access  Private
 */
const calculateProductPVPM = async (req, res) => {
  try {
    const result = await pvpmCalculator.updateProductPVPM(req.params.id, {
      changedBy: req.user?.name || req.user?.email || 'manual',
      trigger: 'manual_calculation',
    });

    res.json({
      message: 'PVPM calculado correctamente',
      product: {
        _id: result.product._id,
        erp_sku: result.product.erp_sku,
        erp_name: result.product.erp_name,
        pricing: result.product.pricing,
      },
      calculation: {
        pvpm: result.pvpmResult.pvpm,
        breakdown: result.pvpmResult.breakdown,
        sources: result.pvpmResult.sources,
        changed: result.changed,
        previousPvpm: result.previousPvpm,
      },
    });
  } catch (error) {
    logger.error('Error calculating product PVPM:', error);
    res.status(500).json({
      message: 'Error calculando PVPM',
      error: error.message,
    });
  }
};

/**
 * @desc    Recalcular PVPM para todos los productos
 * @route   POST /api/pricing/recalculate-all
 * @access  Private/Admin
 */
const recalculateAllPVPM = async (req, res) => {
  try {
    const results = await pvpmCalculator.recalculateAllPVPM({
      changedBy: req.user?.name || req.user?.email || 'bulk_operation',
      trigger: 'manual_recalculate_all',
    });

    res.json({
      message: 'Recálculo masivo de PVPM completado',
      results: {
        processed: results.processed,
        updated: results.updated,
        errors: results.errors,
        summary: results.summary,
        errorSample: results.errorDetails.slice(0, 5), // Primeros 5 errores
      },
    });
  } catch (error) {
    logger.error('Error in bulk PVPM recalculation:', error);
    res.status(500).json({
      message: 'Error en recálculo masivo de PVPM',
      error: error.message,
    });
  }
};

/**
 * @desc    Actualizar campos auxiliares de pricing para un producto
 * @route   PUT /api/pricing/products/:id/aux-fields
 * @access  Private
 */
const updateProductAuxFields = async (req, res) => {
  try {
    const { customCost, customMargin, customShippingCost } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    // Validaciones
    if (customCost !== undefined && customCost !== null && customCost < 0) {
      return res.status(400).json({ message: 'El coste personalizado debe ser positivo' });
    }

    if (
      customMargin !== undefined &&
      customMargin !== null &&
      (customMargin <= 0.1 || customMargin >= 0.9)
    ) {
      return res.status(400).json({
        message: 'El margen personalizado debe estar entre 0.1 (10%) y 0.9 (90%)',
      });
    }

    if (customShippingCost !== undefined && customShippingCost !== null && customShippingCost < 0) {
      return res.status(400).json({ message: 'El coste de envío personalizado debe ser positivo' });
    }

    // Preparar datos de actualización
    const updateData = {};
    if (customCost !== undefined) updateData['pricing.customCost'] = customCost;
    if (customMargin !== undefined) updateData['pricing.customMargin'] = customMargin;
    if (customShippingCost !== undefined)
      updateData['pricing.customShippingCost'] = customShippingCost;

    // Actualizar producto
    const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    // Recalcular PVPM automáticamente
    const pvpmResult = await pvpmCalculator.updateProductPVPM(req.params.id, {
      changedBy: req.user?.name || req.user?.email || 'aux_fields_update',
      trigger: 'aux_fields_change',
    });

    logger.info(`Auxiliary fields updated for product ${product.erp_sku}:`, {
      customCost,
      customMargin,
      customShippingCost,
      newPvpm: pvpmResult.pvpmResult.pvpm,
    });

    res.json({
      message: 'Campos auxiliares actualizados y PVPM recalculado',
      product: {
        _id: updatedProduct._id,
        erp_sku: updatedProduct.erp_sku,
        erp_name: updatedProduct.erp_name,
        pricing: pvpmResult.product.pricing,
      },
      calculation: {
        pvpm: pvpmResult.pvpmResult.pvpm,
        breakdown: pvpmResult.pvpmResult.breakdown,
        sources: pvpmResult.pvpmResult.sources,
        changed: pvpmResult.changed,
      },
    });
  } catch (error) {
    logger.error('Error updating auxiliary fields:', error);
    res.status(500).json({
      message: 'Error actualizando campos auxiliares',
      error: error.message,
    });
  }
};

/**
 * @desc    Obtener productos que necesitan recálculo de PVPM
 * @route   GET /api/pricing/products/needs-update
 * @access  Private
 */
const getProductsNeedingPVPMUpdate = async (req, res) => {
  try {
    const result = await pvpmCalculator.getProductsNeedingPVPMUpdate();

    res.json({
      message: `${result.count} productos necesitan recálculo de PVPM`,
      ...result,
    });
  } catch (error) {
    logger.error('Error getting products needing PVPM update:', error);
    res.status(500).json({
      message: 'Error obteniendo productos que necesitan actualización',
      error: error.message,
    });
  }
};

/**
 * @desc    Validar datos de un producto para cálculo PVPM
 * @route   GET /api/pricing/products/:id/validate
 * @access  Private
 */
const validateProductPVPM = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    const validation = pvpmCalculator.validateProductForPVPM(product);

    // Calcular valores efectivos para mostrar
    const config = await PricingConfig.getInstance();
    const effectiveValues = {
      cost: pvpmCalculator.getEffectiveCost(product),
      margin: pvpmCalculator.getEffectiveMargin(product, config),
      shippingCost: pvpmCalculator.getEffectiveShippingCost(product, config),
    };

    res.json({
      validation,
      productInfo: {
        erp_sku: product.erp_sku,
        erp_name: product.erp_name,
        erp_cost: product.erp_cost,
        erp_weight: product.erp_weight,
        currentPvpm: product.pricing?.pvpm || 0,
        lastCalculated: product.pricing?.pvpmCalculatedAt,
      },
      effectiveValues,
      pricingStatus: product.pricing?.pricingStatus || 'ok',
    });
  } catch (error) {
    logger.error('Error validating product PVPM:', error);
    res.status(500).json({
      message: 'Error validando producto',
      error: error.message,
    });
  }
};

/**
 * @desc    Obtener breakdown detallado del PVPM sin actualizar
 * @route   GET /api/pricing/products/:id/pvpm-preview
 * @access  Private
 */
const getProductPVPMPreview = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Producto no encontrado' });
    }

    const pvpmResult = await pvpmCalculator.calculatePVPM(product);

    res.json({
      message: 'Preview de cálculo PVPM',
      productInfo: {
        erp_sku: product.erp_sku,
        erp_name: product.erp_name,
      },
      calculation: pvpmResult,
      formula: 'PVPM = ((coste / margen) * (1 + IVA)) + coste_envío',
      wouldChange: Math.abs((product.pricing?.pvpm || 0) - pvpmResult.pvpm) > 0.01,
    });
  } catch (error) {
    logger.error('Error getting PVPM preview:', error);
    res.status(500).json({
      message: 'Error obteniendo preview de PVPM',
      error: error.message,
    });
  }
};

module.exports = {
  getPricingConfig,
  updatePricingConfig,
  getShippingCalculator,
  validatePricingConfig,
  calculateProductPVPM,
  recalculateAllPVPM,
  updateProductAuxFields,
  getProductsNeedingPVPMUpdate,
  validateProductPVPM,
  getProductPVPMPreview,
};
