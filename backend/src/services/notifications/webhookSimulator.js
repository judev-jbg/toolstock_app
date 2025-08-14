// backend/src/services/notifications/webhookSimulator.js - NUEVO ARCHIVO
const pricingEngine = require('../pricing/pricingEngine');
const Product = require('../../models/productModel');
const logger = require('../../utils/logger');

class WebhookSimulator {
  constructor() {
    this.activeWebhooks = new Map();
    this.simulationInterval = null;
  }

  /**
   * Inicia la simulación de webhooks para desarrollo
   */
  startSimulation(intervalMs = 10 * 60 * 1000) {
    // 10 minutos por defecto
    if (this.simulationInterval) {
      logger.warn('Webhook simulation already running');
      return;
    }

    logger.info(`Starting webhook simulation every ${intervalMs / 1000} seconds`);

    this.simulationInterval = setInterval(async () => {
      try {
        await this.generateRandomNotification();
      } catch (error) {
        logger.error('Error in webhook simulation:', error);
      }
    }, intervalMs);
  }

  /**
   * Detiene la simulación
   */
  stopSimulation() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
      logger.info('Webhook simulation stopped');
    }
  }

  /**
   * Genera una notificación aleatoria para testing
   */
  async generateRandomNotification() {
    try {
      // Obtener un producto aleatorio con datos de Amazon
      const randomProduct = await Product.findOne({
        amz_asin: { $exists: true, $ne: '' },
        amz_price: { $gt: 0 },
      });

      if (!randomProduct) {
        logger.debug('No products found for webhook simulation');
        return;
      }

      const notificationType = Math.random() > 0.7 ? 'PRICING_HEALTH' : 'ANY_OFFER_CHANGED';

      let notification;
      if (notificationType === 'ANY_OFFER_CHANGED') {
        notification = this.generateOfferChangedNotification(randomProduct);
      } else {
        notification = this.generatePricingHealthNotification(randomProduct);
      }

      logger.info(`Simulating ${notificationType} notification for ${randomProduct.erp_sku}`);

      // Procesar la notificación simulada
      await this.processSimulatedNotification(notification);
    } catch (error) {
      logger.error('Error generating random notification:', error);
    }
  }

  /**
   * Genera notificación ANY_OFFER_CHANGED simulada
   */
  generateOfferChangedNotification(product) {
    const basePrice = product.amz_price || 50;
    const variation = (Math.random() - 0.5) * basePrice * 0.2; // Variación del ±10%
    const newCompetitorPrice = Math.max(10, basePrice + variation);

    return {
      notificationType: 'ANY_OFFER_CHANGED',
      eventTime: new Date().toISOString(),
      payload: {
        summary: {
          asin: product.amz_asin,
          marketplaceId: process.env.AMAZON_MARKETPLACE_ID || 'A1RKKUPIHCS9HS',
        },
        offers: [
          {
            sellerId: 'COMPETITOR_001',
            sellerSku: 'COMP_' + product.erp_sku,
            listingPrice: {
              amount: newCompetitorPrice,
              currencyCode: 'EUR',
            },
            isBuyBoxWinner: Math.random() > 0.5,
            condition: 'new',
          },
          {
            sellerId: process.env.AMAZON_SELLER_ID || 'OUR_SELLER_ID',
            sellerSku: product.amz_sellerSku || product.erp_sku,
            listingPrice: {
              amount: product.amz_price,
              currencyCode: 'EUR',
            },
            isBuyBoxWinner: Math.random() > 0.3,
            condition: 'new',
          },
        ],
      },
    };
  }

  /**
   * Genera notificación PRICING_HEALTH simulada
   */
  generatePricingHealthNotification(product) {
    return {
      notificationType: 'PRICING_HEALTH',
      eventTime: new Date().toISOString(),
      payload: {
        sellerSku: product.amz_sellerSku || product.erp_sku,
        asin: product.amz_asin,
        marketplaceId: process.env.AMAZON_MARKETPLACE_ID || 'A1RKKUPIHCS9HS',
        issueType: 'UNCOMPETITIVE_PRICE',
        offerChangeTrigger: {
          marketplaceId: process.env.AMAZON_MARKETPLACE_ID,
          asin: product.amz_asin,
          itemCondition: 'new',
          timeOfOfferChange: new Date().toISOString(),
        },
      },
    };
  }

  /**
   * Procesa una notificación simulada
   */
  async processSimulatedNotification(notification) {
    try {
      // Usar el mismo handler que usaríamos para notificaciones reales
      const notificationHandler = require('../amazon/notificationHandler');

      switch (notification.notificationType) {
        case 'ANY_OFFER_CHANGED':
          await notificationHandler.handleOfferChanged(notification);
          break;
        case 'PRICING_HEALTH':
          await notificationHandler.handlePricingHealth(notification);
          break;
      }
    } catch (error) {
      logger.error('Error processing simulated notification:', error);
    }
  }

  /**
   * Simula una notificación específica para un producto
   */
  async simulateNotificationForProduct(productId, notificationType = 'ANY_OFFER_CHANGED') {
    try {
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Product not found');
      }

      let notification;
      if (notificationType === 'ANY_OFFER_CHANGED') {
        notification = this.generateOfferChangedNotification(product);
      } else if (notificationType === 'PRICING_HEALTH') {
        notification = this.generatePricingHealthNotification(product);
      } else {
        throw new Error(`Unsupported notification type: ${notificationType}`);
      }

      await this.processSimulatedNotification(notification);

      logger.info(`Simulated ${notificationType} for product ${product.erp_sku}`);
      return notification;
    } catch (error) {
      logger.error(`Error simulating notification for product ${productId}:`, error);
      throw error;
    }
  }

  /**
   * Registra un webhook real (para cuando esté disponible SQS)
   */
  registerWebhook(endpoint, notificationTypes) {
    const webhookId = `webhook_${Date.now()}`;

    this.activeWebhooks.set(webhookId, {
      endpoint,
      notificationTypes,
      registeredAt: new Date(),
      isActive: true,
    });

    logger.info(`Webhook registered: ${webhookId}`, {
      endpoint,
      notificationTypes,
    });

    return webhookId;
  }

  /**
   * Desregistra un webhook
   */
  unregisterWebhook(webhookId) {
    const removed = this.activeWebhooks.delete(webhookId);
    if (removed) {
      logger.info(`Webhook unregistered: ${webhookId}`);
    }
    return removed;
  }

  /**
   * Obtiene estadísticas de webhooks
   */
  getStats() {
    return {
      simulationActive: !!this.simulationInterval,
      activeWebhooks: this.activeWebhooks.size,
      webhooks: Array.from(this.activeWebhooks.entries()).map(([id, webhook]) => ({
        id,
        ...webhook,
      })),
    };
  }
}

module.exports = new WebhookSimulator();
