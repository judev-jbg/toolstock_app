const mongoose = require('mongoose');

// Esquema para artículos del pedido
const orderItemSchema = new mongoose.Schema(
  {
    orderItemId: {
      type: String,
      required: true,
    },
    sku: {
      type: String,
      required: true,
    },
    productName: {
      type: String,
      required: true,
    },
    quantityPurchased: {
      type: Number,
      required: true,
      min: 1,
    },
    itemPrice: {
      type: Number,
      required: true,
    },
    itemTax: {
      type: Number,
      default: 0,
    },
    shippingPrice: {
      type: Number,
      default: 0,
    },
    shippingTax: {
      type: Number,
      default: 0,
    },
    vatExclusiveItemPrice: {
      type: Number,
    },
    vatExclusiveShippingPrice: {
      type: Number,
      default: 0,
    },
    asin: String,
    referenciaProv: String,
  },
  { _id: false }
);

// Esquema principal de pedido
const orderSchema = new mongoose.Schema(
  {
    amazonOrderId: {
      type: String,
      required: true,
      unique: true,
    },
    source: {
      type: String,
      enum: ['amazon', 'prestashop'],
      required: true,
    },
    prestashopOrderId: {
      type: String,
      sparse: true,
    },

    // Campos de estado y fechas principales
    orderStatus: {
      type: String,
      required: true,
      enum: [
        'Pendiente de envío',
        'Enviado',
        'Cancelado',
        'Entregado',
        'En tránsito',
        'Pendiente disponibilidad',
      ],
      default: 'Pendiente de envío',
    },
    purchaseDate: {
      type: Date,
      required: true,
    },
    paymentsDate: Date,
    latestShipDate: Date,
    latestDeliveryDate: Date,

    // Campos de entrega adicionales
    deliveryStartDate: Date,
    deliveryEndDate: Date,
    deliveryTimeZone: String,
    deliveryInstructions: String,
    shipServiceLevel: String,

    // Información del comprador
    buyerEmail: String,
    buyerName: {
      type: String,
      required: true,
    },
    buyerPhoneNumber: String,
    buyerCompanyName: String,
    buyerTaxRegistrationId: String,
    buyerTaxRegistrationCountry: String,
    buyerTaxRegistrationType: String,
    buyerCstNumber: String,
    buyerVatNumber: String,

    // Información de envío
    recipientName: String,
    shipAddress1: String,
    shipAddress2: String,
    shipAddress3: String,
    shipCity: String,
    shipState: String,
    shipPostalCode: String,
    shipCountry: String,
    shipPhoneNumber: String,

    // Información de facturación
    billName: String,
    billAddress1: String,
    billAddress2: String,
    billAddress3: String,
    billCity: String,
    billState: String,
    billPostalCode: String,
    billCountry: String,

    // Información de canal de venta
    salesChannel: String,
    orderChannel: String,
    orderChannelInstance: String,
    externalOrderId: String,

    // Información de negocio
    isBusinessOrder: {
      type: Boolean,
      default: false,
    },
    purchaseOrderNumber: String,
    priceDesignation: String,

    // Información de facturación e impuestos
    isAmazonInvoiced: {
      type: Boolean,
      default: false,
    },
    currency: String,
    numberOfItems: Number,

    // Estados de procesamiento específicos de ts orders manager
    pendingWithoutStock: {
      type: Boolean,
      default: false,
    },
    markForShipment: {
      type: Boolean,
      default: false,
    },
    selectedForShipment: {
      type: Boolean,
      default: false,
    },
    isShipFake: {
      type: Boolean,
      default: false,
    },
    isIba: Boolean,
    isBuyerRequestedCancellation: {
      type: Boolean,
      default: false,
    },
    buyerRequestedCancelReason: String,

    // Información de envío y seguimiento
    expeditionTraking: String,
    codBar: String,
    uIdExp: String,
    statusShip: String,
    dateShip: Date,

    // Fechas de actualización específicas
    loadDate: Date,
    loadDateTime: Date,

    // Campos para integración con PrestaShop
    id_order_ps: String,
    reference_ps: String,

    // Estadísticas (esto se calculará en cada consulta)
    qOrders: {
      type: Number,
      default: 0,
    },
    qOrderShip: {
      type: Number,
      default: 0,
    },

    // Artículos del pedido
    items: [orderItemSchema],
  },
  {
    timestamps: true,
  }
);

// Índices para búsqueda eficiente
orderSchema.index({ amazonOrderId: 1 });
orderSchema.index({ prestashopOrderId: 1 });
orderSchema.index({ purchaseDate: -1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ buyerEmail: 1 });
orderSchema.index({ pendingWithoutStock: 1, orderStatus: 1 });
orderSchema.index({ markForShipment: 1 });
orderSchema.index({ selectedForShipment: 1 });
orderSchema.index({ isShipFake: 1 });
orderSchema.index({ expeditionTraking: 1 });
orderSchema.index({ loadDateTime: -1 });

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
