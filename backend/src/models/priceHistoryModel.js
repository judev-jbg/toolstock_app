const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },

    erp_sku: {
      type: String,
      required: true,
      index: true,
    },

    // Información del cambio de precio
    changeType: {
      type: String,
      enum: [
        'pvpm_recalculation', // Recálculo de PVPM
        'competitor_response', // Respuesta a cambio de competencia
        'manual_update', // Actualización manual por usuario
        'fixed_price_set', // Establecimiento de precio fijo
        'fixed_price_removed', // Eliminación de precio fijo
        'config_change', // Cambio en configuración global
        'bulk_operation', // Operación masiva
        'system_correction', // Corrección automática del sistema
        'amazon_sync', // Sincronización con Amazon
        'web_offer_adjustment', // Ajuste por oferta web
      ],
      required: true,
      index: true,
    },

    // Precios involucrados
    prices: {
      // Precio anterior
      previousPrice: {
        amazon: { type: Number, default: null },
        pvpm: { type: Number, default: null },
        fixed: { type: Number, default: null },
        competitor: { type: Number, default: null },
      },

      // Precio nuevo
      newPrice: {
        amazon: { type: Number, default: null },
        pvpm: { type: Number, default: null },
        fixed: { type: Number, default: null },
        competitor: { type: Number, default: null },
      },

      // Precio aplicado finalmente
      appliedPrice: {
        type: Number,
        required: true,
      },

      // Fuente del precio aplicado
      priceSource: {
        type: String,
        enum: ['pvpm', 'fixed_price', 'competitor_strategy', 'manual', 'amazon_sync'],
        required: true,
      },
    },

    // Contexto del cambio
    context: {
      // Trigger que causó el cambio
      trigger: {
        type: String,
        required: true,
        maxlength: 200,
      },

      // Descripción detallada
      description: {
        type: String,
        required: true,
        maxlength: 1000,
      },

      // Estrategia aplicada
      strategy: {
        type: String,
        enum: [
          'maintain_buybox',
          'compete_price',
          'follow_pvpm',
          'fixed_strategy',
          'manual_decision',
        ],
        default: null,
      },

      // Datos específicos del cambio
      metadata: {
        // Para cambios de competencia
        competitorData: {
          previousCompetitorPrice: { type: Number },
          newCompetitorPrice: { type: Number },
          hadBuybox: { type: Boolean },
          hasBuybox: { type: Boolean },
        },

        // Para cambios de PVPM
        pvpmData: {
          costUsed: { type: Number },
          marginUsed: { type: Number },
          shippingCostUsed: { type: Number },
          calculationSource: { type: String }, // 'config_change', 'aux_fields', etc.
        },

        // Para precios fijos
        fixedPriceData: {
          reason: { type: String },
          setBy: { type: String },
          expiresAt: { type: Date },
        },

        // Para cambios de configuración
        configData: {
          changedFields: [{ type: String }],
          previousValues: { type: mongoose.Schema.Types.Mixed },
          newValues: { type: mongoose.Schema.Types.Mixed },
        },

        // Para ofertas web
        webOfferData: {
          webPrice: { type: Number },
          isWebOffer: { type: Boolean },
          conflictDetected: { type: Boolean },
        },
      },
    },

    // Información de ejecución
    execution: {
      // Quién hizo el cambio
      changedBy: {
        type: String,
        required: true,
        maxlength: 100,
      },

      // Tipo de actor
      actorType: {
        type: String,
        enum: ['user', 'system', 'scheduler', 'api'],
        required: true,
      },

      // Estado de la ejecución
      status: {
        type: String,
        enum: ['pending', 'applied', 'failed', 'partially_applied'],
        default: 'pending',
        index: true,
      },

      // Resultado de aplicar el cambio
      result: {
        success: { type: Boolean, default: null },
        amazonUpdated: { type: Boolean, default: false },
        localUpdated: { type: Boolean, default: false },
        errorMessage: { type: String, default: '' },
        apiResponse: { type: mongoose.Schema.Types.Mixed },
      },

      // Tiempos de ejecución
      startedAt: {
        type: Date,
        default: Date.now,
      },

      completedAt: {
        type: Date,
        default: null,
      },

      processingTimeMs: {
        type: Number,
        default: null,
      },
    },

    // Información de validación
    validation: {
      // Validaciones previas al cambio
      preValidation: {
        pvpmCheck: { type: Boolean, default: null },
        webOfferCheck: { type: Boolean, default: null },
        marginCheck: { type: Boolean, default: null },
        competitorCheck: { type: Boolean, default: null },
      },

      // Warnings detectados
      warnings: [
        {
          type: { type: String },
          message: { type: String },
          severity: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
        },
      ],

      // Si el cambio fue bloqueado por validaciones
      blocked: {
        type: Boolean,
        default: false,
      },

      blockingReason: {
        type: String,
        default: '',
      },
    },

    // Impacto del cambio
    impact: {
      // Cambio porcentual del precio
      priceChangePercentage: {
        type: Number,
        default: 0,
      },

      // Dirección del cambio
      priceDirection: {
        type: String,
        enum: ['increase', 'decrease', 'no_change'],
        required: true,
      },

      // Magnitud del cambio
      changeAmount: {
        type: Number,
        required: true,
      },

      // Impacto estimado en competitividad
      competitivenessImpact: {
        type: String,
        enum: ['improved', 'maintained', 'decreased', 'unknown'],
        default: 'unknown',
      },

      // Acciones generadas por este cambio
      actionsTriggered: [
        {
          actionId: { type: mongoose.Schema.Types.ObjectId, ref: 'PendingAction' },
          actionType: { type: String },
        },
      ],
    },

    // Referencias
    references: {
      // Acción que originó este cambio (si aplica)
      originatingActionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PendingAction',
        default: null,
      },

      // Configuración activa en el momento del cambio
      configSnapshot: {
        defaultMargin: { type: Number },
        defaultIva: { type: Number },
        defaultShippingCost: { type: Number },
      },

      // ID de sesión o batch para cambios masivos
      batchId: {
        type: String,
        default: null,
        index: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Índices compuestos para optimizar consultas
priceHistorySchema.index({ productId: 1, createdAt: -1 });
priceHistorySchema.index({ erp_sku: 1, createdAt: -1 });
priceHistorySchema.index({ changeType: 1, createdAt: -1 });
priceHistorySchema.index({ 'execution.status': 1, createdAt: -1 });
priceHistorySchema.index({ 'execution.changedBy': 1, createdAt: -1 });
priceHistorySchema.index({ batchId: 1 });

// Índice de texto para búsquedas
priceHistorySchema.index({
  erp_sku: 'text',
  'context.trigger': 'text',
  'context.description': 'text',
});

// Middleware para calcular impacto antes de guardar
priceHistorySchema.pre('save', function (next) {
  if (this.isNew) {
    const previousPrice = this.prices.previousPrice.amazon || 0;
    const newPrice = this.prices.appliedPrice;

    // Calcular cambio
    this.impact.changeAmount = newPrice - previousPrice;

    if (previousPrice > 0) {
      this.impact.priceChangePercentage = ((newPrice - previousPrice) / previousPrice) * 100;
    }

    // Determinar dirección
    if (this.impact.changeAmount > 0.01) {
      this.impact.priceDirection = 'increase';
    } else if (this.impact.changeAmount < -0.01) {
      this.impact.priceDirection = 'decrease';
    } else {
      this.impact.priceDirection = 'no_change';
    }
  }
  next();
});

// Métodos estáticos para consultas comunes
priceHistorySchema.statics.getRecentChanges = function (limit = 50) {
  return this.find({ 'execution.status': 'applied' })
    .populate('productId', 'erp_sku erp_name amz_title')
    .sort({ createdAt: -1 })
    .limit(limit);
};

priceHistorySchema.statics.getChangesByProduct = function (productId, limit = 20) {
  return this.find({ productId }).sort({ createdAt: -1 }).limit(limit);
};

priceHistorySchema.statics.getChangesByType = function (changeType, limit = 100) {
  return this.find({
    changeType,
    'execution.status': 'applied',
  })
    .populate('productId', 'erp_sku erp_name')
    .sort({ createdAt: -1 })
    .limit(limit);
};

priceHistorySchema.statics.getStatsByPeriod = function (startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        'execution.status': 'applied',
      },
    },
    {
      $group: {
        _id: {
          changeType: '$changeType',
          priceDirection: '$impact.priceDirection',
        },
        count: { $sum: 1 },
        totalPriceChange: { $sum: '$impact.changeAmount' },
        averagePriceChange: { $avg: '$impact.changeAmount' },
        products: { $addToSet: '$productId' },
      },
    },
    {
      $group: {
        _id: '$_id.changeType',
        totalChanges: { $sum: '$count' },
        increases: {
          $sum: {
            $cond: [{ $eq: ['$_id.priceDirection', 'increase'] }, '$count', 0],
          },
        },
        decreases: {
          $sum: {
            $cond: [{ $eq: ['$_id.priceDirection', 'decrease'] }, '$count', 0],
          },
        },
        totalImpact: { $sum: '$totalPriceChange' },
        uniqueProducts: { $sum: { $size: '$products' } },
      },
    },
    { $sort: { totalChanges: -1 } },
  ]);
};

// Método de instancia para marcar como completado
priceHistorySchema.methods.markCompleted = function (success, result = {}) {
  this.execution.status = success ? 'applied' : 'failed';
  this.execution.completedAt = new Date();
  this.execution.processingTimeMs = this.execution.completedAt - this.execution.startedAt;
  this.execution.result = {
    success,
    ...result,
  };
  return this.save();
};

module.exports = mongoose.model('PriceHistory', priceHistorySchema);
