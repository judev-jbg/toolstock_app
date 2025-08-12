const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    erp_sku: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    amz_asin: {
      type: String,
      index: true,
    },
    amz_sellerSku: {
      type: String,
      index: true,
    },
    amz_title: {
      type: String,
    },
    amz_brand: {
      type: String,
      default: '',
      index: true,
    },
    amz_price: {
      type: Number,
      default: 0,
    },
    amz_currency: {
      type: String,
      default: 'EUR',
    },
    amz_quantity: {
      type: Number,
      default: 0,
    },
    amz_status: {
      type: String,
      default: '',
      index: true,
    },
    amz_condition: {
      type: String,
      default: '',
    },
    amz_fulfillmentChannel: {
      type: String,
      default: '',
    },
    amz_productType: {
      type: String,
      default: '',
    },
    amz_imageUrl: {
      type: String,
      default: '',
    },
    // Datos adicionales de Amazon
    amz_amazonData: {
      itemName: String,
      itemDescription: String,
      listingId: String,
      productId: String,
      productIdType: String,
      itemCondition: String,
      itemConditionNote: String,
      standardPrice: Number,
      salePrice: Number,
      saleStartDate: Date,
      saleEndDate: Date,
      mainImageUrl: String,
      variations: [
        {
          theme: String,
          asin: String,
          attributes: mongoose.Schema.Types.Mixed,
        },
      ],
    },
    // Fechas de sincronización
    amz_lastSyncAt: {
      type: Date,
      default: Date.now,
    },
    amz_lastInventoryUpdate: {
      type: Date,
    },

    amz_syncStatus: {
      type: String,
      enum: ['synced', 'pending', 'error'],
      default: 'pending',
    },
    amz_syncError: {
      type: String,
      default: '',
    },

    erp_name: {
      type: String,
      index: true,
    },
    erp_skuSuplier: {
      type: String,
      index: true,
    },
    erp_manufacturer: {
      type: String,
      index: true,
    },
    erp_cost: {
      type: Number,
      default: 0,
    },
    erp_price: {
      type: Number,
      default: 0,
    },
    erp_barcode: {
      type: String,
      index: true,
    },
    erp_obs: {
      type: String,
      index: true,
    },
    erp_status: {
      type: Number,
      default: 0,
    },
    erp_weight: {
      type: Number,
      default: 0.0,
    },
    erp_stock: {
      type: Number,
      default: 0,
    },

    // Campos auxiliares para cálculo de PVPM
    // backend/src/models/productModel.js - ACTUALIZAR solo la sección pricing
    // Reemplaza todo el objeto pricing existente con este:

    pricing: {
      // ===== CAMPOS AUXILIARES (prevalecen sobre valores por defecto) =====
      customCost: {
        type: Number,
        default: null, // Si es null, usar erp_cost
        min: 0,
        validate: {
          validator: function (v) {
            return v === null || v >= 0;
          },
          message: 'El coste personalizado debe ser positivo',
        },
      },

      customMargin: {
        type: Number,
        default: null, // Si es null, usar margen por defecto (0.75)
        min: 0.1,
        max: 0.9,
        validate: {
          validator: function (v) {
            return v === null || (v >= 0.1 && v <= 0.9);
          },
          message: 'El margen personalizado debe estar entre 0.1 (10%) y 0.9 (90%)',
        },
      },

      customShippingCost: {
        type: Number,
        default: null, // Si es null, calcular por peso
        min: 0,
        validate: {
          validator: function (v) {
            return v === null || v >= 0;
          },
          message: 'El coste de envío personalizado debe ser positivo',
        },
      },

      // ===== CAMPOS CALCULADOS =====
      pvpm: {
        type: Number,
        default: 0,
        min: 0,
      },

      pvpmCalculatedAt: {
        type: Date,
        default: null,
      },

      // Breakdown del último cálculo PVPM para debugging
      pvpmBreakdown: {
        cost: { type: Number, default: 0 },
        margin: { type: Number, default: 0 },
        iva: { type: Number, default: 0 },
        shippingCost: { type: Number, default: 0 },
        basePrice: { type: Number, default: 0 },
        priceWithIva: { type: Number, default: 0 },
      },

      // ===== CONFIGURACIÓN DE PRECIOS DE COMPETENCIA =====
      competitorPrice: {
        type: Number,
        default: null,
        min: 0,
      },

      competitorPriceUpdatedAt: {
        type: Date,
        default: null,
      },

      // Información adicional de competencia
      competitorData: {
        hasBuybox: {
          type: Boolean,
          default: false,
        },

        buyboxPrice: {
          type: Number,
          default: null,
        },

        lowestPrice: {
          type: Number,
          default: null,
        },

        totalOffers: {
          type: Number,
          default: 0,
        },

        lastChecked: {
          type: Date,
          default: null,
        },
      },

      // ===== PRECIO FIJO COMERCIAL =====
      fixedPrice: {
        type: Number,
        default: null, // Si tiene valor, prevalece sobre PVPM/competencia
        min: 0,
        validate: {
          validator: function (v) {
            return v === null || v > 0;
          },
          message: 'El precio fijo debe ser positivo',
        },
      },

      fixedPriceReason: {
        type: String,
        default: '', // Razón comercial del precio fijo
        maxlength: 500,
      },

      fixedPriceSetAt: {
        type: Date,
        default: null, // Cuándo se estableció el precio fijo
      },

      fixedPriceSetBy: {
        type: String,
        default: '', // Usuario que estableció el precio fijo
        maxlength: 100,
      },

      // Fecha de expiración del precio fijo (opcional)
      fixedPriceExpiresAt: {
        type: Date,
        default: null,
      },

      // ===== CONTROL DE ACTUALIZACIONES =====
      autoUpdateEnabled: {
        type: Boolean,
        default: true, // Si false, el producto no se actualiza automáticamente
      },

      lastPriceUpdate: {
        type: Date,
        default: null,
      },

      // Número de actualizaciones automáticas realizadas
      autoUpdateCount: {
        type: Number,
        default: 0,
      },

      // ===== ESTADO Y VALIDACIONES =====
      pricingStatus: {
        type: String,
        enum: [
          'ok', // Todo correcto
          'pvpm_warning', // Precio por debajo de PVPM
          'competitor_alert', // Competencia cambió significativamente
          'web_offer_conflict', // Conflicto con ofertas web
          'amazon_cheaper', // Amazon más barato que web
          'missing_data', // Faltan datos para calcular
          'manual_review', // Requiere revisión manual
        ],
        default: 'ok',
        index: true,
      },

      pricingStatusMessage: {
        type: String,
        default: '',
        maxlength: 1000,
      },

      pricingStatusUpdatedAt: {
        type: Date,
        default: Date.now,
      },

      // ===== CONFIGURACIÓN ESPECÍFICA DEL PRODUCTO =====
      // Para casos especiales que requieren tratamiento diferente
      pricingRules: {
        // Nunca bajar del precio especificado
        minimumPrice: {
          type: Number,
          default: null,
          min: 0,
        },

        // Nunca subir del precio especificado
        maximumPrice: {
          type: Number,
          default: null,
          min: 0,
        },

        // Excluir de actualizaciones automáticas durante horarios específicos
        excludeFromAutoUpdate: {
          type: Boolean,
          default: false,
        },

        // Margen mínimo requerido (prevalece sobre margen global)
        minimumMarginRequired: {
          type: Number,
          default: null,
          min: 0.1,
          max: 0.9,
        },
      },

      // ===== HISTORIAL RESUMIDO (últimas 5 acciones) =====
      recentPriceHistory: [
        {
          previousPrice: { type: Number, required: true },
          newPrice: { type: Number, required: true },
          reason: {
            type: String,
            enum: ['pvpm_change', 'competitor_price', 'manual', 'fixed_price', 'config_change'],
            required: true,
          },
          trigger: { type: String, default: '' }, // Qué desencadenó el cambio
          changedAt: { type: Date, default: Date.now },
          changedBy: { type: String, default: 'system' }, // 'system' o userId
          success: { type: Boolean, default: true }, // Si la actualización fue exitosa
          errorMessage: { type: String, default: '' },
        },
      ],

      // Metadatos de pricing
      pricingMetadata: {
        totalPriceChanges: { type: Number, default: 0 },
        lastSuccessfulUpdate: { type: Date, default: null },
        lastFailedUpdate: { type: Date, default: null },
        consecutiveFailures: { type: Number, default: 0 },
      },
    },
  },
  {
    timestamps: true,
  }
);

// Índices compuestos para mejorar las consultas
productSchema.index({ brand: 1, status: 1 });
productSchema.index({ sellerSku: 'text', title: 'text' });
productSchema.index({ lastSyncAt: -1 });

// Método para formatear precio
productSchema.methods.getFormattedPrice = function () {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: this.currency,
  }).format(this.price);
};

// Método para verificar si necesita sincronización
productSchema.methods.needsSync = function () {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return !this.lastSyncAt || this.lastSyncAt < oneHourAgo;
};

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
