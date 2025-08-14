const PendingAction = require('../../models/pendingActionModel');
const Product = require('../../models/productModel');
const PricingConfig = require('../../models/pricingConfigModel');
const logger = require('../../utils/logger');

class ActionDetector {
  /**
   * Detecta todas las acciones pendientes para un producto
   */
  async detectActionsForProduct(product) {
    try {
      const detectedActions = [];

      // 1. Verificar datos faltantes críticos
      await this.checkMissingData(product, detectedActions);

      // 2. Verificar conflictos de ofertas web
      await this.checkWebOfferConflicts(product, detectedActions);

      // 3. Verificar relación precios Amazon vs Web
      await this.checkAmazonWebPriceRelation(product, detectedActions);

      // 4. Verificar alertas de PVPM
      await this.checkPVPMWarnings(product, detectedActions);

      // 5. Verificar precio fijo vs PVPM
      await this.checkFixedPriceWarnings(product, detectedActions);

      // 6. Verificar errores de sincronización
      await this.checkSyncErrors(product, detectedActions);

      return detectedActions;
    } catch (error) {
      logger.error(`Error detecting actions for product ${product.erp_sku}:`, error);
      return [];
    }
  }

  /**
   * Verifica datos faltantes críticos
   */
  async checkMissingData(product, detectedActions) {
    // Verificar coste faltante
    if (!product.erp_cost && !product.pricing?.customCost) {
      detectedActions.push({
        actionType: 'missing_cost',
        priority: 'high',
        title: 'Producto sin coste definido',
        description: `El producto ${product.erp_sku} no tiene coste (erp_cost) ni coste personalizado configurado. Esto impide calcular el PVPM correctamente.`,
        data: {
          currentCost: product.erp_cost || 0,
          hasCustomCost: !!product.pricing?.customCost,
        },
      });
    }

    // Verificar peso faltante (si no tiene coste de envío personalizado)
    if ((!product.erp_weight || product.erp_weight === 0) && !product.pricing?.customShippingCost) {
      detectedActions.push({
        actionType: 'missing_weight',
        priority: 'medium',
        title: 'Producto sin peso definido',
        description: `El producto ${product.erp_sku} no tiene peso (erp_weight) configurado y tampoco tiene coste de envío personalizado. Se usará el coste de envío por defecto.`,
        data: {
          currentWeight: product.erp_weight || 0,
          hasCustomShipping: !!product.pricing?.customShippingCost,
        },
      });
    }

    // Verificar margen inválido
    if (
      product.pricing?.customMargin &&
      (product.pricing.customMargin <= 0.1 || product.pricing.customMargin >= 0.9)
    ) {
      detectedActions.push({
        actionType: 'invalid_margin',
        priority: 'high',
        title: 'Margen personalizado inválido',
        description: `El producto ${product.erp_sku} tiene un margen personalizado (${(product.pricing.customMargin * 100).toFixed(1)}%) fuera del rango válido (10%-90%).`,
        data: {
          currentMargin: product.pricing.customMargin,
          minAllowed: 0.1,
          maxAllowed: 0.9,
        },
      });
    }
  }

  /**
   * Verifica conflictos con ofertas web
   */
  async checkWebOfferConflicts(product, detectedActions) {
    if (product.erp_obs === 'OFERTA WEB') {
      const webPriceWithIva = (product.erp_price || 0) * 1.21;
      const amazonPrice = product.amz_price || 0;

      // La oferta web debe ser al menos 4% más barata que Amazon
      const requiredAmazonPrice = webPriceWithIva * 1.04;

      if (amazonPrice > 0 && amazonPrice < requiredAmazonPrice) {
        detectedActions.push({
          actionType: 'web_offer_conflict',
          priority: 'critical',
          title: 'Conflicto con oferta web',
          description: `El producto ${product.erp_sku} está marcado como "OFERTA WEB" pero el precio de Amazon (${amazonPrice.toFixed(2)}€) no es suficientemente alto comparado con el precio web (${webPriceWithIva.toFixed(2)}€). Amazon debe costar al menos ${requiredAmazonPrice.toFixed(2)}€.`,
          data: {
            webPrice: webPriceWithIva,
            amazonPrice: amazonPrice,
            requiredPrice: requiredAmazonPrice,
            difference: requiredAmazonPrice - amazonPrice,
          },
        });
      }
    }
  }

  /**
   * Verifica relación entre precios Amazon y Web
   */
  async checkAmazonWebPriceRelation(product, detectedActions) {
    const amazonPrice = product.amz_price || 0;
    const webPriceWithIva = (product.erp_price || 0) * 1.21;

    if (amazonPrice > 0 && webPriceWithIva > 0) {
      const requiredWebPrice = amazonPrice * 0.96; // Web debe ser 4% más barata

      if (webPriceWithIva > requiredWebPrice) {
        detectedActions.push({
          actionType: 'amazon_cheaper_than_web',
          priority: 'critical',
          title: 'Amazon más barato que la web',
          description: `El producto ${product.erp_sku} tiene un precio en Amazon (${amazonPrice.toFixed(2)}€) más barato que en la web (${webPriceWithIva.toFixed(2)}€). La web debe ser al menos 4% más barata (máx. ${requiredWebPrice.toFixed(2)}€).`,
          data: {
            amazonPrice: amazonPrice,
            webPrice: webPriceWithIva,
            requiredWebPrice: requiredWebPrice,
            currentDiscount: ((amazonPrice - webPriceWithIva) / amazonPrice) * 100,
            requiredDiscount: 4,
          },
        });
      }
    }
  }

  /**
   * Verifica alertas relacionadas con PVPM
   */
  async checkPVPMWarnings(product, detectedActions) {
    const pvpm = product.pricing?.pvpm || 0;
    const currentPrice = product.amz_price || 0;

    if (pvpm > 0 && currentPrice > 0) {
      const config = await PricingConfig.getInstance();
      const warningThreshold = config.alertSettings.pvpmWarningThreshold || 0.05; // 5%
      const minimumPrice = pvpm * (1 - warningThreshold);

      if (currentPrice < minimumPrice) {
        const percentageBelow = ((pvpm - currentPrice) / pvpm) * 100;

        detectedActions.push({
          actionType: 'pvpm_warning',
          priority: percentageBelow > 10 ? 'critical' : 'high',
          title: 'Precio por debajo del PVPM',
          description: `El producto ${product.erp_sku} tiene un precio actual (${currentPrice.toFixed(2)}€) significativamente por debajo del PVPM (${pvpm.toFixed(2)}€). Diferencia: ${(pvpm - currentPrice).toFixed(2)}€ (${percentageBelow.toFixed(1)}%).`,
          data: {
            currentPrice: currentPrice,
            pvpm: pvpm,
            difference: pvpm - currentPrice,
            percentageBelow: percentageBelow,
            warningThreshold: warningThreshold * 100,
          },
        });
      }
    }
  }

  /**
   * Verifica alertas de precio fijo vs PVPM
   */
  async checkFixedPriceWarnings(product, detectedActions) {
    const fixedPrice = product.pricing?.fixedPrice;
    const pvpm = product.pricing?.pvpm || 0;

    if (fixedPrice && pvpm > 0 && fixedPrice < pvpm) {
      const difference = pvpm - fixedPrice;
      const percentageBelow = (difference / pvpm) * 100;

      detectedActions.push({
        actionType: 'fixed_price_below_pvpm',
        priority: percentageBelow > 15 ? 'high' : 'medium',
        title: 'Precio fijo por debajo del PVPM',
        description: `El producto ${product.erp_sku} tiene un precio fijo (${fixedPrice.toFixed(2)}€) por debajo del PVPM calculado (${pvpm.toFixed(2)}€). Diferencia: ${difference.toFixed(2)}€. Razón: ${product.pricing.fixedPriceReason || 'No especificada'}.`,
        data: {
          fixedPrice: fixedPrice,
          pvpm: pvpm,
          difference: difference,
          percentageBelow: percentageBelow,
          reason: product.pricing.fixedPriceReason || '',
          setAt: product.pricing.fixedPriceSetAt,
          setBy: product.pricing.fixedPriceSetBy || '',
        },
      });
    }
  }

  /**
   * Verifica errores de sincronización
   */
  async checkSyncErrors(product, detectedActions) {
    // Error de sincronización de Amazon
    if (product.amz_syncStatus === 'error') {
      detectedActions.push({
        actionType: 'sync_error',
        priority: 'medium',
        title: 'Error de sincronización con Amazon',
        description: `El producto ${product.erp_sku} tiene errores de sincronización con Amazon. Error: ${product.amz_syncError || 'No especificado'}.`,
        data: {
          syncError: product.amz_syncError || '',
          lastSyncAt: product.amz_lastSyncAt,
          syncStatus: product.amz_syncStatus,
        },
      });
    }

    // Producto sin datos de Amazon
    if (product.erp_sku && !product.amz_asin && !product.amz_sellerSku) {
      detectedActions.push({
        actionType: 'missing_amazon_data',
        priority: 'low',
        title: 'Producto sin datos de Amazon',
        description: `El producto ${product.erp_sku} no tiene ASIN ni Seller SKU de Amazon configurados.`,
        data: {
          hasErpSku: !!product.erp_sku,
          hasAsin: !!product.amz_asin,
          hasSellerSku: !!product.amz_sellerSku,
        },
      });
    }
  }

  /**
   * Crea o actualiza una acción pendiente
   */
  async createOrUpdateAction(productId, erp_sku, actionData) {
    try {
      const existingAction = await PendingAction.findOne({
        productId: productId,
        actionType: actionData.actionType,
        status: { $in: ['pending', 'in_progress'] },
      });

      if (existingAction) {
        // Actualizar acción existente
        existingAction.title = actionData.title;
        existingAction.description = actionData.description;
        existingAction.priority = actionData.priority;
        existingAction.data = { ...existingAction.data, ...actionData.data };
        existingAction.data.lastChecked = new Date();
        existingAction.data.occurrenceCount = (existingAction.data.occurrenceCount || 1) + 1;

        await existingAction.save();
        return { action: existingAction, created: false };
      } else {
        // Crear nueva acción
        const newAction = await PendingAction.create({
          productId: productId,
          erp_sku: erp_sku,
          ...actionData,
        });

        return { action: newAction, created: true };
      }
    } catch (error) {
      logger.error('Error creating/updating pending action:', error);
      throw error;
    }
  }

  /**
   * Procesa detección para un producto y crea/actualiza acciones
   */
  async processProductActions(product) {
    try {
      const detectedActions = await this.detectActionsForProduct(product);
      const results = {
        productId: product._id,
        erp_sku: product.erp_sku,
        actionsCreated: 0,
        actionsUpdated: 0,
        actions: [],
      };

      for (const actionData of detectedActions) {
        const result = await this.createOrUpdateAction(product._id, product.erp_sku, actionData);

        if (result.created) {
          results.actionsCreated++;
        } else {
          results.actionsUpdated++;
        }

        results.actions.push(result.action);
      }

      // Auto-resolver acciones que ya no aplican
      await this.autoResolveObsoleteActions(product);

      return results;
    } catch (error) {
      logger.error(`Error processing actions for product ${product.erp_sku}:`, error);
      throw error;
    }
  }

  /**
   * Auto-resuelve acciones que ya no son relevantes
   */
  async autoResolveObsoleteActions(product) {
    try {
      const currentActions = await this.detectActionsForProduct(product);
      const currentActionTypes = currentActions.map((a) => a.actionType);

      // Buscar acciones pendientes que ya no aplican
      const obsoleteActions = await PendingAction.find({
        productId: product._id,
        status: { $in: ['pending', 'in_progress'] },
        actionType: { $nin: currentActionTypes },
        autoResolveEnabled: true,
      });

      for (const action of obsoleteActions) {
        await action.resolve(
          'system',
          'Acción auto-resuelta: la condición ya no se cumple',
          'automatic'
        );

        logger.info(`Auto-resolved action ${action.actionType} for product ${product.erp_sku}`);
      }

      return obsoleteActions.length;
    } catch (error) {
      logger.error(`Error auto-resolving actions for product ${product.erp_sku}:`, error);
      return 0;
    }
  }

  /**
   * Detecta acciones para múltiples productos
   */
  async detectActionsForProducts(productIds) {
    try {
      logger.info(`Starting action detection for ${productIds.length} products...`);

      const results = {
        processed: 0,
        errors: 0,
        totalActionsCreated: 0,
        totalActionsUpdated: 0,
        errorDetails: [],
      };

      for (const productId of productIds) {
        try {
          const product = await Product.findById(productId);
          if (!product) {
            results.errors++;
            results.errorDetails.push({
              productId,
              error: 'Product not found',
            });
            continue;
          }

          const productResult = await this.processProductActions(product);
          results.totalActionsCreated += productResult.actionsCreated;
          results.totalActionsUpdated += productResult.actionsUpdated;
        } catch (error) {
          results.errors++;
          results.errorDetails.push({
            productId,
            error: error.message,
          });
        }

        results.processed++;

        if (results.processed % 100 === 0) {
          logger.info(`Action detection progress: ${results.processed}/${productIds.length}`);
        }
      }

      logger.info('Action detection completed:', results);
      return results;
    } catch (error) {
      logger.error('Error in bulk action detection:', error);
      throw error;
    }
  }

  /**
   * Detecta acciones para todos los productos
   */
  async detectActionsForAllProducts() {
    try {
      const products = await Product.find({
        erp_sku: { $exists: true, $nin: ['', '0'] },
        erp_status: 0,
      })
        .select('_id')
        .lean();

      const productIds = products.map((p) => p._id);
      return await this.detectActionsForProducts(productIds);
    } catch (error) {
      logger.error('Error detecting actions for all products:', error);
      throw error;
    }
  }
}

module.exports = new ActionDetector();
