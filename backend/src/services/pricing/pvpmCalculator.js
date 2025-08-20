// backend/src/services/pricing/pvpmCalculator.js - NUEVO ARCHIVO
const PricingConfig = require('../../models/pricingConfigModel');
const Product = require('../../models/productModel');
const actionDetector = require('./actionDetector');
const logger = require('../../utils/logger');

class PVPMCalculator {
  /**
   * Calcula el PVPM para un producto
   * Fórmula: ((coste / margen) + IVA) + coste_envío
   */
  async calculatePVPM(product) {
    try {
      const config = await PricingConfig.getInstance();

      // 1. Obtener coste (prioridad: customCost > erp_cost)
      const cost = this.getEffectiveCost(product);

      // 2. Obtener margen (prioridad: customMargin > defaultMargin)
      const margin = this.getEffectiveMargin(product, config);

      // 3. Obtener IVA
      const iva = config.defaultIva;

      // 4. Calcular coste de envío
      const shippingCost = this.getEffectiveShippingCost(product, config);

      // 5. Aplicar fórmula PVPM
      if (cost <= 0) {
        throw new Error('El coste debe ser mayor que 0 para calcular PVPM');
      }

      if (margin <= 0.1 || margin >= 0.9) {
        throw new Error('El margen debe estar entre 0.1 (10%) y 0.9 (90%)');
      }

      // Fórmula: ((coste / margen) + IVA) + coste_envío
      const basePrice = cost / margin;
      const priceWithIva = basePrice * (1 + iva);
      const pvpm = priceWithIva + shippingCost * 1.21;

      const breakdown = {
        cost: Math.round(cost * 100) / 100,
        margin: Math.round(margin * 10000) / 10000, // 4 decimales para margen
        iva: Math.round(iva * 10000) / 10000,
        shippingCost: Math.round(shippingCost * 1.21 * 100) / 100,
        basePrice: Math.round(basePrice * 100) / 100,
        priceWithIva: Math.round(priceWithIva * 100) / 100,
      };

      const finalPvpm = Math.round(pvpm * 100) / 100;

      logger.debug(`PVPM calculated for ${product.erp_sku}:`, {
        ...breakdown,
        pvpm: finalPvpm,
        formula: `((${breakdown.cost} / ${breakdown.margin}) * ${1 + breakdown.iva}) + ${breakdown.shippingCost} = ${finalPvpm}`,
      });

      return {
        pvpm: finalPvpm,
        breakdown,
        sources: {
          costSource: product.pricing?.customCost ? 'custom' : 'erp',
          marginSource: product.pricing?.customMargin ? 'custom' : 'default',
          shippingSource: product.pricing?.customShippingCost
            ? 'custom'
            : product.erp_weight > 0
              ? 'weight_table'
              : 'default',
        },
      };
    } catch (error) {
      logger.error(`Error calculating PVPM for product ${product.erp_sku}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene el coste efectivo (customCost tiene prioridad sobre erp_cost)
   */
  getEffectiveCost(product) {
    if (product.pricing?.customCost !== null && product.pricing?.customCost > 0) {
      return product.pricing.customCost;
    }
    return product.erp_cost || 0;
  }

  /**
   * Obtiene el margen efectivo (customMargin tiene prioridad sobre defaultMargin)
   */
  getEffectiveMargin(product, config) {
    if (product.pricing?.customMargin !== null && product.pricing?.customMargin > 0) {
      return product.pricing.customMargin;
    }
    return config.defaultMargin;
  }

  /**
   * Obtiene el coste de envío efectivo
   * Prioridad: customShippingCost > peso > defaultShippingCost
   */
  getEffectiveShippingCost(product, config) {
    // Prioridad 1: customShippingCost
    if (product.pricing?.customShippingCost !== null && product.pricing?.customShippingCost >= 0) {
      return product.pricing.customShippingCost;
    }

    // Prioridad 2: Calcular por peso usando tabla GLS
    const weight = product.erp_weight || 0;

    if (weight > 0) {
      return config.calculateShippingCostByWeight(weight);
    }

    // Prioridad 3: Coste por defecto
    return config.defaultShippingCost;
  }

  /**
   * Actualiza PVPM para un producto específico
   */
  async updateProductPVPM(productId, options = {}) {
    try {
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Producto no encontrado');
      }

      const pvpmResult = await this.calculatePVPM(product);

      // Preparar actualización
      const updateData = {
        'pricing.pvpm': pvpmResult.pvpm,
        'pricing.pvpmCalculatedAt': new Date(),
        'pricing.pvpmBreakdown': pvpmResult.breakdown,
      };

      // Si hay cambio significativo en PVPM, registrar en historial
      const previousPvpm = product.pricing?.pvpm || 0;
      const pvpmChanged = Math.abs(previousPvpm - pvpmResult.pvpm) > 0.01;

      if (pvpmChanged && previousPvpm > 0) {
        const historyEntry = {
          previousPrice: previousPvpm,
          newPrice: pvpmResult.pvpm,
          reason: 'pvpm_change',
          trigger: options.trigger || 'manual_calculation',
          changedAt: new Date(),
          changedBy: options.changedBy || 'system',
          success: true,
          errorMessage: '',
        };

        // Mantener solo los últimos 5 cambios
        const currentHistory = product.pricing?.recentPriceHistory || [];
        const newHistory = [historyEntry, ...currentHistory].slice(0, 5);
        updateData['pricing.recentPriceHistory'] = newHistory;
        updateData['pricing.pricingMetadata.totalPriceChanges'] =
          (product.pricing?.pricingMetadata?.totalPriceChanges || 0) + 1;
      }

      // Actualizar estado de pricing
      updateData['pricing.pricingStatus'] = this.determinePricingStatus(product, pvpmResult);
      updateData['pricing.pricingStatusUpdatedAt'] = new Date();

      // Ejecutar actualización
      const updatedProduct = await Product.findByIdAndUpdate(productId, updateData, {
        new: true,
        runValidators: true,
      });

      // Registrar en historial si hubo cambio significativo
      if (pvpmChanged && options.recordHistory !== false) {
        try {
          await historyService.recordPVPMChange(product, pvpmResult, {
            trigger: options.trigger || 'manual_calculation',
            changedBy: options.changedBy || 'system',
            batchId: options.batchId,
          });
        } catch (historyError) {
          logger.warning(`Error recording PVPM history for ${product.erp_sku}:`, historyError);
          // No fallar el PVPM por errores de historial
        }
      }

      // Detectar acciones automáticamente después de actualizar PVPM
      if (options.detectActions !== false) {
        try {
          await actionDetector.processProductActions(updatedProduct);
        } catch (actionError) {
          logger.warning(`Error detecting actions for product ${product.erp_sku}:`, actionError);
          // No fallar el PVPM por errores de detección de acciones
        }
      }

      logger.info(`PVPM updated for product ${product.erp_sku}:`, {
        previousPvpm,
        newPvpm: pvpmResult.pvpm,
        changed: pvpmChanged,
        breakdown: pvpmResult.breakdown,
        sources: pvpmResult.sources,
      });

      return {
        product: updatedProduct,
        pvpmResult,
        changed: pvpmChanged,
        previousPvpm,
      };
    } catch (error) {
      logger.error(`Error updating PVPM for product ${productId}:`, error);

      // Marcar producto con error
      await Product.findByIdAndUpdate(productId, {
        'pricing.pricingStatus': 'missing_data',
        'pricing.pricingStatusMessage': `Error calculando PVPM: ${error.message}`,
        'pricing.pricingStatusUpdatedAt': new Date(),
      });

      throw error;
    }
  }

  /**
   * Determina el estado de pricing basado en el producto y PVPM
   */
  determinePricingStatus(product, pvpmResult) {
    // Verificar datos faltantes
    if (!product.erp_cost && !product.pricing?.customCost) {
      return 'missing_cost';
    }

    // if (!product.erp_weight && !product.pricing?.customShippingCost) {
    //   return 'missing_data';
    // }

    // Verificar OFERTA WEB
    if (product.erp_offer_web === 1) {
      const webPriceWithIva = (product.erp_price_web_official || 0) * 1.21;
      const requiredAmazonPrice = webPriceWithIva * 1.04; // 4% más caro

      if (pvpmResult.pvpm < requiredAmazonPrice) {
        return 'web_offer_conflict';
      }
    }

    // Verificar si Amazon es más barato que web
    if (product.amz_price > 0 && product.erp_price_web_official > 0) {
      const webPriceWithIva = product.erp_price_web_official * 1.21;
      const requiredWebDiscount = product.amz_price * 0.96; // Web debe ser 4% más barata

      if (webPriceWithIva > requiredWebDiscount) {
        return 'amazon_cheaper';
      }
    }

    return 'ok';
  }

  /**
   * Recalcula PVPM para múltiples productos
   */
  async bulkUpdatePVPM(productIds, options = {}) {
    try {
      logger.info(`Starting bulk PVPM calculation for ${productIds.length} products...`);

      const results = {
        processed: 0,
        updated: 0,
        errors: 0,
        errorDetails: [],
        summary: {
          totalPvpmChanges: 0,
          averagePvpm: 0,
          minPvpm: Infinity,
          maxPvpm: 0,
        },
      };

      const pvpmValues = [];

      for (const productId of productIds) {
        try {
          const result = await this.updateProductPVPM(productId, {
            ...options,
            trigger: 'bulk_calculation',
          });

          results.updated++;
          if (result.changed) {
            results.summary.totalPvpmChanges++;
          }

          const pvpm = result.pvpmResult.pvpm;
          pvpmValues.push(pvpm);
          results.summary.minPvpm = Math.min(results.summary.minPvpm, pvpm);
          results.summary.maxPvpm = Math.max(results.summary.maxPvpm, pvpm);
        } catch (error) {
          results.errors++;
          results.errorDetails.push({
            productId,
            error: error.message,
          });
        }
        results.processed++;

        // Log progreso cada 50 productos
        if (results.processed % 50 === 0) {
          logger.info(`Bulk PVPM progress: ${results.processed}/${productIds.length}`);
        }
      }

      // Calcular estadísticas finales
      if (pvpmValues.length > 0) {
        results.summary.averagePvpm =
          Math.round((pvpmValues.reduce((sum, val) => sum + val, 0) / pvpmValues.length) * 100) /
          100;
      }

      if (results.summary.minPvpm === Infinity) {
        results.summary.minPvpm = 0;
      }

      logger.info('Bulk PVPM calculation completed:', results);
      return results;
    } catch (error) {
      logger.error('Error in bulk PVPM calculation:', error);
      throw error;
    }
  }

  /**
   * Recalcula PVPM para todos los productos
   */
  async recalculateAllPVPM(options = {}) {
    try {
      logger.info('Starting PVPM recalculation for all products...');

      // Obtener todos los productos con ERP SKU
      const products = await Product.find({
        erp_sku: { $exists: true, $nin: ['', '0'] },
        erp_status: 0,
      })
        .select('_id erp_sku')
        .lean();

      const productIds = products.map((p) => p._id);

      return await this.bulkUpdatePVPM(productIds, {
        ...options,
        trigger: 'recalculate_all',
      });
    } catch (error) {
      logger.error('Error in recalculate all PVPM:', error);
      throw error;
    }
  }

  /**
   * Obtiene productos que necesitan recálculo de PVPM
   */
  async getProductsNeedingPVPMUpdate() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const products = await Product.find({
        erp_sku: { $exists: true, $nin: ['', '0'] },
        erp_status: 0,
        $or: [
          { 'pricing.pvpmCalculatedAt': { $lt: oneHourAgo } },
          { 'pricing.pvpmCalculatedAt': { $exists: false } },
          { 'pricing.pvpm': { $lte: 0 } },
          { 'pricing.pricingStatus': 'missing_data' },
        ],
      })
        .select('_id erp_sku pricing.pvpmCalculatedAt pricing.pvpm')
        .lean();

      return {
        count: products.length,
        products: products.slice(0, 10), // Primeros 10 para preview
        reasons: {
          neverCalculated: products.filter((p) => !p.pricing?.pvpmCalculatedAt).length,
          outdated: products.filter(
            (p) => p.pricing?.pvpmCalculatedAt && p.pricing.pvpmCalculatedAt < oneHourAgo
          ).length,
          zeroPvpm: products.filter((p) => (p.pricing?.pvpm || 0) <= 0).length,
          missingData: products.filter((p) => p.pricing?.pricingStatus === 'missing_data').length,
        },
      };
    } catch (error) {
      logger.error('Error getting products needing PVPM update:', error);
      throw error;
    }
  }

  /**
   * Valida los datos necesarios para calcular PVPM
   */
  validateProductForPVPM(product) {
    const issues = [];

    // Verificar coste
    const effectiveCost = this.getEffectiveCost(product);
    if (effectiveCost <= 0) {
      issues.push({
        field: 'cost',
        message: 'Coste debe ser mayor que 0',
        suggestion: 'Configurar erp_cost o pricing.customCost',
      });
    }

    // Verificar peso para cálculo de envío
    if (!product.erp_weight && !product.pricing?.customShippingCost) {
      issues.push({
        field: 'shipping',
        message: 'Sin peso ni coste de envío personalizado',
        suggestion: 'Configurar erp_weight o pricing.customShippingCost',
      });
    }

    // Verificar margen si es personalizado
    if (
      product.pricing?.customMargin &&
      (product.pricing.customMargin <= 0.1 || product.pricing.customMargin >= 0.9)
    ) {
      issues.push({
        field: 'margin',
        message: 'Margen personalizado fuera del rango válido (10%-90%)',
        suggestion: 'Ajustar pricing.customMargin o usar margen por defecto',
      });
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }
}

module.exports = new PVPMCalculator();
