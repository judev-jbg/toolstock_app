const mongoose = require('mongoose');

const pendingActionSchema = new mongoose.Schema(
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

    actionType: {
      type: String,
      enum: [
        'missing_weight', // Producto sin peso
        'missing_cost', // Producto sin coste
        'web_offer_conflict', // OFERTA WEB pero erp_price >= amz_price
        'amazon_cheaper_than_web', // amz_price < erp_price + 4%
        'competitor_alert', // Competencia cambió precios
        'pvpm_warning', // Precio por debajo de PVPM
        'invalid_margin', // Margen inválido
        'fixed_price_below_pvpm', // Precio fijo por debajo de PVPM
        'sync_error', // Error de sincronización con Amazon
        'missing_amazon_data', // Producto sin datos de Amazon
      ],
      required: true,
      index: true,
    },

    priority: {
      type: String,
      enum: ['critical', 'high', 'medium', 'low'],
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      maxlength: 200,
    },

    description: {
      type: String,
      required: true,
      maxlength: 1000,
    },

    // Datos específicos de la acción para resolución
    data: {
      // Para missing_weight
      currentWeight: { type: Number },

      // Para conflicts
      webPrice: { type: Number },
      amazonPrice: { type: Number },
      requiredPrice: { type: Number },

      // Para competitor_alert
      previousCompetitorPrice: { type: Number },
      newCompetitorPrice: { type: Number },

      // Para pvpm_warning
      currentPrice: { type: Number },
      pvpm: { type: Number },
      difference: { type: Number },

      // Para fixed_price
      fixedPrice: { type: Number },
      fixedPriceReason: { type: String },

      // Metadatos adicionales
      detectedAt: { type: Date, default: Date.now },
      lastChecked: { type: Date, default: Date.now },
      occurrenceCount: { type: Number, default: 1 },
    },

    status: {
      type: String,
      enum: ['pending', 'in_progress', 'resolved', 'dismissed', 'auto_resolved'],
      default: 'pending',
      index: true,
    },

    // Información de resolución
    resolvedAt: {
      type: Date,
      default: null,
    },

    resolvedBy: {
      type: String,
      default: null,
      maxlength: 100,
    },

    resolutionNote: {
      type: String,
      default: '',
      maxlength: 500,
    },

    resolutionMethod: {
      type: String,
      enum: ['manual', 'automatic', 'bulk_operation', 'system_update'],
      default: null,
    },

    // Información de asignación (para workflow futuro)
    assignedTo: {
      type: String,
      default: null,
      maxlength: 100,
    },

    assignedAt: {
      type: Date,
      default: null,
    },

    // Configuración de alertas
    alertSent: {
      type: Boolean,
      default: false,
    },

    alertSentAt: {
      type: Date,
      default: null,
    },

    // Configuración de auto-resolución
    autoResolveEnabled: {
      type: Boolean,
      default: true,
    },

    // Fecha de expiración automática
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Índices compuestos para optimizar consultas
pendingActionSchema.index({ status: 1, priority: 1, createdAt: -1 });
pendingActionSchema.index({ productId: 1, actionType: 1 }, { unique: true });
pendingActionSchema.index({ actionType: 1, status: 1 });
pendingActionSchema.index({ erp_sku: 1, status: 1 });
pendingActionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Middleware para configurar expiración automática según tipo
pendingActionSchema.pre('save', function (next) {
  if (this.isNew && !this.expiresAt) {
    const now = new Date();

    // Configurar expiración según tipo de acción
    switch (this.actionType) {
      case 'competitor_alert':
        this.expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 horas
        break;
      case 'sync_error':
        this.expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 horas
        break;
      case 'missing_weight':
      case 'missing_cost':
        // No expiran automáticamente
        break;
      default:
        this.expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 días
    }
  }
  next();
});

// Métodos estáticos para consultas comunes
pendingActionSchema.statics.getPendingByPriority = function () {
  return this.aggregate([
    { $match: { status: 'pending' } },
    {
      $group: {
        _id: '$priority',
        count: { $sum: 1 },
        actions: { $push: '$$ROOT' },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

pendingActionSchema.statics.getPendingByType = function () {
  return this.aggregate([
    { $match: { status: 'pending' } },
    {
      $group: {
        _id: '$actionType',
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
  ]);
};

pendingActionSchema.statics.getCriticalActions = function (limit = 50) {
  return this.find({
    status: 'pending',
    priority: { $in: ['critical', 'high'] },
  })
    .populate('productId', 'erp_sku erp_name amz_title')
    .sort({ priority: 1, createdAt: -1 })
    .limit(limit);
};

// Método para marcar como resuelto
pendingActionSchema.methods.resolve = function (
  resolvedBy,
  resolutionNote,
  resolutionMethod = 'manual'
) {
  this.status = 'resolved';
  this.resolvedAt = new Date();
  this.resolvedBy = resolvedBy;
  this.resolutionNote = resolutionNote || '';
  this.resolutionMethod = resolutionMethod;
  return this.save();
};

// Método para descartar
pendingActionSchema.methods.dismiss = function (dismissedBy, dismissalNote) {
  this.status = 'dismissed';
  this.resolvedAt = new Date();
  this.resolvedBy = dismissedBy;
  this.resolutionNote = dismissalNote || 'Acción descartada por el usuario';
  this.resolutionMethod = 'manual';
  return this.save();
};

module.exports = mongoose.model('PendingAction', pendingActionSchema);
