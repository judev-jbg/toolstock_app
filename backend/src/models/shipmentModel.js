const mongoose = require('mongoose');

const shipmentSchema = new mongoose.Schema(
  {
    idOrder: {
      type: String,
      required: true,
      ref: 'Order',
    },
    servicio: {
      type: Number,
      default: 37, // Servicio estándar GLS
    },
    horario: {
      type: Number,
      default: 3, // Horario estándar
    },
    destinatario: {
      type: String,
      required: true,
    },
    direccion: {
      type: String,
      required: true,
    },
    pais: {
      type: String,
      default: 'ES',
    },
    cp: {
      type: String,
      required: true,
    },
    poblacion: {
      type: String,
      required: true,
    },
    telefono: String,
    email: {
      type: String,
      default: 'orders@toolstock.info',
    },
    departamento: String,
    contacto: String,
    observaciones: String,
    bultos: {
      type: Number,
      default: 1,
    },
    peso: {
      type: Number,
      default: 1,
    },
    movil: String,
    refC: String,
    process: {
      type: String,
      enum: ['isFile', 'isWS'],
      default: 'isFile',
    },
    exported: {
      type: Boolean,
      default: false,
    },
    engraved: {
      type: Boolean,
      default: false,
    },
    fileGenerateName: String,
    updateDateTime: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Índices para búsquedas comunes
shipmentSchema.index({ idOrder: 1 });
shipmentSchema.index({ exported: 1, engraved: 1 });
shipmentSchema.index({ fileGenerateName: 1 });
shipmentSchema.index({ process: 1 });
shipmentSchema.index({ updateDateTime: -1 });

const Shipment = mongoose.model('Shipment', shipmentSchema);

module.exports = Shipment;
