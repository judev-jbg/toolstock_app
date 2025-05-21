const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    // Identificadores
    sku: {
      type: String,
      required: true,
      unique: true,
      index: true,
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
    reference: String, // Referencia proveedor (idArticuloProv en ERP)

    // Códigos y referencias
    asin: {
      type: String,
      sparse: true,
      index: true,
    },
    ean13: String, // CodBarras en ERP
    upc: String,

    // Precios y costos
    costPrice: {
      type: Number,
      required: true,
    },
    specialCostPrice: Number, // Costo especial temporal

    // Margen y configuración de precios
    taxRate: {
      type: Number,
      default: 21, // IVA España por defecto
    },
    marginRate: {
      type: Number,
      default: 0.75, // 0.75 = 25% de margen
    },
    specialMarginRate: Number, // Margen especial para este producto

    // Costos de envío
    shippingCost: {
      type: Number,
      default: 8,
    },
    specialShippingCost: Number, // Costo de envío especial

    // Precio mínimo calculado
    minPrice: Number, // PVPM: Precio mínimo calculado

    // Precios de venta
    amazonPrice: Number, // Precio en Amazon (con IVA)
    amazonBusinessPrice: Number, // Precio para empresas
    amazonMinPrice: Number, // Precio mínimo Amazon
    amazonMaxPrice: Number, // Precio máximo Amazon
    prestashopPrice: Number, // PVP en Prestashop (sin IVA)
    prestashopOfferPrice: Number, // Precio de oferta en Prestashop
    isWebOffer: {
      type: Boolean,
      default: false,
    }, // True cuando Observaciones contiene "OFERTA WEB"

    // Información física
    weight: Number, // Peso en kg
    height: Number, // Altura en cm
    width: Number, // Ancho en cm
    depth: Number, // Profundidad en cm

    // Categorización
    manufacturer: String, // MarcaDescrip en ERP
    brand: String,
    category: String, // Familia en ERP
    subcategory: String,
    tags: [String],

    // Inventario
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
    equalizeStockWithErp: {
      type: Boolean,
      default: false,
    }, // Check "igualar stock ERP"
    setManualStock: {
      type: Boolean,
      default: false,
    }, // Check "establecer stock"

    // Estados en plataformas
    active: {
      type: Boolean,
      default: true, // Estado en ERP (0 = Activo, 1 = Anulado)
    },
    activeInPrestashop: {
      type: Boolean,
      default: true,
    },
    activeInAmazon: {
      type: Boolean,
      default: true,
    },

    // Estado en Amazon
    hasBuyBox: {
      type: Boolean,
      default: false,
    },

    // Tiempo de preparación (días)
    preparationTime: {
      type: Number,
      default: 3, // 3 días por defecto
    },

    // URLs de imágenes
    mainImage: String,
    images: [String],

    // Datos de sincronización
    lastSyncWithErp: Date,
    lastSyncWithPrestashop: Date,
    lastSyncWithAmazon: Date,
    lastPriceUpdate: Date,
    lastCompetitorCheck: Date,
  },
  {
    timestamps: true,
  }
);

// Índices para búsqueda eficiente
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ manufacturer: 1 });
productSchema.index({ category: 1 });
productSchema.index({ active: 1 });

// Virtual para calcular el precio mínimo (PVPM)
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

  // Asegurar que el precio de Prestashop sea 4% menor que Amazon
  if (this.amazonPrice && !this.isWebOffer) {
    this.prestashopPrice = this.amazonPrice * 0.96;
  }

  next();
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
