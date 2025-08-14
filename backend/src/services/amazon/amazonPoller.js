const amazonService = require('./amazonService');
const Product = require('../../models/productModel');
const pricingEngine = require('../pricing/pricingEngine');
const logger = require('../../utils/logger');

class AmazonPoller {
  constructor() {
    this.isPolling = false;
    this.pollInterval = null;
    this.lastPollTime = null;
    this.pollFrequency = 5 * 60 * 1000; // 5 minutos por defecto
  }

  /**
   * Inicia el polling de datos de Amazon
   */
  async startPolling(frequency = this.pollFrequency) {
    try {
      if (this.isPolling) {
        logger.warn('Polling already running');
        return;
      }

      this.pollFrequency = frequency;
      this.isPolling = true;

      logger.info(`Starting Amazon polling every ${frequency / 1000} seconds`);

      // Ejecutar inmediatamente
      await this.executePollingCycle();

      // Programar ejecuciones periódicas
      this.pollInterval = setInterval(async () => {
        try {
          await this.executePollingCycle();
        } catch (error) {
          logger.error('Error in polling cycle:', error);
        }
      }, frequency);
    } catch (error) {
      logger.error('Error starting polling:', error);
      this.isPolling = false;
      throw error;
    }
  }

  /**
   * Detiene el polling
   */
  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
    logger.info('Amazon polling stopped');
  }

  /**
   * Ejecuta un ciclo de polling
   */
  async executePollingCycle() {
    try {
      const startTime = new Date();
      logger.info('Starting polling cycle');

      // 1. Obtener productos con datos de Amazon
      const productsToCheck = await this.getProductsToCheck();

      if (productsToCheck.length === 0) {
        logger.info('No products to check in this cycle');
        return;
      }

      // 2. Verificar ofertas competitivas (simular ANY_OFFER_CHANGED)
      const offerChanges = await this.checkOfferChanges(productsToCheck);

      // 3. Verificar estado de buybox (simular PRICING_HEALTH)
      const pricingHealthChanges = await this.checkPricingHealth(productsToCheck);

      // 4. Procesar cambios detectados
      await this.processDetectedChanges([...offerChanges, ...pricingHealthChanges]);

      const endTime = new Date();
      const duration = endTime - startTime;

      this.lastPollTime = endTime;

      logger.info(`Polling cycle completed in ${duration}ms`, {
        productsChecked: productsToCheck.length,
        offerChanges: offerChanges.length,
        pricingHealthChanges: pricingHealthChanges.length,
      });
    } catch (error) {
      logger.error('Error in polling cycle:', error);
      throw error;
    }
  }

  /**
   * Obtiene productos que necesitan verificación
   */
  async getProductsToCheck() {
    try {
      // Priorizar productos que:
      // 1. Tienen ASIN y datos de Amazon
      // 2. No han sido verificados recientemente
      // 3. Tienen estado activo

      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const products = await Product.find({
        amz_asin: { $exists: true, $ne: '' },
        amz_status: { $ne: 'Inactive' },
        $or: [
          { 'pricing.competitorData.lastChecked': { $lt: oneHourAgo } },
          { 'pricing.competitorData.lastChecked': { $exists: false } },
        ],
      })
        .select('_id erp_sku amz_asin amz_sellerSku amz_price pricing')
        .limit(50) // Procesar máximo 50 productos por ciclo
        .lean();

      return products;
    } catch (error) {
      logger.error('Error getting products to check:', error);
      return [];
    }
  }

  /**
   * Simula detección de cambios de ofertas (ANY_OFFER_CHANGED)
   */
  async checkOfferChanges(products) {
    const changes = [];

    try {
      // En lugar de recibir notificaciones, hacemos polling de competitive pricing
      for (const product of products.slice(0, 10)) {
        // Limitar a 10 por ciclo para evitar rate limits
        try {
          // Usar el API de Amazon para obtener información competitiva
          const competitiveData = await this.getCompetitivePricing(product.amz_asin);

          if (competitiveData && this.hasOfferChanged(product, competitiveData)) {
            changes.push({
              type: 'offer_changed',
              product: product,
              competitiveData: competitiveData,
              timestamp: new Date(),
            });
          }

          // Pequeña pausa para evitar rate limiting
          await this.sleep(200);
        } catch (error) {
          logger.warn(`Error checking offers for ${product.erp_sku}:`, error.message);
        }
      }
    } catch (error) {
      logger.error('Error checking offer changes:', error);
    }

    return changes;
  }

  /**
   * Obtiene datos competitivos usando Amazon SP-API
   */
  async getCompetitivePricing(asin) {
    try {
      // Usar el método de Amazon para obtener información competitiva
      // Esto simularía lo que normalmente vendría en ANY_OFFER_CHANGED

      const result = (await amazonService.getCompetitiveSummary)
        ? await amazonService.getCompetitiveSummary(asin)
        : await this.simulateCompetitiveData(asin);

      return this.parseCompetitiveData(result);
    } catch (error) {
      logger.debug(`Could not get competitive data for ASIN ${asin}:`, error.message);
      return null;
    }
  }

  /**
   * Simula datos competitivos para desarrollo/testing
   */
  async simulateCompetitiveData(asin) {
    // Simular datos aleatorios para testing
    const basePrice = 50 + Math.random() * 100;
    const variation = (Math.random() - 0.5) * 10; // Variación de ±5€

    return {
      asin: asin,
      competitivePrice: Math.max(10, basePrice + variation),
      buyboxPrice: basePrice + variation + Math.random() * 5,
      offerCount: Math.floor(Math.random() * 20) + 1,
      timestamp: new Date(),
    };
  }

  /**
   * Procesa datos competitivos para determinar cambios
   */
  parseCompetitiveData(competitiveResult) {
    if (!competitiveResult) return null;

    // Extraer información relevante del resultado
    return {
      competitorPrice: competitiveResult.competitivePrice || null,
      buyboxPrice: competitiveResult.buyboxPrice || null,
      lowestPrice: competitiveResult.competitivePrice || null,
      totalOffers: competitiveResult.offerCount || 0,
      hasBuybox: false, // Se determina comparando precios
      lastChecked: new Date(),
    };
  }

  /**
   * Determina si ha habido cambios significativos en ofertas
   */
  hasOfferChanged(product, newCompetitiveData) {
    const currentCompetitorPrice = product.pricing?.competitorPrice;
    const newCompetitorPrice = newCompetitiveData?.competitorPrice;

    if (!currentCompetitorPrice && newCompetitorPrice) {
      return true; // Primer dato de competencia
    }

    if (currentCompetitorPrice && newCompetitorPrice) {
      const priceChange = Math.abs(currentCompetitorPrice - newCompetitorPrice);
      const percentageChange = (priceChange / currentCompetitorPrice) * 100;

      // Considerar cambio significativo si es mayor al 2% o 1€
      return priceChange >= 1.0 || percentageChange >= 2.0;
    }

    return false;
  }

  /**
   * Simula detección de cambios de pricing health
   */
  async checkPricingHealth(products) {
    const changes = [];

    try {
      for (const product of products) {
        // Simular pérdida de buybox basado en precio vs competencia
        const currentPrice = product.amz_price || 0;
        const competitorPrice = product.pricing?.competitorPrice;

        if (competitorPrice && currentPrice > 0) {
          const hadBuybox = product.pricing?.competitorData?.hasBuybox || false;
          const shouldHaveBuybox = currentPrice <= competitorPrice * 1.05; // 5% de tolerancia

          if (hadBuybox && !shouldHaveBuybox) {
            changes.push({
              type: 'pricing_health',
              product: product,
              reason: 'price_not_competitive',
              competitorPrice: competitorPrice,
              currentPrice: currentPrice,
              timestamp: new Date(),
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error checking pricing health:', error);
    }

    return changes;
  }

  /**
   * Procesa los cambios detectados
   */
  async processDetectedChanges(changes) {
    if (changes.length === 0) return;

    logger.info(`Processing ${changes.length} detected changes`);

    for (const change of changes) {
      try {
        switch (change.type) {
          case 'offer_changed':
            await this.processOfferChange(change);
            break;
          case 'pricing_health':
            await this.processPricingHealthChange(change);
            break;
        }
      } catch (error) {
        logger.error(`Error processing change for ${change.product.erp_sku}:`, error);
      }
    }
  }

  /**
   * Procesa cambio de oferta
   */
  async processOfferChange(change) {
    const { product, competitiveData } = change;

    // Actualizar datos de competencia
    await Product.findByIdAndUpdate(product._id, {
      'pricing.competitorPrice': competitiveData.competitorPrice,
      'pricing.competitorPriceUpdatedAt': new Date(),
      'pricing.competitorData': competitiveData,
    });

    // Procesar con el motor de pricing
    const updatedProduct = await Product.findById(product._id);
    await pricingEngine.processProduct(updatedProduct, {
      trigger: 'competitor_price_change_detected',
      source: 'amazon_polling',
      urgency: 'high',
    });

    logger.info(`Offer change processed for ${product.erp_sku}:`, {
      newCompetitorPrice: competitiveData.competitorPrice,
    });
  }

  /**
   * Procesa cambio de pricing health
   */
  async processPricingHealthChange(change) {
    const { product, reason } = change;

    // Marcar pérdida de buybox
    await Product.findByIdAndUpdate(product._id, {
      'pricing.competitorData.hasBuybox': false,
      'pricing.pricingStatus': 'competitor_alert',
      'pricing.pricingStatusMessage': `Buybox perdido: ${reason}`,
      'pricing.pricingStatusUpdatedAt': new Date(),
    });

    // Procesar con el motor de pricing
    const updatedProduct = await Product.findById(product._id);
    await pricingEngine.processProduct(updatedProduct, {
      trigger: 'buybox_lost_detected',
      source: 'amazon_polling',
      urgency: 'critical',
    });

    logger.info(`Pricing health change processed for ${product.erp_sku}:`, {
      reason: reason,
    });
  }

  /**
   * Utilidad para pausas
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Obtiene estadísticas del polling
   */
  getStats() {
    return {
      isPolling: this.isPolling,
      pollFrequency: this.pollFrequency,
      lastPollTime: this.lastPollTime,
      nextPollTime:
        this.isPolling && this.lastPollTime
          ? new Date(this.lastPollTime.getTime() + this.pollFrequency)
          : null,
    };
  }
}

module.exports = new AmazonPoller();
