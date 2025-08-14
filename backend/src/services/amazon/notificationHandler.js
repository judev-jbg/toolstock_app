const pricingEngine = require('../pricing/pricingEngine');
const Product = require('../../models/productModel');
const logger = require('../../utils/logger');

class NotificationHandler {
  /**
   * Procesa notificación ANY_OFFER_CHANGED
   */
  async handleOfferChanged(notification) {
    try {
      const { payload } = notification;
      const { summary, offers } = payload;

      logger.info('Processing ANY_OFFER_CHANGED notification:', {
        asin: summary?.asin,
        offersCount: offers?.length || 0,
      });

      // Buscar producto por ASIN
      const product = await Product.findOne({
        amz_asin: summary?.asin,
      });

      if (!product) {
        logger.warn(`Product not found for ASIN: ${summary?.asin}`);
        return;
      }

      // Extraer datos de competencia
      const competitorData = this.extractCompetitorData(offers, product);

      // Actualizar datos de competencia en el producto
      await this.updateProductCompetitorData(product, competitorData);

      // Procesar con el motor de pricing
      const result = await pricingEngine.processProduct(product, {
        trigger: 'competitor_price_change',
        source: 'amazon_notification',
        urgency: 'high',
        competitorData: competitorData,
      });

      logger.info(`Notification processed for ${product.erp_sku}:`, {
        asin: summary?.asin,
        previousPrice: result.decision?.metadata?.competitorData?.previousCompetitorPrice,
        newPrice: competitorData.competitorPrice,
        actionTaken: result.success,
      });

      return result;
    } catch (error) {
      logger.error('Error handling offer changed notification:', error);
      throw error;
    }
  }

  /**
   * Procesa notificación PRICING_HEALTH
   */
  async handlePricingHealth(notification) {
    try {
      const { payload } = notification;
      const { sellerSku, asin } = payload;

      logger.info('Processing PRICING_HEALTH notification:', {
        sellerSku,
        asin,
      });

      // Buscar producto
      const product = await Product.findOne({
        $or: [{ amz_sellerSku: sellerSku }, { amz_asin: asin }],
      });

      if (!product) {
        logger.warn(`Product not found for SKU/ASIN: ${sellerSku}/${asin}`);
        return;
      }

      // Marcar que perdimos el buybox
      await Product.findByIdAndUpdate(product._id, {
        'pricing.competitorData.hasBuybox': false,
        'pricing.pricingStatus': 'competitor_alert',
        'pricing.pricingStatusMessage': 'Perdimos el buybox por precio no competitivo',
        'pricing.pricingStatusUpdatedAt': new Date(),
      });

      // Procesar con el motor de pricing
      const result = await pricingEngine.processProduct(product, {
        trigger: 'buybox_lost',
        source: 'amazon_notification',
        urgency: 'critical',
      });

      logger.info(`PRICING_HEALTH processed for ${product.erp_sku}:`, {
        actionTaken: result.success,
      });

      return result;
    } catch (error) {
      logger.error('Error handling pricing health notification:', error);
      throw error;
    }
  }

  /**
   * Extrae datos de competencia de las ofertas
   */
  extractCompetitorData(offers, product) {
    try {
      if (!offers || offers.length === 0) {
        return {
          competitorPrice: null,
          hasBuybox: false,
          buyboxPrice: null,
          lowestPrice: null,
          totalOffers: 0,
          lastChecked: new Date(),
        };
      }

      // Buscar nuestra oferta
      const ourOffer = offers.find(
        (offer) =>
          offer.sellerId === process.env.AMAZON_SELLER_ID ||
          offer.sellerSku === product.amz_sellerSku
      );

      // Filtrar ofertas de otros vendedores
      const competitorOffers = offers.filter(
        (offer) =>
          offer.sellerId !== process.env.AMAZON_SELLER_ID &&
          offer.sellerSku !== product.amz_sellerSku
      );

      if (competitorOffers.length === 0) {
        return {
          competitorPrice: null,
          hasBuybox: !!ourOffer?.isBuyBoxWinner,
          buyboxPrice: ourOffer?.listingPrice?.amount || null,
          lowestPrice: ourOffer?.listingPrice?.amount || null,
          totalOffers: offers.length,
          lastChecked: new Date(),
        };
      }

      // Encontrar precio más bajo de la competencia
      const competitorPrices = competitorOffers
        .map((offer) => offer.listingPrice?.amount)
        .filter((price) => price && price > 0)
        .sort((a, b) => a - b);

      const lowestCompetitorPrice = competitorPrices[0] || null;

      // Encontrar quien tiene el buybox
      const buyboxWinner = offers.find((offer) => offer.isBuyBoxWinner);
      const buyboxPrice = buyboxWinner?.listingPrice?.amount || null;
      const hasBuybox = buyboxWinner?.sellerId === process.env.AMAZON_SELLER_ID;

      return {
        competitorPrice: lowestCompetitorPrice,
        hasBuybox: hasBuybox,
        buyboxPrice: buyboxPrice,
        lowestPrice: Math.min(...competitorPrices, ourOffer?.listingPrice?.amount || Infinity),
        totalOffers: offers.length,
        lastChecked: new Date(),
        offers: competitorOffers.slice(0, 5), // Guardar top 5 para referencia
      };
    } catch (error) {
      logger.error('Error extracting competitor data:', error);
      return {
        competitorPrice: null,
        hasBuybox: false,
        buyboxPrice: null,
        lowestPrice: null,
        totalOffers: 0,
        lastChecked: new Date(),
      };
    }
  }

  /**
   * Actualiza datos de competencia en el producto
   */
  async updateProductCompetitorData(product, competitorData) {
    try {
      const updateData = {
        'pricing.competitorPrice': competitorData.competitorPrice,
        'pricing.competitorPriceUpdatedAt': competitorData.lastChecked,
        'pricing.competitorData': competitorData,
      };

      await Product.findByIdAndUpdate(product._id, updateData);

      logger.debug(`Competitor data updated for ${product.erp_sku}:`, {
        competitorPrice: competitorData.competitorPrice,
        hasBuybox: competitorData.hasBuybox,
        totalOffers: competitorData.totalOffers,
      });
    } catch (error) {
      logger.error(`Error updating competitor data for ${product.erp_sku}:`, error);
      throw error;
    }
  }

  /**
   * Procesa notificaciones en lote (para cuando se acumulan)
   */
  async processBatchNotifications(notifications) {
    try {
      logger.info(`Processing batch of ${notifications.length} notifications`);

      const results = {
        processed: 0,
        successful: 0,
        failed: 0,
        errors: [],
      };

      for (const notification of notifications) {
        try {
          let result = null;

          switch (notification.notificationType) {
            case 'ANY_OFFER_CHANGED':
              result = await this.handleOfferChanged(notification);
              break;
            case 'PRICING_HEALTH':
              result = await this.handlePricingHealth(notification);
              break;
            default:
              logger.warn(`Unknown notification type: ${notification.notificationType}`);
              continue;
          }

          if (result?.success) {
            results.successful++;
          } else {
            results.failed++;
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            notification: notification.notificationType,
            error: error.message,
          });
        }

        results.processed++;
      }

      logger.info('Batch notification processing completed:', results);
      return results;
    } catch (error) {
      logger.error('Error processing batch notifications:', error);
      throw error;
    }
  }
}

module.exports = new NotificationHandler();
