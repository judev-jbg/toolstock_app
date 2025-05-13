const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      enum: ['amazon', 'prestashop', 'email', 'whatsapp'],
      required: true,
    },
    externalId: String, // ID en la plataforma de origen
    relatedOrderId: String, // ID del pedido relacionado, si existe
    status: {
      type: String,
      enum: ['new', 'read', 'replied', 'archived'],
      default: 'new',
    },
    subject: String,
    body: {
      type: String,
      required: true,
    },
    fromName: String,
    fromEmail: String,
    fromPhone: String,

    // Si es cliente existente
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
    },

    // Categorización
    category: {
      type: String,
      enum: [
        'product_inquiry', // Consulta sobre producto
        'order_status', // Estado de pedido
        'return_request', // Solicitud de devolución
        'invoice_request', // Solicitud de factura
        'warranty', // Garantía
        'shipping', // Envío
        'complaint', // Queja
        'quote_request', // Solicitud de presupuesto
        'other', // Otro
      ],
      default: 'other',
    },

    // Respuestas
    responses: [
      {
        date: {
          type: Date,
          default: Date.now,
        },
        body: {
          type: String,
          required: true,
        },
        sentBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        sentStatus: {
          type: String,
          enum: ['pending', 'sent', 'failed'],
          default: 'pending',
        },
        errorDetails: String,
      },
    ],

    // Fechas importantes
    responseDeadline: Date, // Fecha límite para responder

    // Asignación
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // Notas internas
    internalNotes: String,

    // Banderas
    isPriority: {
      type: Boolean,
      default: false,
    },
    isAutomaticResponse: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Índices para búsqueda eficiente
messageSchema.index({ source: 1, status: 1 });
messageSchema.index({ relatedOrderId: 1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ responseDeadline: 1 }, { sparse: true });
messageSchema.index({ fromEmail: 1 }, { sparse: true });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
