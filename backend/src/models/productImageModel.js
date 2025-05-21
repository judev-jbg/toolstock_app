// backend/src/models/productModel.js (ya existe, verificar si requiere cambios)

// backend/src/models/productImageModel.js (nuevo archivo)
const mongoose = require('mongoose');

const productImageSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    position: {
      type: Number,
      default: 0,
    },
    isMain: {
      type: Boolean,
      default: false,
    },
    title: String,
    alt: String,
  },
  {
    timestamps: true,
  }
);

const ProductImage = mongoose.model('ProductImage', productImageSchema);

module.exports = ProductImage;
