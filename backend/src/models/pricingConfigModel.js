const mongoose = require('mongoose');

const pricingConfigSchema = new mongoose.Schema({
  // Configuración global de PVPM
  defaultMargin: {
    type: Number,
    default: 0.75,
    required: true,
    min: 0.1,
    max: 0.9,
    validate: {
      validator: function (v) {
        return v > 0.1 && v < 0.9;
      },
      message: 'El margen debe estar entre 0.1 (10%) y 0.9 (90%)',
    },
  },

  defaultIva: {
    type: Number,
    default: 0.21,
    required: true,
    min: 0,
    max: 1,
    validate: {
      validator: function (v) {
        return v >= 0 && v <= 1;
      },
      message: 'El IVA debe estar entre 0 (0%) y 1 (100%)',
    },
  },

  defaultShippingCost: {
    type: Number,
    default: 10,
    required: true,
    min: 0,
    validate: {
      validator: function (v) {
        return v >= 0;
      },
      message: 'El coste de envío por defecto debe ser positivo',
    },
  },

  // Tabla de costes de envío por peso (GLS)
  shippingCostTable: [
    {
      maxWeight: {
        type: Number,
        required: true,
        min: 0,
      },
      cost: {
        type: Number,
        required: true,
        min: 0,
      },
    },
  ],

  // Configuración de competencia
  competitorSettings: {
    // Frecuencia de actualización de precios (minutos)
    priceUpdateFrequency: {
      type: Number,
      default: 60,
      min: 5,
      max: 1440, // máximo 24 horas
    },

    // Diferencia cuando tenemos buybox (euros)
    buyboxDifference: {
      type: Number,
      default: 2.0,
      min: 0.01,
      max: 50,
    },

    // Diferencia mínima como fallback (euros)
    fallbackDifference: {
      type: Number,
      default: 0.01,
      min: 0.01,
      max: 5,
    },

    // Porcentaje de descuento web vs Amazon (0.04 = 4%)
    webDiscountPercentage: {
      type: Number,
      default: 0.04,
      min: 0.01,
      max: 0.2, // máximo 20%
    },
  },

  //  Configuración de notificaciones y alertas
  alertSettings: {
    // Enviar email cuando hay acciones críticas
    emailAlertsEnabled: {
      type: Boolean,
      default: true,
    },

    // Dirección de email para alertas
    alertEmail: {
      type: String,
      default: '',
      validate: {
        validator: function (v) {
          if (!v) return true; // Permitir vacío
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Email inválido',
      },
    },

    // Umbral para alertas de productos por debajo de PVPM
    pvpmWarningThreshold: {
      type: Number,
      default: 0.05, // 5% por debajo del PVPM
      min: 0.01,
      max: 0.5,
    },
  },

  //  Configuración de automation
  automationSettings: {
    // Habilitar actualizaciones automáticas de precios
    autoUpdateEnabled: {
      type: Boolean,
      default: true,
    },

    // Horario de operación (horas en formato 24h)
    operatingHours: {
      start: {
        type: Number,
        default: 6, // 6:00 AM
        min: 0,
        max: 23,
      },
      end: {
        type: Number,
        default: 23, // 11:00 PM
        min: 0,
        max: 23,
      },
    },

    // Días de la semana para actualizaciones automáticas (0=Domingo, 7=Domingo)
    operatingDays: {
      type: [Number],
      default: [0, 1, 2, 3, 4, 5, 6], // Lunes a Domingos
      validate: {
        validator: function (v) {
          return v.every((day) => day >= 0 && day <= 6);
        },
        message: 'Los días deben estar entre 0 (Domingo) y 7 (Domingo)',
      },
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

  // Usuario que hizo la última actualización
  lastUpdatedBy: {
    type: String,
    default: 'system',
  },
});

// Middleware para actualizar updatedAt
pricingConfigSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
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

// Método para calcular coste de envío por peso
pricingConfigSchema.methods.calculateShippingCostByWeight = function (weight) {
  if (!weight || weight <= 0) {
    return this.defaultShippingCost;
  }

  // Buscar en tabla ordenada por peso
  const sortedTable = this.shippingCostTable.sort((a, b) => a.maxWeight - b.maxWeight);

  for (const range of sortedTable) {
    if (weight <= range.maxWeight) {
      return range.cost;
    }
  }

  // Para peso > 20kg: 9.25 + (peso-20) * 0.47
  const baseRate = 9.25;
  const additionalWeight = weight - 20;
  const additionalCost = additionalWeight * 0.47;

  return Math.round((baseRate + additionalCost) * 100) / 100;
};

// Método para validar si estamos en horario de operación
pricingConfigSchema.methods.isWithinOperatingHours = function () {
  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDay();

  const isOperatingDay = this.automationSettings.operatingDays.includes(currentDay);
  const isOperatingHour =
    currentHour >= this.automationSettings.operatingHours.start &&
    currentHour <= this.automationSettings.operatingHours.end;

  return isOperatingDay && isOperatingHour;
};

module.exports = mongoose.model('PricingConfig', pricingConfigSchema);
