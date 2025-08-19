const cron = require('node-cron');
const amazonPoller = require('../amazon/amazonPoller');
const webhookSimulator = require('../notifications/webhookSimulator');
const logger = require('../../utils/logger');

class NotificationScheduler {
  constructor() {
    this.jobs = new Map();
    this.isInitialized = false;
  }

  /**
   * Inicializa el scheduler de notificaciones
   */
  init() {
    if (this.isInitialized) {
      logger.warn('Notification scheduler already initialized');
      return;
    }

    // if (process.env.NODE_ENV === 'production') {
    //   this.setupProductionJobs();
    // } else {
    //   this.setupDevelopmentJobs();
    // }

    this.isInitialized = true;
    logger.info('Notification scheduler initialized');
  }

  /**
   * Configura jobs para producción
   */
  setupProductionJobs() {
    // Polling cada 5 minutos
    const pollingJob = cron.schedule(
      '*/5 * * * *',
      async () => {
        try {
          logger.info('Executing scheduled polling cycle');
          await amazonPoller.executePollingCycle();
        } catch (error) {
          logger.error('Error in scheduled polling:', error);
        }
      },
      {
        scheduled: false,
        timezone: 'Europe/Madrid',
      }
    );

    this.jobs.set('polling', pollingJob);

    // Iniciar polling automáticamente
    amazonPoller.startPolling(5 * 60 * 1000); // 5 minutos
  }

  /**
   * Configura jobs para desarrollo
   */
  setupDevelopmentJobs() {
    // Polling cada 10 minutos en desarrollo
    const pollingJob = cron.schedule(
      '*/10 * * * *',
      async () => {
        try {
          logger.info('Executing development polling cycle');
          await amazonPoller.executePollingCycle();
        } catch (error) {
          logger.error('Error in development polling:', error);
        }
      },
      {
        scheduled: false,
        timezone: 'Europe/Madrid',
      }
    );

    // Simulación cada 15 minutos en desarrollo
    const simulationJob = cron.schedule(
      '*/15 * * * *',
      async () => {
        try {
          logger.info('Executing webhook simulation');
          await webhookSimulator.generateRandomNotification();
        } catch (error) {
          logger.error('Error in webhook simulation:', error);
        }
      },
      {
        scheduled: false,
        timezone: 'Europe/Madrid',
      }
    );

    this.jobs.set('polling', pollingJob);
    this.jobs.set('simulation', simulationJob);

    // Iniciar servicios automáticamente en desarrollo
    amazonPoller.startPolling(10 * 60 * 1000); // 10 minutos
    webhookSimulator.startSimulation(15 * 60 * 1000); // 15 minutos
  }

  /**
   * Inicia todos los jobs
   */
  startJobs() {
    this.jobs.forEach((job, name) => {
      job.start();
      logger.info(`Started notification job: ${name}`);
    });
  }

  /**
   * Detiene todos los jobs
   */
  stopJobs() {
    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info(`Stopped notification job: ${name}`);
    });

    amazonPoller.stopPolling();
    webhookSimulator.stopSimulation();
  }

  /**
   * Obtiene el estado de los jobs
   */
  getJobsStatus() {
    const status = {};

    this.jobs.forEach((job, name) => {
      status[name] = {
        running: job.running || false,
        scheduled: job.scheduled || false,
      };
    });

    return {
      jobs: status,
      polling: amazonPoller.getStats(),
      simulation: webhookSimulator.getStats(),
    };
  }

  /**
   * Ejecuta un job específico manualmente
   */
  async executeJob(jobName) {
    switch (jobName) {
      case 'polling':
        await amazonPoller.executePollingCycle();
        break;
      case 'simulation':
        await webhookSimulator.generateRandomNotification();
        break;
      default:
        throw new Error(`Unknown job: ${jobName}`);
    }
  }

  /**
   * Limpia recursos al cerrar
   */
  destroy() {
    this.stopJobs();
    this.jobs.clear();
    this.isInitialized = false;
    logger.info('Notification scheduler destroyed');
  }
}

module.exports = new NotificationScheduler();
