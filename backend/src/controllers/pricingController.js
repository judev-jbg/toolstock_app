// backend/src/controllers/pricingController.js - NUEVO ARCHIVO
const PricingConfig = require('../models/pricingConfigModel');
const Product = require('../models/productModel');
const logger = require('../utils/logger').createLogger('pricingController');

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
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        // Hacer deep comparison para objetos anidados
        if (JSON.stringify(config[field]) !== JSON.stringify(req.body[field])) {
          config[field] = req.body[field];
          hasChanges = true;
          logger.info(`Updated config field: ${field}`, {
            oldValue: config[field],
            newValue: req.body[field],
          });
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

    logger.info(`Pricing config updated by ${config.lastUpdatedBy}`, {
      updatedFields: allowedFields.filter((field) => req.body[field] !== undefined),
    });

    // TODO: En Fase 2 - Trigger recálculo PVPM si cambiaron campos relevantes
    const pvpmRelevantFields = [
      'defaultMargin',
      'defaultIva',
      'defaultShippingCost',
      'shippingCostTable',
    ];
    const shouldRecalculatePVPM = pvpmRelevantFields.some((field) => req.body[field] !== undefined);

    if (shouldRecalculatePVPM) {
      logger.info(
        'PVPM recalculation needed due to config changes - will be implemented in Phase 2'
      );
      // await pvpmCalculator.recalculateAllPVPM();
    }

    res.json({
      message: 'Configuración actualizada correctamente',
      config,
      triggeredRecalculation: shouldRecalculatePVPM,
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

module.exports = {
  getPricingConfig,
  updatePricingConfig,
  getShippingCalculator,
  validatePricingConfig,
};
