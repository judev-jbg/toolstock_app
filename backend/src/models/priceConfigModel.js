// backend/src/models/priceConfigModel.js
const mongoose = require('mongoose');

const priceConfigSchema = new mongoose.Schema({
  defaultMarginRate: {
    type: Number,
    default: 0.75,
    required: true,
  },
  defaultTaxRate: {
    type: Number,
    default: 21,
    required: true,
  },
  defaultShippingCost: {
    type: Number,
    default: 8,
    required: true,
  },
  // Configuración de pesos y costos
  weightRanges: [
    {
      maxWeight: Number, // en kg
      shippingCost: Number, // precio en euros
    },
  ],
  // Configuración de precios Amazon/Prestashop
  prestashopDiscount: {
    type: Number,
    default: 4, // 4% menos que Amazon
    required: true,
  },
  // Configuración de competición buybox
  buyboxPriceDifference: {
    type: Number,
    default: 2, // 2€ menos que la competencia
    required: true,
  },
  active: {
    type: Boolean,
    default: true,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

const PriceConfig = mongoose.model('PriceConfig', priceConfigSchema);

module.exports = PriceConfig;
