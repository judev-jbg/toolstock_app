const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    asin: {
      type: String,
      required: true,
      index: true,
    },
    sellerSku: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    brand: {
      type: String,
      default: '',
      index: true,
    },
    price: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: 'EUR',
    },
    quantity: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      default: '',
      index: true,
    },
    condition: {
      type: String,
      default: '',
    },
    fulfillmentChannel: {
      type: String,
      default: '',
    },
    productType: {
      type: String,
      default: '',
    },
    imageUrl: {
      type: String,
      default: '',
    },
    // Datos adicionales de Amazon
    amazonData: {
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
    lastSyncAt: {
      type: Date,
      default: Date.now,
    },
    lastInventoryUpdate: {
      type: Date,
    },
    // Estado de sincronización
    syncStatus: {
      type: String,
      enum: ['synced', 'pending', 'error'],
      default: 'pending',
    },
    syncError: {
      type: String,
      default: '',
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
