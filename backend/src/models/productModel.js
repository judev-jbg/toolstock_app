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
      required: true,
      index: true,
    },
    amz_sellerSku: {
      type: String,
      required: true,
      index: true,
    },
    amz_title: {
      type: String,
      required: true,
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
