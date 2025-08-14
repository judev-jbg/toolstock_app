// backend/src/controllers/notificationsController.js - NUEVO ARCHIVO
const amazonPoller = require('../services/amazon/amazonPoller');
const webhookSimulator = require('../services/notifications/webhookSimulator');
const notificationHandler = require('../services/amazon/notificationHandler');
const logger = require('../utils/logger');

/**
 * @desc    Obtener estado del sistema de notificaciones
 * @route   GET /api/notifications/status
 * @access  Private/Admin
 */
const getNotificationsStatus = async (req, res) => {
  try {
    const pollerStats = amazonPoller.getStats();
    const webhookStats = webhookSimulator.getStats();

    res.json({
      status: 'operational',
      timestamp: new Date(),
      polling: {
        enabled: pollerStats.isPolling,
        frequency: pollerStats.pollFrequency,
        lastPoll: pollerStats.lastPollTime,
        nextPoll: pollerStats.nextPollTime,
      },
      webhooks: {
        simulationEnabled: webhookStats.simulationActive,
        activeWebhooks: webhookStats.activeWebhooks,
        registeredEndpoints: webhookStats.webhooks,
      },
      configuration: {
        marketplaceId: process.env.AMAZON_MARKETPLACE_ID || 'NOT_SET',
        sellerId: process.env.AMAZON_SELLER_ID ? 'SET' : 'NOT_SET',
        pollingMode: true, // Siempre true en esta implementación
        sqsMode: false, // False porque no usamos SQS
      },
    });
  } catch (error) {
    logger.error('Error getting notifications status:', error);
    res.status(500).json({
      message: 'Error obteniendo estado de notificaciones',
      error: error.message,
    });
  }
};

/**
 * @desc    Iniciar polling de Amazon
 * @route   POST /api/notifications/polling/start
 * @access  Private/Admin
 */
const startPolling = async (req, res) => {
  try {
    const { frequency = 300000 } = req.body; // 5 minutos por defecto

    if (frequency < 60000) {
      // Mínimo 1 minuto
      return res.status(400).json({
        message: 'La frecuencia mínima es 60 segundos',
      });
    }

    await amazonPoller.startPolling(frequency);

    res.json({
      message: 'Polling de Amazon iniciado',
      frequency: frequency,
      frequencyMinutes: frequency / 60000,
      nextPoll: new Date(Date.now() + frequency),
    });
  } catch (error) {
    logger.error('Error starting polling:', error);
    res.status(500).json({
      message: 'Error iniciando polling',
      error: error.message,
    });
  }
};

/**
 * @desc    Detener polling de Amazon
 * @route   POST /api/notifications/polling/stop
 * @access  Private/Admin
 */
const stopPolling = async (req, res) => {
  try {
    amazonPoller.stopPolling();

    res.json({
      message: 'Polling de Amazon detenido',
    });
  } catch (error) {
    logger.error('Error stopping polling:', error);
    res.status(500).json({
      message: 'Error deteniendo polling',
      error: error.message,
    });
  }
};

/**
 * @desc    Ejecutar ciclo de polling manual
 * @route   POST /api/notifications/polling/execute
 * @access  Private/Admin
 */
const executePollingCycle = async (req, res) => {
  try {
    logger.info('Manual polling cycle triggered');

    // Ejecutar en segundo plano para respuesta rápida
    setImmediate(async () => {
      try {
        await amazonPoller.executePollingCycle();
      } catch (error) {
        logger.error('Error in manual polling cycle:', error);
      }
    });

    res.json({
      message: 'Ciclo de polling ejecutado manualmente',
      executedAt: new Date(),
    });
  } catch (error) {
    logger.error('Error executing manual polling cycle:', error);
    res.status(500).json({
      message: 'Error ejecutando ciclo de polling',
      error: error.message,
    });
  }
};

/**
 * @desc    Iniciar simulación de webhooks
 * @route   POST /api/notifications/simulation/start
 * @access  Private/Admin
 */
const startWebhookSimulation = async (req, res) => {
  try {
    const { interval = 600000 } = req.body; // 10 minutos por defecto

    if (interval < 60000) {
      // Mínimo 1 minuto
      return res.status(400).json({
        message: 'El intervalo mínimo es 60 segundos',
      });
    }

    webhookSimulator.startSimulation(interval);

    res.json({
      message: 'Simulación de webhooks iniciada',
      interval: interval,
      intervalMinutes: interval / 60000,
      nextSimulation: new Date(Date.now() + interval),
    });
  } catch (error) {
    logger.error('Error starting webhook simulation:', error);
    res.status(500).json({
      message: 'Error iniciando simulación',
      error: error.message,
    });
  }
};

/**
 * @desc    Detener simulación de webhooks
 * @route   POST /api/notifications/simulation/stop
 * @access  Private/Admin
 */
const stopWebhookSimulation = async (req, res) => {
  try {
    webhookSimulator.stopSimulation();

    res.json({
      message: 'Simulación de webhooks detenida',
    });
  } catch (error) {
    logger.error('Error stopping webhook simulation:', error);
    res.status(500).json({
      message: 'Error deteniendo simulación',
      error: error.message,
    });
  }
};

/**
 * @desc    Simular notificación para un producto específico
 * @route   POST /api/notifications/simulation/product/:productId
 * @access  Private/Admin
 */
const simulateProductNotification = async (req, res) => {
  try {
    const { notificationType = 'ANY_OFFER_CHANGED' } = req.body;

    const validTypes = ['ANY_OFFER_CHANGED', 'PRICING_HEALTH'];
    if (!validTypes.includes(notificationType)) {
      return res.status(400).json({
        message: `Tipo de notificación inválido. Válidos: ${validTypes.join(', ')}`,
      });
    }

    const notification = await webhookSimulator.simulateNotificationForProduct(
      req.params.productId,
      notificationType
    );

    res.json({
      message: `Notificación ${notificationType} simulada para el producto`,
      notification: {
        type: notification.notificationType,
        eventTime: notification.eventTime,
        asin: notification.payload.summary?.asin || notification.payload.asin,
        processed: true,
      },
    });
  } catch (error) {
    logger.error('Error simulating product notification:', error);
    res.status(500).json({
      message: 'Error simulando notificación',
      error: error.message,
    });
  }
};

/**
 * @desc    Procesar notificación manual (para testing)
 * @route   POST /api/notifications/test/process
 * @access  Private/Admin
 */
const processTestNotification = async (req, res) => {
  try {
    const notification = req.body;

    if (!notification.notificationType) {
      return res.status(400).json({
        message: 'El campo notificationType es obligatorio',
      });
    }

    logger.info(`Processing test notification: ${notification.notificationType}`);

    let result = null;
    switch (notification.notificationType) {
      case 'ANY_OFFER_CHANGED':
        result = await notificationHandler.handleOfferChanged(notification);
        break;
      case 'PRICING_HEALTH':
        result = await notificationHandler.handlePricingHealth(notification);
        break;
      default:
        return res.status(400).json({
          message: `Tipo de notificación no soportado: ${notification.notificationType}`,
        });
    }

    res.json({
      message: 'Notificación de prueba procesada',
      notification: {
        type: notification.notificationType,
        processed: true,
      },
      result: result
        ? {
            success: result.success,
            strategy: result.decision?.strategy,
            priceChanged: result.decision?.finalPrice !== result.product?.amz_price,
          }
        : null,
    });
  } catch (error) {
    logger.error('Error processing test notification:', error);
    res.status(500).json({
      message: 'Error procesando notificación de prueba',
      error: error.message,
    });
  }
};

/**
 * @desc    Obtener configuración para SQS (preparación futura)
 * @route   GET /api/notifications/sqs/config
 * @access  Private/Admin
 */
const getSQSConfig = async (req, res) => {
  try {
    res.json({
      message: 'Configuración SQS (para implementación futura)',
      currentMode: 'polling',
      sqsConfig: {
        queueUrl: 'NO_CONFIGURADO',
        region: process.env.AWS_REGION || 'eu-west-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'NOT_SET',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ? 'SET' : 'NOT_SET',
      },
      instructions: {
        step1: 'Crear cola SQS en AWS Console',
        step2: 'Configurar política de acceso para Amazon Selling Partner API',
        step3: 'Crear destination usando Amazon SP-API',
        step4: 'Crear subscription para notificaciones',
        step5: 'Configurar variables de entorno AWS en este servidor',
        step6: 'Activar modo SQS en lugar de polling',
      },
      requiredEnvVars: [
        'AWS_REGION',
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
        'AMAZON_SQS_QUEUE_URL',
      ],
    });
  } catch (error) {
    logger.error('Error getting SQS config:', error);
    res.status(500).json({
      message: 'Error obteniendo configuración SQS',
      error: error.message,
    });
  }
};

module.exports = {
  getNotificationsStatus,
  startPolling,
  stopPolling,
  executePollingCycle,
  startWebhookSimulation,
  stopWebhookSimulation,
  simulateProductNotification,
  processTestNotification,
  getSQSConfig,
};
