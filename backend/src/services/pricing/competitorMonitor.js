const amazonService = require('../amazon/amazonService');
const Product = require('../../models/productModel');
const logger = require('../../utils/logger').createLogger('competitorMonitor');

class CompetitorMonitor {
  constructor() {
    this.subscriptions = new Map(); // Store active subscriptions
  }

  /**
   * Configura suscripción para monitoreo de precios
   */
  async setupPriceNotifications() {
    try {
      // Usar Amazon Notifications API - ANY_OFFER_CHANGED
      const subscription = await amazonService.createNotificationSubscription({
        notificationType: 'ANY_OFFER_CHANGED',
        payloadVersion: '1.0',
        destinationDetail: {
          // Configuración del webhook endpoint
          name: 'PriceChangeNotification',
          url: `${process.env.WEBHOOK_BASE_URL}/webhooks/amazon/price-changes`,
          // headers para autenticación si es necesario
        },
      });

      logger.info('Price monitoring subscription created:', subscription);
      return subscription;
    } catch (error) {
      logger.error('Error setting up price notifications:', error);
      throw error;
    }
  }

  /**
   * Procesa notificación de cambio de precio de Amazon
   */
  async processPriceChangeNotification(notification) {
    try {
      const { payload } = notification;
      const { asin, marketplace, offerChanges } = payload;

      // Buscar producto en nuestra base de datos
      const product = await Product.findOne({ amz_asin: asin });

      if (!product) {
        logger.warn(`Product not found for ASIN: ${asin}`);
        return;
      }

      // Extraer precio competitivo más bajo (excluyendo el nuestro)
      const competitorPrices = offerChanges
        .filter((offer) => offer.sellerId !== process.env.AMAZON_SELLER_ID)
        .map((offer) => offer.price?.amount)
        .filter((price) => price && price > 0)
        .sort((a, b) => a - b);

      if (competitorPrices.length === 0) {
        logger.info(`No competitor prices found for ${product.erp_sku}`);
        return;
      }

      const lowestCompetitorPrice = competitorPrices[0];

      // Actualizar precio de competencia en BD
      await Product.findByIdAndUpdate(product._id, {
        'pricing.competitorPrice': lowestCompetitorPrice,
        'pricing.competitorPriceUpdatedAt': new Date(),
      });

      // Trigger price update evaluation
      await this.evaluatePriceUpdate(product, lowestCompetitorPrice);

      logger.info(`Competitor price updated for ${product.erp_sku}: ${lowestCompetitorPrice}€`);
    } catch (error) {
      logger.error('Error processing price change notification:', error);
      throw error;
    }
  }

  /**
   * Evalúa si se debe actualizar el precio basado en competencia
   * ACTUALIZADO: Usa la nueva lógica de priceUpdater
   */
  async evaluatePriceUpdate(product, competitorPrice) {
    try {
      // Verificar si el producto tiene auto-update deshabilitado
      if (product.pricing?.autoUpdateEnabled === false) {
        logger.info(`Auto-update disabled for ${product.erp_sku}, skipping price update`);
        return;
      }

      // Usar el priceUpdater para determinar el precio objetivo
      const priceUpdater = require('./priceUpdater');

      // Recargar producto para tener datos actualizados
      const updatedProduct = await Product.findById(product._id);

      // Determinar precio objetivo considerando todas las reglas
      const priceDecision = await priceUpdater.determineTargetPrice(
        updatedProduct,
        competitorPrice
      );

      // Solo actualizar si el precio cambió significativamente (más de 1 céntimo)
      const currentPrice = updatedProduct.amz_price || 0;
      if (Math.abs(currentPrice - priceDecision.price) > 0.01) {
        await priceUpdater.updateProductPrice(
          updatedProduct,
          priceDecision.price,
          priceDecision.reason,
          'system'
        );

        logger.info(
          `Price updated for ${product.erp_sku}: ${currentPrice}€ → ${priceDecision.price}€ (reason: ${priceDecision.reason})`
        );

        // Log adicional si es precio fijo
        if (priceDecision.reason === 'fixed_price') {
          logger.info(
            `Fixed price maintained for ${product.erp_sku}: ${priceDecision.price}€ (${priceDecision.breakdown?.reason})`
          );
        }
      } else {
        logger.info(
          `No price change needed for ${product.erp_sku}: target ${priceDecision.price}€ vs current ${currentPrice}€`
        );
      }
    } catch (error) {
      logger.error(`Error evaluating price update for ${product.erp_sku}:`, error);
    }
  }

  /**
   * Obtiene precios de competencia para un producto específico
   */
  async getCompetitorPrices(asin) {
    try {
      const offers = await amazonService.getProductOffers(asin);

      const competitorPrices = offers
        .filter((offer) => offer.sellerId !== process.env.AMAZON_SELLER_ID)
        .map((offer) => ({
          sellerId: offer.sellerId,
          price: offer.price?.amount || 0,
          condition: offer.condition,
          fulfillmentChannel: offer.fulfillmentChannel,
          shippingTime: offer.shippingTime,
        }))
        .filter((offer) => offer.price > 0)
        .sort((a, b) => a.price - b.price);

      return competitorPrices;
    } catch (error) {
      logger.error(`Error getting competitor prices for ASIN ${asin}:`, error);
      return [];
    }
  }

  /**
   * Monitorea precios de competencia para productos específicos
   */
  async monitorProductCompetitorPrices(products) {
    const results = {
      success: [],
      errors: [],
    };

    for (const product of products) {
      try {
        if (!product.amz_asin) {
          logger.warn(`Product ${product.erp_sku} has no ASIN, skipping competitor monitoring`);
          continue;
        }

        const competitorPrices = await this.getCompetitorPrices(product.amz_asin);

        if (competitorPrices.length > 0) {
          const lowestPrice = competitorPrices[0].price;

          // Actualizar precio de competencia en BD
          await Product.findByIdAndUpdate(product._id, {
            'pricing.competitorPrice': lowestPrice,
            'pricing.competitorPriceUpdatedAt': new Date(),
          });

          // Evaluar actualización de precio
          await this.evaluatePriceUpdate(product, lowestPrice);

          results.success.push({
            sku: product.erp_sku,
            competitorPrice: lowestPrice,
            competitorCount: competitorPrices.length,
          });
        } else {
          logger.info(`No competitor prices found for ${product.erp_sku}`);
          results.success.push({
            sku: product.erp_sku,
            competitorPrice: null,
            competitorCount: 0,
          });
        }

        // Pausa para evitar rate limiting
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (error) {
        logger.error(`Error monitoring competitor for ${product.erp_sku}:`, error);
        results.errors.push({
          sku: product.erp_sku,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Fuerza la actualización de precios basada en competencia para productos activos
   */
  async forceCompetitorPriceUpdate(limit = 50) {
    try {
      logger.info('Starting forced competitor price update...');

      // Obtener productos activos con ASIN
      const products = await Product.find({
        amz_asin: { $exists: true, $ne: '' },
        'pricing.autoUpdateEnabled': { $ne: false },
        amz_status: 'Active',
      }).limit(limit);

      if (products.length === 0) {
        logger.info('No products found for competitor monitoring');
        return { updated: 0, errors: 0 };
      }

      const results = await this.monitorProductCompetitorPrices(products);

      logger.info(
        `Forced competitor update completed: ${results.success.length} success, ${results.errors.length} errors`
      );

      return {
        updated: results.success.length,
        errors: results.errors.length,
        details: results,
      };
    } catch (error) {
      logger.error('Error in forced competitor price update:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas del monitoreo de competencia
   */
  async getCompetitorMonitoringStats() {
    try {
      // Productos con precio de competencia actualizado recientemente (últimas 24h)
      const recentlyUpdated = await Product.countDocuments({
        'pricing.competitorPriceUpdatedAt': {
          $gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      });

      // Productos con precio de competencia
      const withCompetitorPrice = await Product.countDocuments({
        'pricing.competitorPrice': { $gt: 0 },
      });

      // Productos donde nuestro precio es competitivo (dentro del rango)
      const competitive = await Product.countDocuments({
        $expr: {
          $and: [
            { $gt: ['$pricing.competitorPrice', 0] },
            { $gt: ['$amz_price', 0] },
            { $lte: ['$amz_price', '$pricing.competitorPrice'] },
          ],
        },
      });

      // Promedio de diferencia con competencia
      const avgDifferenceResult = await Product.aggregate([
        {
          $match: {
            'pricing.competitorPrice': { $gt: 0 },
            amz_price: { $gt: 0 },
          },
        },
        {
          $group: {
            _id: null,
            avgDifference: {
              $avg: {
                $subtract: ['$pricing.competitorPrice', '$amz_price'],
              },
            },
          },
        },
      ]);

      const avgDifference = avgDifferenceResult[0]?.avgDifference || 0;

      return {
        recentlyUpdated,
        withCompetitorPrice,
        competitive,
        avgDifference: Number(avgDifference.toFixed(2)),
        competitivePercentage:
          withCompetitorPrice > 0
            ? Number(((competitive / withCompetitorPrice) * 100).toFixed(1))
            : 0,
      };
    } catch (error) {
      logger.error('Error getting competitor monitoring stats:', error);
      throw error;
    }
  }
}

module.exports = new CompetitorMonitor();
