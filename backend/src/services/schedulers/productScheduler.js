const schedule = require('node-schedule');
const amazonService = require('../amazon/amazonService');
const erpSyncService = require('../erp/erpSyncService');
const logger = require('../../utils/logger');
const Product = require('../../models/productModel');

class ProductScheduler {
  constructor() {
    this.jobs = new Map();
  }

  /**
   * Inicializa los trabajos programados
   */
  init() {
    this.scheduleMilwaukeeStockUpdates();
    this.scheduleErpSync();
    this.scheduleProductSync();
    this.scheduleHealthCheck();

    logger.info('Product scheduler initialized');
  }

  scheduleErpSync() {
    // Sincronización ERP cada hora (ej: 08:00, 09:00, etc.)
    const erpSyncJob = schedule.scheduleJob('erp-sync', '0 8-16 * * *', async () => {
      try {
        logger.info('Starting scheduled ERP synchronization...');
        const results = await erpSyncService.syncProducts();
        logger.info('ERP synchronization completed:', results);
      } catch (error) {
        logger.error('Error in scheduled ERP sync:', error);
      }
    });

    this.jobs.set('erp-sync', erpSyncJob);
    logger.info('ERP sync scheduled every hour');
  }

  /**
   * Programa la sincronización automática de productos
   * Se ejecuta cada 1 hora
   */
  scheduleProductSync() {
    const job = schedule.scheduleJob('10 8-16/1 * * *', async () => {
      try {
        logger.info('Starting scheduled product synchronization...');
        const results = await amazonService.syncProductsWithDatabase();
        logger.info('Scheduled product sync completed:', results);
      } catch (error) {
        logger.error('Error in scheduled product sync:', error);
      }
    });

    this.jobs.set('productSync', job);
    logger.info('Product sync scheduled every 1 hour');
  }

  /**
   * Programa las actualizaciones automáticas de stock para productos MILWAUKEE
   */
  scheduleMilwaukeeStockUpdates() {
    // Tarea para ACTIVAR stock (Viernes (5) a las 17:00) | Solo los Viernes (5) a las 17:00
    const activateStockJob = schedule.scheduleJob(
      'milwaukee-activate-stock',
      '0 17 * * 5',
      async () => {
        try {
          logger.info('Starting scheduled MILWAUKEE stock activation (stock = 10)...');
          await this.updateMilwaukeeStock(10, 'activate');
          logger.info('MILWAUKEE stock activation completed successfully');
        } catch (error) {
          logger.error('Error in scheduled MILWAUKEE stock activation:', error);
        }
      }
    );

    // Tarea para DESACTIVAR stock (Lunes (1) a las 05:00 | Solo los Lunes (1) a las 05:00 )
    const deactivateStockJob = schedule.scheduleJob(
      'milwaukee-deactivate-stock',
      '0 5 * * 1',
      async () => {
        try {
          logger.info('Starting scheduled MILWAUKEE stock deactivation (stock = 0)...');
          await this.updateMilwaukeeStock(0, 'deactivate');
          logger.info('MILWAUKEE stock deactivation completed successfully');
        } catch (error) {
          logger.error('Error in scheduled MILWAUKEE stock deactivation:', error);
        }
      }
    );

    this.jobs.set('milwaukee-activate-stock', activateStockJob);
    this.jobs.set('milwaukee-deactivate-stock', deactivateStockJob);

    logger.info('MILWAUKEE stock update schedules initialized:');
    logger.info('- Activate stock (10): Friday at 17:00');
    logger.info('- Deactivate stock (0): Monday at 05:00');
  }

  /**
   * Actualiza el stock de productos MILWAUKEE
   * @param {number} quantity - Cantidad de stock a establecer
   * @param {string} action - 'activate' o 'deactivate' para logging
   */
  async updateMilwaukeeStock(quantity, action) {
    try {
      // Buscar productos MILWAUKEE con ASIN válido Y sellerSku válido
      const milwaukeeProducts = await Product.find({
        erp_manufacturer: 'MILWAUKEE',
        amz_asin: { $ne: '', $exists: true, $ne: null },
        amz_sellerSku: { $ne: '', $exists: true, $ne: null }, // Asegurar que tenga SKU de Amazon
      }).select('_id erp_sku amz_sellerSku amz_asin erp_name amz_quantity');

      if (milwaukeeProducts.length === 0) {
        logger.info('No MILWAUKEE products found with valid ASIN and Amazon SKU');
        return;
      }

      logger.info(`Found ${milwaukeeProducts.length} MILWAUKEE products to ${action}`);

      // Preparar actualizaciones directamente para Amazon
      const amazonUpdates = milwaukeeProducts.map((product) => ({
        sellerSku: product.amz_sellerSku,
        quantity: quantity,
      }));

      // Usar directamente el servicio de Amazon
      const amazonService = require('../amazon/amazonService');
      const results = await amazonService.bulkUpdateInventory(amazonUpdates);

      // Log de resultados
      logger.info(`MILWAUKEE stock ${action} results:`, {
        total: amazonUpdates.length,
        successful: results.success.length,
        failed: results.errors.length,
      });

      if (results.errors.length > 0) {
        logger.warn(`${results.errors.length} MILWAUKEE products failed to update in Amazon`);
        results.errors.forEach((error) => {
          logger.warn(`Failed SKU ${error.sellerSku}: ${error.error}`);
        });
      }

      // Actualizar la base de datos local para los productos exitosos
      if (results.success.length > 0) {
        const successfulSkus = results.success.map((s) => s.sellerSku);

        const updateResult = await Product.updateMany(
          {
            amz_sellerSku: { $in: successfulSkus },
            erp_manufacturer: 'MILWAUKEE',
          },
          {
            amz_quantity: quantity,
            amz_lastInventoryUpdate: new Date(),
            amz_syncStatus: 'synced',
            amz_syncError: '',
          }
        );

        logger.info(`Updated ${updateResult.modifiedCount} products in local database`);
      }

      // Actualizar productos con errores en la base de datos
      if (results.errors.length > 0) {
        const errorSkus = results.errors.map((e) => e.sellerSku);

        await Product.updateMany(
          {
            amz_sellerSku: { $in: errorSkus },
            erp_manufacturer: 'MILWAUKEE',
          },
          {
            amz_syncStatus: 'error',
            amz_syncError: 'Error en actualización automática de stock',
            amz_lastInventoryUpdate: new Date(),
          }
        );
      }

      // Log resumen
      const productsSummary = milwaukeeProducts.slice(0, 5).map((p) => ({
        sku: p.amz_sellerSku,
        name: p.erp_name ? p.erp_name.substring(0, 30) + '...' : 'Sin nombre',
        previousStock: p.amz_quantity || 0,
        newStock: quantity,
      }));

      logger.info(`MILWAUKEE ${action} summary (first 5 products):`, productsSummary);

      if (milwaukeeProducts.length > 5) {
        logger.info(`... and ${milwaukeeProducts.length - 5} more products`);
      }

      return {
        total: amazonUpdates.length,
        successful: results.success.length,
        failed: results.errors.length,
        details: results,
      };
    } catch (error) {
      logger.error(`Error updating MILWAUKEE stock (${action}):`, error);
      throw error;
    }
  }

  /**
   * Ejecuta manualmente la actualización de stock MILWAUKEE (para testing)
   * @param {string} action - 'activate' (stock=10) o 'deactivate' (stock=0)
   */
  async forceMilwaukeeStockUpdate(action) {
    const quantity = action === 'activate' ? 10 : 0;
    logger.info(`Forcing MILWAUKEE stock ${action} (quantity: ${quantity})...`);
    return await this.updateMilwaukeeStock(quantity, action);
  }

  /**
   * Programa verificación de salud del sistema
   * Se ejecuta cada hora
   */
  scheduleHealthCheck() {
    const job = schedule.scheduleJob('0 * * * *', async () => {
      try {
        const needsSync = await amazonService.checkSyncNeeded();
        if (needsSync > 0) {
          logger.info(`Health check: ${needsSync} products need synchronization`);
        }
      } catch (error) {
        logger.error('Error in health check:', error);
      }
    });

    this.jobs.set('healthCheck', job);
    logger.info('Health check scheduled every hour');
  }

  /**
   * Programa sincronización rápida (solo para productos modificados recientemente)
   * Se ejecuta cada 30 minutos
   */
  scheduleQuickSync() {
    const job = schedule.scheduleJob('*/30 * * * *', async () => {
      try {
        logger.info('Starting quick sync for recently modified products...');
        // Aquí podrías implementar una sincronización más ligera
        // que solo procese productos modificados en las últimas horas
      } catch (error) {
        logger.error('Error in quick sync:', error);
      }
    });

    this.jobs.set('quickSync', job);
    logger.info('Quick sync scheduled every 30 minutes');
  }

  /**
   * Cancela un trabajo programado
   */
  cancelJob(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.cancel();
      this.jobs.delete(jobName);
      logger.info(`Job ${jobName} cancelled`);
    }
  }

  /**
   * Cancela todos los trabajos programados
   */
  cancelAllJobs() {
    for (const [name, job] of this.jobs) {
      try {
        job.cancel();
        logger.info(`Job ${name} cancelled`);
      } catch (error) {
        logger.error(`Error cancelling job ${name}:`, error);
      }
    }
    this.jobs.clear();
    logger.info('All scheduled jobs cancelled');
  }

  /**
   * Obtiene el estado de todos los trabajos
   */
  getJobsStatus() {
    const status = {};
    for (const [name, job] of this.jobs) {
      try {
        // pendingInvocations es una propiedad, no una función
        const pendingInvocations = job.pendingInvocations || [];

        // nextInvocation es una función que necesita ser llamada
        let nextInvocation = null;
        try {
          nextInvocation =
            typeof job.nextInvocation === 'function' ? job.nextInvocation() : job.nextInvocation;
        } catch (error) {
          logger.warn(`Error getting next invocation for job ${name}:`, error.message);
        }

        status[name] = {
          active: Array.isArray(pendingInvocations) ? pendingInvocations.length > 0 : false,
          nextInvocation: nextInvocation,
          rule: job.rule || 'No rule defined',
          running: job.running || false,
          name: job.name || name,
        };
      } catch (error) {
        logger.error(`Error getting status for job ${name}:`, error);
        status[name] = {
          active: false,
          nextInvocation: null,
          rule: 'Error getting status',
          running: false,
          name: name,
          error: error.message,
        };
      }
    }
    return status;
  }

  /**
   * Fuerza la ejecución de un trabajo específico
   */
  async forceJob(jobName) {
    switch (jobName) {
      case 'productSync':
        logger.info('Forcing product sync...');
        return await amazonService.syncProductsWithDatabase();
      case 'erp-sync':
        logger.info('Forcing ERP sync...');
        return await erpSyncService.syncProducts();
      case 'healthCheck':
        logger.info('Forcing health check...');
        return await amazonService.checkSyncNeeded();
      case 'milwaukee-activate':
        logger.info('Forcing MILWAUKEE stock activation...');
        return await this.forceMilwaukeeStockUpdate('activate');
      case 'milwaukee-deactivate':
        logger.info('Forcing MILWAUKEE stock deactivation...');
        return await this.forceMilwaukeeStockUpdate('deactivate');
      default:
        throw new Error(`Unknown job: ${jobName}`);
    }
  }

  /**
   * Debug: Mostrar información detallada de los jobs
   */
  debugJobs() {
    logger.info('=== JOB DEBUG INFO ===');
    for (const [name, job] of this.jobs) {
      logger.info(`Job: ${name}`);
      logger.info(`  Type: ${typeof job}`);
      logger.info(`  Constructor: ${job ? job.constructor.name : 'null'}`);
      logger.info(`  Keys: ${job ? Object.keys(job) : 'none'}`);
      if (job && job.nextInvocation) {
        logger.info(`  Next invocation type: ${typeof job.nextInvocation}`);
        if (typeof job.nextInvocation === 'function') {
          try {
            logger.info(`  Next invocation: ${job.nextInvocation()}`);
          } catch (e) {
            logger.info(`  Next invocation error: ${e.message}`);
          }
        } else {
          logger.info(`  Next invocation value: ${job.nextInvocation}`);
        }
      }
      logger.info('---');
    }
    logger.info('=== END DEBUG INFO ===');
  }
}

module.exports = new ProductScheduler();
