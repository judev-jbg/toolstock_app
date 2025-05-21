// backend/src/controllers/priceConfigController.js
const PriceConfig = require('../models/priceConfigModel');

/**
 * @desc    Obtener configuración de precios actual
 * @route   GET /api/settings/price-config
 * @access  Private
 */
const getPriceConfig = async (req, res) => {
  try {
    let config = await PriceConfig.findOne({ active: true });

    if (!config) {
      // Crear configuración por defecto si no existe
      config = await PriceConfig.create({
        defaultMarginRate: 0.75,
        defaultTaxRate: 21,
        defaultShippingCost: 8,
        prestashopDiscount: 4,
        buyboxPriceDifference: 2,
        weightRanges: [
          { maxWeight: 1, shippingCost: 4.18 },
          { maxWeight: 3, shippingCost: 4.57 },
          { maxWeight: 5, shippingCost: 5.25 },
          { maxWeight: 10, shippingCost: 6.48 },
          { maxWeight: 15, shippingCost: 7.85 },
          { maxWeight: 20, shippingCost: 9.2 },
        ],
      });
    }

    res.json(config);
  } catch (error) {
    console.error('Error al obtener configuración de precios:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

/**
 * @desc    Actualizar configuración de precios
 * @route   PUT /api/settings/price-config
 * @access  Private/Admin
 */
const updatePriceConfig = async (req, res) => {
  try {
    let config = await PriceConfig.findOne({ active: true });

    if (!config) {
      return res.status(404).json({ message: 'Configuración no encontrada' });
    }

    const {
      defaultMarginRate,
      defaultTaxRate,
      defaultShippingCost,
      prestashopDiscount,
      buyboxPriceDifference,
      weightRanges,
    } = req.body;

    // Actualizar campos
    if (defaultMarginRate !== undefined) config.defaultMarginRate = defaultMarginRate;
    if (defaultTaxRate !== undefined) config.defaultTaxRate = defaultTaxRate;
    if (defaultShippingCost !== undefined) config.defaultShippingCost = defaultShippingCost;
    if (prestashopDiscount !== undefined) config.prestashopDiscount = prestashopDiscount;
    if (buyboxPriceDifference !== undefined) config.buyboxPriceDifference = buyboxPriceDifference;
    if (weightRanges) config.weightRanges = weightRanges;

    config.lastUpdated = new Date();

    await config.save();

    res.json({
      message: 'Configuración actualizada',
      config,
    });
  } catch (error) {
    console.error('Error al actualizar configuración de precios:', error);
    res.status(500).json({ message: 'Error en el servidor' });
  }
};

module.exports = {
  getPriceConfig,
  updatePriceConfig,
};
