const express = require('express');
const {
  handleAmazonPriceChangeNotification,
  handleSubscriptionConfirmation,
  testWebhook,
} = require('../controllers/webhookController');

const router = express.Router();

// Webhooks de Amazon
router.post('/amazon/price-changes', handleAmazonPriceChangeNotification);
router.post('/amazon/subscription-confirmation', handleSubscriptionConfirmation);

// Webhook de prueba
router.get('/test', testWebhook);
router.post('/test', testWebhook);

module.exports = router;
