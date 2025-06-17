const mongoose = require('mongoose');

const pricingConfigSchema = new mongoose.Schema({
  // Configuración global de PVPM
  defaultMargin: {
    type: Number,
    default: 0.75,
    required: true,
    min: 0.1,
    max: 0.9,
  },

  defaultIva: {
    type: Number,
    default: 0.21,
    required: true,
    min: 0,
    max: 1,
  },

  defaultShippingCost: {
    type: Number,
    default: 10,
    required: true,
  },

  // Tabla de costes de envío por peso (GLS)
  shippingCostTable: [
    {
      maxWeight: Number,
      cost: Number,
    },
  ],

  // Configuración de competencia
  competitorSettings: {
    priceUpdateFrequency: {
      type: Number,
      default: 60, // minutos
    },
    minPriceDifference: {
      type: Number,
      default: 2, // euros
    },
    fallbackDifference: {
      type: Number,
      default: 0.01, // centavos
    },
  },

  // Metadatos
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Singleton pattern - solo puede haber una configuración
pricingConfigSchema.statics.getInstance = async function () {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({
      shippingCostTable: [
        { maxWeight: 1, cost: 4.18 },
        { maxWeight: 3, cost: 4.57 },
        { maxWeight: 5, cost: 4.93 },
        { maxWeight: 10, cost: 5.64 },
        { maxWeight: 15, cost: 7.08 },
        { maxWeight: 20, cost: 9.25 },
        // Para >20kg se calcula: 9.25 + (peso-20) * 0.47
      ],
    });
  }
  return config;
};

module.exports = mongoose.model('PricingConfig', pricingConfigSchema);
