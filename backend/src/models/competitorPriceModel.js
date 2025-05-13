const mongoose = require('mongoose');

const competitorPriceSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    asin: {
      type: String,
      required: true,
    },
    sku: {
      type: String,
      required: true,
    },

    // Competidor
    sellerName: {
      type: String,
      required: true,
    },
    sellerId: String,

    // Precios
    price: {
      type: Number,
      required: true,
    },
    businessPrice: Number,

    // Estado
    hasBuyBox: {
      type: Boolean,
      default: false,
    },
    isFBA: {
      type: Boolean,
      default: false,
    },
    isAmazon: {
      type: Boolean,
      default: false,
    },
    condition: {
      type: String,
      enum: ['new', 'used', 'refurbished'],
      default: 'new',
    },

    // Datos de envío
    shippingTime: Number, // Días de envío

    // Última actualización
    lastChecked: {
      type: Date,
      default: Date.now,
    },

    // Historial de precio (últimos cambios)
    priceHistory: [
      {
        price: Number,
        date: {
          type: Date,
          default: Date.now,
        },
        hasBuyBox: Boolean,
      },
    ],

    // Nuestra diferencia de precio
    priceDifference: Number, // Diferencia actual
    pricePercentageDifference: Number, // Diferencia en porcentaje
  },
  {
    timestamps: true,
  }
);

// Índices para búsqueda eficiente
competitorPriceSchema.index({ product: 1, sellerName: 1 });
competitorPriceSchema.index({ asin: 1 });
competitorPriceSchema.index({ sku: 1 });
competitorPriceSchema.index({ hasBuyBox: 1 });
competitorPriceSchema.index({ lastChecked: -1 });

// Middleware: Calcular diferencia de precios antes de guardar
competitorPriceSchema.pre('save', async function (next) {
  try {
    // Si el producto tiene un precio en Amazon, calcular la diferencia
    if (this.isModified('price')) {
      const Product = mongoose.model('Product');
      const product = await Product.findById(this.product).select('amazonPrice');

      if (product && product.amazonPrice) {
        this.priceDifference = product.amazonPrice - this.price;
        this.pricePercentageDifference = (this.priceDifference / this.price) * 100;
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

const CompetitorPrice = mongoose.model('CompetitorPrice', competitorPriceSchema);

module.exports = CompetitorPrice;
