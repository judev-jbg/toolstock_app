const Product = require('../../models/productModel');
const logger = require('../../utils/logger').createLogger('priceUpdater');

class PriceUpdater {
  constructor() {
    this.updateQueue = [];
    this.isProcessing = false;
  }

  /**
   * Determina el precio final a aplicar considerando todas las reglas
   */
  async determineTargetPrice(product, competitorPrice = null) {
    try {
      // 1. PRIORIDAD MÁXIMA: Precio fijo (si está definido)
      if (product.pricing?.fixedPrice && product.pricing.fixedPrice > 0) {
        logger.info(`Using fixed price for ${product.erp_sku}: ${product.pricing.fixedPrice}€`);
        return {
          price: product.pricing.fixedPrice,
          reason: 'fixed_price',
          breakdown: {
            type: 'fixed',
            fixedPrice: product.pricing.fixedPrice,
            reason: product.pricing.fixedPriceReason || 'Precio comercial especial',
          },
        };
      }

      // 2. Calcular PVPM (siempre para control)
      const pvpmCalculator = require('./pvpmCalculator');
      const pvpmResult = await pvpmCalculator.calculatePVPM(product);
      const pvpm = pvpmResult.pvpm;

      // 3. Si hay precio de competencia, evaluar estrategia
      if (competitorPrice && competitorPrice > 0) {
        return await this.calculateCompetitivePrice(product, competitorPrice, pvpm);
      }

      // 4. Si no hay competencia, usar PVPM
      return {
        price: pvpm,
        reason: 'pvpm',
        breakdown: pvpmResult.breakdown,
      };
    } catch (error) {
      logger.error(`Error determining target price for ${product.erp_sku}:`, error);
      throw error;
    }
  }

  /**
   * Calcula precio competitivo respetando PVPM
   */
  async calculateCompetitivePrice(product, competitorPrice, pvpm) {
    const PricingConfig = require('../../models/pricingConfigModel');
    const config = await PricingConfig.getInstance();
    const minDifference = config.competitorSettings.minPriceDifference;
    const fallbackDifference = config.competitorSettings.fallbackDifference;

    // No podemos vender por debajo del PVPM
    if (competitorPrice < pvpm) {
      logger.info(
        `Cannot compete: competitor price (${competitorPrice}€) below PVPM (${pvpm}€) for ${product.erp_sku}`
      );
      return {
        price: pvpm,
        reason: 'pvpm_minimum',
        breakdown: {
          type: 'competitive_limited',
          competitorPrice,
          pvpm,
          finalPrice: pvpm,
          limitation: 'PVPM mínimo',
        },
      };
    }

    let targetPrice;
    let strategy;

    // Intentar diferencia preferida
    if (competitorPrice - minDifference >= pvpm) {
      targetPrice = competitorPrice - minDifference;
      strategy = `Diferencia preferida (${minDifference}€)`;
    }
    // Si no es posible, diferencia mínima
    else if (competitorPrice - fallbackDifference >= pvpm) {
      targetPrice = competitorPrice - fallbackDifference;
      strategy = `Diferencia mínima (${fallbackDifference}€)`;
    }
    // Como último recurso, igualar PVPM
    else {
      targetPrice = pvpm;
      strategy = 'PVPM mínimo';
    }

    return {
      price: targetPrice,
      reason: 'competitor_match',
      breakdown: {
        type: 'competitive',
        competitorPrice,
        pvpm,
        strategy,
        finalPrice: targetPrice,
      },
    };
  }

  /**
   * Actualiza el precio de un producto
   */
  async updateProductPrice(product, newPrice = null, reason = 'manual', userId = 'system') {
    try {
      const oldPrice = product.amz_price || 0;

      // Si no se especifica precio, determinar automáticamente
      if (newPrice === null) {
        const priceDecision = await this.determineTargetPrice(product);
        newPrice = priceDecision.price;
        reason = priceDecision.reason;

        // Registrar breakdown en el historial
        if (priceDecision.breakdown) {
          reason = `${reason}_auto`;
        }
      }

      // Validar que el precio sea válido
      if (newPrice <= 0) {
        throw new Error('El precio debe ser mayor a 0');
      }

      // Redondear a 2 decimales
      newPrice = Number(newPrice.toFixed(2));

      // Si el precio no ha cambiado, no hacer nada
      if (Math.abs(oldPrice - newPrice) < 0.01) {
        logger.info(`No price change needed for ${product.erp_sku}: ${newPrice}€`);
        return { success: true, priceChanged: false };
      }

      // Actualizar precio en Amazon
      const amazonResult = await this.updateAmazonPrice(product, newPrice);

      if (!amazonResult.success) {
        throw new Error(`Amazon update failed: ${amazonResult.error}`);
      }

      // Actualizar en base de datos local
      const updateData = {
        amz_price: newPrice,
        'pricing.lastPriceUpdate': new Date(),
        $push: {
          'pricing.priceHistory': {
            previousPrice: oldPrice,
            newPrice: newPrice,
            reason: reason,
            changedAt: new Date(),
            changedBy: userId,
          },
        },
      };

      await Product.findByIdAndUpdate(product._id, updateData);

      logger.info(
        `Price updated successfully for ${product.erp_sku}: ${oldPrice}€ → ${newPrice}€ (${reason})`
      );

      return {
        success: true,
        priceChanged: true,
        oldPrice,
        newPrice,
        reason,
        amazonSubmissionId: amazonResult.submissionId,
      };
    } catch (error) {
      logger.error(`Error updating price for ${product.erp_sku}:`, error);

      // Registrar error en historial
      await Product.findByIdAndUpdate(product._id, {
        $push: {
          'pricing.priceHistory': {
            previousPrice: product.amz_price || 0,
            newPrice: newPrice || 0,
            reason: `error_${reason}`,
            changedAt: new Date(),
            changedBy: userId,
            error: error.message,
          },
        },
      });

      throw error;
    }
  }

  /**
   * Actualiza precio en Amazon usando SP-API
   */
  async updateAmazonPrice(product, newPrice) {
    try {
      if (!process.env.AMAZON_SELLER_ID) {
        throw new Error('AMAZON_SELLER_ID not configured');
      }

      const requestBody = {
        productType: 'PRODUCT',
        patches: [
          {
            op: 'replace',
            path: '/attributes/purchasable_offer',
            value: [
              {
                marketplace_id: process.env.AMAZON_MARKETPLACE_ID,
                currency: 'EUR',
                our_price: [
                  {
                    schedule: [
                      {
                        value_with_tax: newPrice,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };

      const spApiClient = require('../amazon/spApiClient');
      const result = await spApiClient.executeWithRetry(async (client) => {
        const response = await client.callAPI({
          operation: 'patchListingsItem',
          endpoint: 'listingsItems',
          path: {
            sellerId: process.env.AMAZON_SELLER_ID,
            sku: product.amz_sellerSku || product.erp_sku,
          },
          query: {
            marketplaceIds: [process.env.AMAZON_MARKETPLACE_ID],
          },
          body: requestBody,
        });
        return response;
      });

      return {
        success: true,
        submissionId: result.submissionId || null,
      };
    } catch (error) {
      logger.error(`Amazon price update failed for ${product.erp_sku}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Actualización masiva de precios con cola de procesamiento
   */
  async bulkUpdatePrices(updates) {
    this.updateQueue.push(...updates);

    if (!this.isProcessing) {
      this.processQueue();
    }

    return { queued: updates.length };
  }

  /**
   * Procesa la cola de actualizaciones de precios
   */
  async processQueue() {
    if (this.isProcessing || this.updateQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const results = { success: [], errors: [] };

    try {
      while (this.updateQueue.length > 0) {
        const update = this.updateQueue.shift();

        try {
          const product = await Product.findById(update.productId);
          if (!product) {
            throw new Error('Product not found');
          }

          const result = await this.updateProductPrice(
            product,
            update.newPrice,
            update.reason || 'bulk_update',
            update.userId || 'system'
          );

          results.success.push({
            productId: update.productId,
            sku: product.erp_sku,
            result,
          });
        } catch (error) {
          results.errors.push({
            productId: update.productId,
            error: error.message,
          });
        }

        // Pausa pequeña entre actualizaciones para evitar rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } finally {
      this.isProcessing = false;
    }

    logger.info(
      `Bulk price update completed: ${results.success.length} success, ${results.errors.length} errors`
    );
    return results;
  }

  /**
   * Actualiza precios automáticamente para productos que lo necesiten
   */
  async updatePricesAutomatically() {
    try {
      logger.info('Starting automatic price updates...');

      // Buscar productos que necesitan actualización de precio
      const products = await Product.find({
        'pricing.autoUpdateEnabled': { $ne: false },
        amz_status: 'Active',
        $or: [
          // Productos con PVPM desactualizado
          {
            $expr: {
              $and: [
                { $gt: ['$pricing.pvpm', 0] },
                { $ne: ['$pricing.lastPriceUpdate', null] },
                { $ne: ['$updatedAt', null] },
                { $gt: ['$updatedAt', '$pricing.lastPriceUpdate'] },
              ],
            },
          },
          // Productos con precio por debajo del PVPM
          {
            $expr: {
              $and: [
                { $gt: ['$pricing.pvpm', 0] },
                { $gt: ['$amz_price', 0] },
                { $lt: ['$amz_price', '$pricing.pvpm'] },
              ],
            },
          },
        ],
      }).limit(100); // Procesar máximo 100 productos por ejecución

      if (products.length === 0) {
        logger.info('No products need automatic price updates');
        return { updated: 0, errors: 0 };
      }

      const updates = products.map((product) => ({
        productId: product._id,
        newPrice: null, // Precio automático
        reason: 'automatic_update',
        userId: 'system',
      }));

      await this.bulkUpdatePrices(updates);

      logger.info(`Automatic price updates queued for ${products.length} products`);

      return {
        updated: products.length,
        errors: 0,
      };
    } catch (error) {
      logger.error('Error in automatic price updates:', error);
      throw error;
    }
  }
}

module.exports = new PriceUpdater();
