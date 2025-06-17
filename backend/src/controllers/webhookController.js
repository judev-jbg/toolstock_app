const competitorMonitor = require('../services/pricing/competitorMonitor');
const logger = require('../utils/logger').createLogger('webhookController');
const crypto = require('crypto');

/**
 * @desc    Webhook para notificaciones de cambios de precio de Amazon
 * @route   POST /api/webhooks/amazon/price-changes
 * @access  Public (con validación de firma)
 */
const handleAmazonPriceChangeNotification = async (req, res) => {
  try {
    // Validar firma de Amazon (si está configurada)
    if (process.env.AMAZON_WEBHOOK_SECRET) {
      const signature = req.headers['x-amz-sns-signature'];
      const timestamp = req.headers['x-amz-sns-timestamp'];

      if (!validateAmazonSignature(req.body, signature, timestamp)) {
        logger.warn('Invalid Amazon webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const notification = req.body;

    // Verificar que es una notificación de cambio de oferta
    if (notification.notificationType !== 'ANY_OFFER_CHANGED') {
      logger.info(`Ignored notification type: ${notification.notificationType}`);
      return res.status(200).json({ message: 'Notification type not handled' });
    }

    // Procesar la notificación
    await competitorMonitor.processPriceChangeNotification(notification);

    logger.info('Amazon price change notification processed successfully');
    res.status(200).json({ message: 'Notification processed successfully' });
  } catch (error) {
    logger.error('Error processing Amazon price change notification:', error);
    res.status(500).json({
      error: 'Error processing notification',
      message: error.message,
    });
  }
};

/**
 * @desc    Webhook para confirmación de suscripción SNS
 * @route   POST /api/webhooks/amazon/subscription-confirmation
 * @access  Public
 */
const handleSubscriptionConfirmation = async (req, res) => {
  try {
    const { Type, SubscribeURL } = req.body;

    if (Type === 'SubscriptionConfirmation') {
      // Confirmar suscripción visitando la URL
      const fetch = (await import('node-fetch')).default;
      await fetch(SubscribeURL);

      logger.info('Amazon SNS subscription confirmed');
      res.status(200).json({ message: 'Subscription confirmed' });
    } else {
      res.status(400).json({ error: 'Invalid message type' });
    }
  } catch (error) {
    logger.error('Error confirming subscription:', error);
    res.status(500).json({ error: 'Error confirming subscription' });
  }
};

/**
 * @desc    Webhook de prueba para verificar conectividad
 * @route   GET /api/webhooks/test
 * @access  Public
 */
const testWebhook = (req, res) => {
  const timestamp = new Date().toISOString();

  logger.info('Webhook test endpoint accessed');

  res.json({
    message: 'Webhook endpoint is working',
    timestamp,
    server: 'Toolstock Pricing System',
    environment: process.env.NODE_ENV || 'development',
  });
};

// Función auxiliar para validar firma de Amazon
function validateAmazonSignature(payload, signature, timestamp) {
  try {
    const secret = process.env.AMAZON_WEBHOOK_SECRET;
    if (!secret) return true; // Si no hay secreto configurado, omitir validación

    // Verificar que el timestamp no sea muy antiguo (5 minutos)
    const now = Math.floor(Date.now() / 1000);
    const messageTime = parseInt(timestamp);

    if (now - messageTime > 300) {
      logger.warn('Webhook timestamp too old');
      return false;
    }

    // Crear firma esperada
    const stringToSign = JSON.stringify(payload) + timestamp;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(stringToSign)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    logger.error('Error validating Amazon signature:', error);
    return false;
  }
}

module.exports = {
  handleAmazonPriceChangeNotification,
  handleSubscriptionConfirmation,
  testWebhook,
};
