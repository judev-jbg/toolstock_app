const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    shortDescription: String,
    reference: String, // Referencia proveedor

    // Precios
    costPrice: {
      type: Number,
      required: true,
    },
    specialCostPrice: Number, // Costo especial temporal

    taxRate: {
      type: Number,
      default: 21, // IVA España por defecto
    },

    // Margen de ganancia (porcentaje como decimal, ej: 0.75 para 25%)
    marginRate: {
      type: Number,
      default: 0.75,
    },
    specialMarginRate: Number, // Margen especial para este producto

    // Costo de envío
    shippingCost: {
      type: Number,
      default: 8,
    },
    specialShippingCost: Number, // Costo de envío especial

    // Precios calculados
    minPrice: Number, // Precio mínimo calculado

    // Precios de venta actuales
    amazonPrice: Number,
    amazonBusinessPrice: Number,
    amazonMinPrice: Number,
    amazonMaxPrice: Number,
    prestashopPrice: Number,

    // Información del producto
    weight: Number, // Peso en kg
    height: Number, // Altura en cm
    width: Number, // Ancho en cm
    depth: Number, // Profundidad en cm
    ean13: String,
    upc: String,

    // Información del catálogo
    manufacturer: String,
    brand: String,
    category: String,
    subcategory: String,
    tags: [String],

    // Información de stock
    erpStock: {
      type: Number,
      default: 0,
    },
    prestashopStock: {
      type: Number,
      default: 0,
    },
    amazonStock: {
      type: Number,
      default: 0,
    },
    minimumStock: {
      type: Number,
      default: 0,
    },

    // Estado en las plataformas
    activeInPrestashop: {
      type: Boolean,
      default: true,
    },
    activeInAmazon: {
      type: Boolean,
      default: true,
    },

    // ASIN Amazon
    asin: String,

    // Tiempo de preparación (días)
    preparationTime: {
      type: Number,
      default: 1,
    },

    // URLs de imágenes
    mainImage: String,
    images: [String],

    // Datos SEO
    metaTitle: String,
    metaDescription: String,
    metaKeywords: String,

    // Datos de sincronización
    lastSyncWithErp: Date,
    lastSyncWithPrestashop: Date,
    lastSyncWithAmazon: Date,

    // Estado general
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Índices para búsqueda eficiente
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ active: 1 });
productSchema.index({ category: 1, subcategory: 1 });
productSchema.index({ manufacturer: 1 });
productSchema.index({ asin: 1 });

// Virtual para calcular el precio mínimo
productSchema.virtual('calculatedMinPrice').get(function () {
  // Usar costo especial si existe, si no usar el costo normal
  const cost = this.specialCostPrice || this.costPrice;

  // Usar margen especial si existe, si no usar el margen normal
  const margin = this.specialMarginRate || this.marginRate;

  // Usar envío especial si existe, si no usar el envío normal
  const shipping = this.specialShippingCost || this.shippingCost;

  // Calcular precio mínimo: ((costo / margen) + IVA) + costo de envío
  const priceWithoutTax = cost / margin;
  const taxAmount = priceWithoutTax * (this.taxRate / 100);

  return priceWithoutTax + taxAmount + shipping;
});

// Middleware: Actualizar precio mínimo antes de guardar
productSchema.pre('save', function (next) {
  // Calcular y asignar precio mínimo antes de guardar
  this.minPrice = this.calculatedMinPrice;
  next();
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
