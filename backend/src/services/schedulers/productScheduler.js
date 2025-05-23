const schedule = require('node-schedule');
const amazonService = require('../amazon/amazonService');
const logger = require('../../utils/logger').createLogger('productScheduler');

class ProductScheduler {
  constructor() {
    this.jobs = new Map();
  }

  /**
   * Inicializa los trabajos programados
   */
  init() {
    if (process.env.NODE_ENV !== 'production') {
      logger.info('Scheduler disabled in development mode');
      return;
    }

    this.scheduleProductSync();
    this.scheduleHealthCheck();

    logger.info('Product scheduler initialized');
  }

  /**
   * Programa la sincronización automática de productos
   * Se ejecuta cada 6 horas
   */
  scheduleProductSync() {
    const job = schedule.scheduleJob('0 */6 * * *', async () => {
      try {
        logger.info('Starting scheduled product synchronization...');
        const results = await amazonService.syncProductsWithDatabase();
        logger.info('Scheduled product sync completed:', results);
      } catch (error) {
        logger.error('Error in scheduled product sync:', error);
      }
    });

    this.jobs.set('productSync', job);
    logger.info('Product sync scheduled every 6 hours');
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
      job.cancel();
      logger.info(`Job ${name} cancelled`);
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
      status[name] = {
        active: job.pendingInvocations().length > 0,
        nextInvocation: job.nextInvocation(),
      };
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
      case 'healthCheck':
        logger.info('Forcing health check...');
        return await amazonService.checkSyncNeeded();
      default:
        throw new Error(`Unknown job: ${jobName}`);
    }
  }
}

module.exports = new ProductScheduler();
