const cron = require('node-cron');
const pvpmCalculator = require('../pricing/pvpmCalculator');
const priceUpdater = require('../pricing/priceUpdater');
const competitorMonitor = require('../pricing/competitorMonitor');
const Product = require('../../models/productModel');
const logger = require('../../utils/logger').createLogger('pricingScheduler');

class PricingScheduler {
  constructor() {
    this.jobs = new Map();
  }

  init() {
    this.setupScheduledJobs();
  }

  setupScheduledJobs() {
    // Recálculo de PVPM diario a las 6:00 AM
    this.jobs.set(
      'pvpm-recalculation',
      cron.schedule(
        '0 6 * * *',
        async () => {
          try {
            logger.info('Starting scheduled PVPM recalculation...');
            await this.recalculateAllPVPM();
          } catch (error) {
            logger.error('Error in scheduled PVPM recalculation:', error);
          }
        },
        { scheduled: false }
      )
    );

    // Monitoreo de precios de competencia cada 30 minutos
    this.jobs.set(
      'competitor-monitoring',
      cron.schedule(
        '*/30 * * * *',
        async () => {
          try {
            logger.info('Starting competitor price monitoring...');
            await this.monitorCompetitorPrices();
          } catch (error) {
            logger.error('Error in competitor monitoring:', error);
          }
        },
        { scheduled: false }
      )
    );

    // Actualización de precios por debajo del PVPM cada 2 horas
    this.jobs.set(
      'below-pvpm-correction',
      cron.schedule(
        '0 */2 * * *',
        async () => {
          try {
            logger.info('Starting below-PVPM price correction...');
            await this.correctBelowPVPMPrices();
          } catch (error) {
            logger.error('Error in below-PVPM correction:', error);
          }
        },
        { scheduled: false }
      )
    );

    // Iniciar todos los jobs
    this.jobs.forEach((job, name) => {
      job.start();
      logger.info(`Started pricing job: ${name}`);
    });
  }

  async recalculateAllPVPM() {
    try {
      const products = await Product.find({
        'pricing.autoUpdateEnabled': { $ne: false },
      });

      const results = await pvpmCalculator.recalculateBulkPVPM(products);

      // Actualizar PVPM en base de datos
      const bulkUpdates = results.success.map((result) => ({
        updateOne: {
          filter: { _id: result.productId },
          update: {
            'pricing.pvpm': result.newPvpm,
            'pricing.lastPriceUpdate': new Date(),
          },
        },
      }));

      if (bulkUpdates.length > 0) {
        await Product.bulkWrite(bulkUpdates);
      }

      logger.info(
        `PVPM recalculation completed: ${results.success.length} successful, ${results.errors.length} errors`
      );
      return results;
    } catch (error) {
      logger.error('Error in PVPM recalculation:', error);
      throw error;
    }
  }

  async monitorCompetitorPrices() {
    try {
      // Obtener productos activos con ASIN
      const products = await Product.find({
        amz_asin: { $exists: true, $ne: '' },
        'pricing.autoUpdateEnabled': { $ne: false },
        amz_status: 'Active',
      }).limit(50); // Limitar para evitar rate limiting

      let updatedCount = 0;

      for (const product of products) {
        try {
          const competitorPrices = await competitorMonitor.getCompetitorPrices(product.amz_asin);

          if (competitorPrices.length > 0) {
            const lowestPrice = competitorPrices[0].price;

            // Actualizar precio de competencia
            await Product.findByIdAndUpdate(product._id, {
              'pricing.competitorPrice': lowestPrice,
              'pricing.competitorPriceUpdatedAt': new Date(),
            });

            // Evaluar actualización de precio
            await competitorMonitor.evaluatePriceUpdate(product, lowestPrice);
            updatedCount++;
          }

          // Pausa para evitar rate limiting
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (error) {
          logger.error(`Error monitoring competitor for ${product.erp_sku}:`, error);
        }
      }

      logger.info(`Competitor monitoring completed: ${updatedCount} products updated`);
    } catch (error) {
      logger.error('Error in competitor monitoring:', error);
      throw error;
    }
  }

  async correctBelowPVPMPrices() {
    try {
      // Buscar productos con precio por debajo del PVPM
      const products = await Product.find({
        $expr: {
          $and: [{ $gt: ['$pricing.pvpm', 0] }, { $lt: ['$amz_price', '$pricing.pvpm'] }],
        },
        'pricing.autoUpdateEnabled': { $ne: false },
      });

      const priceUpdates = products.map((product) => ({
        productId: product._id,
        newPrice: product.pricing.pvpm,
        reason: 'pvpm_correction',
        userId: 'system',
      }));

      if (priceUpdates.length > 0) {
        await priceUpdater.bulkUpdatePrices(priceUpdates);
        logger.info(`Below-PVPM correction completed: ${priceUpdates.length} products corrected`);
      } else {
        logger.info('No products found below PVPM');
      }
    } catch (error) {
      logger.error('Error in below-PVPM correction:', error);
      throw error;
    }
  }

  // Métodos para control manual
  async forceRecalculatePVPM() {
    logger.info('Force PVPM recalculation triggered');
    return await this.recalculateAllPVPM();
  }

  async forceCompetitorMonitoring() {
    logger.info('Force competitor monitoring triggered');
    return await this.monitorCompetitorPrices();
  }

  async forceBelowPVPMCorrection() {
    logger.info('Force below-PVPM correction triggered');
    return await this.correctBelowPVPMPrices();
  }

  getJobsStatus() {
    const status = {};
    this.jobs.forEach((job, name) => {
      status[name] = {
        running: job.running,
        lastDate: job.lastDate,
        nextDate: job.nextDate,
      };
    });
    return status;
  }

  stopAll() {
    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info(`Stopped pricing job: ${name}`);
    });
  }
}

module.exports = new PricingScheduler();
