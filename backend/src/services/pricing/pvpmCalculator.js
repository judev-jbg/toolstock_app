const PricingConfig = require('../../models/pricingConfigModel');
const logger = require('../../utils/logger').createLogger('pvpmCalculator');

class PVPMCalculator {
  constructor() {
    this.config = null;
  }

  async loadConfig() {
    this.config = await PricingConfig.getInstance();
    return this.config;
  }

  /**
   * Calcula el PVPM para un producto
   */
  async calculatePVPM(product) {
    if (!this.config) {
      await this.loadConfig();
    }

    try {
      // 1. Obtener coste (prioritario: customCost, fallback: erp_cost)
      const cost = product.pricing?.customCost || product.erp_cost || 0;

      if (cost <= 0) {
        throw new Error('Coste del producto debe ser mayor a 0');
      }

      // 2. Obtener margen (prioritario: customMargin, fallback: defaultMargin)
      const margin = product.pricing?.customMargin || this.config.defaultMargin;

      // 3. Calcular precio base sin IVA
      const basePrice = cost / margin;

      // 4. Añadir IVA
      const priceWithIVA = basePrice * (1 + this.config.defaultIva);

      // 5. Calcular coste de envío
      const shippingCost = this.calculateShippingCost(product);

      // 6. PVPM final
      const pvpm = priceWithIVA + shippingCost;

      logger.info(`PVPM calculated for ${product.erp_sku}: ${pvpm.toFixed(2)}€`, {
        cost,
        margin,
        basePrice: basePrice.toFixed(2),
        priceWithIVA: priceWithIVA.toFixed(2),
        shippingCost: shippingCost.toFixed(2),
        pvpm: pvpm.toFixed(2),
      });

      return {
        pvpm: Number(pvpm.toFixed(2)),
        breakdown: {
          cost,
          margin,
          basePrice: Number(basePrice.toFixed(2)),
          iva: this.config.defaultIva,
          priceWithIVA: Number(priceWithIVA.toFixed(2)),
          shippingCost: Number(shippingCost.toFixed(2)),
        },
      };
    } catch (error) {
      logger.error(`Error calculating PVPM for ${product.erp_sku}:`, error);
      throw error;
    }
  }

  /**
   * Calcula el coste de envío basado en peso o valor personalizado
   */
  calculateShippingCost(product) {
    // 1. Si tiene coste personalizado, usarlo
    if (product.pricing?.customShippingCost) {
      return product.pricing.customShippingCost;
    }

    // 2. Si no tiene peso o es 0, usar coste por defecto
    const weight = product.erp_weight || 0;
    if (weight <= 0) {
      return this.config.defaultShippingCost;
    }

    // 3. Buscar en tabla de costes por peso
    const shippingTable = this.config.shippingCostTable;

    for (const tier of shippingTable) {
      if (weight <= tier.maxWeight) {
        return tier.cost;
      }
    }

    // 4. Para pesos >20kg: fórmula especial
    const baseOver20 = 9.25;
    const extraWeight = weight - 20;
    const extraCost = extraWeight * 0.47;

    return baseOver20 + extraCost;
  }

  /**
   * Recalcula PVPM para múltiples productos
   */
  async recalculateBulkPVPM(products) {
    const results = {
      success: [],
      errors: [],
    };

    for (const product of products) {
      try {
        const calculation = await this.calculatePVPM(product);
        results.success.push({
          productId: product._id,
          sku: product.erp_sku,
          oldPvpm: product.pricing?.pvpm || 0,
          newPvpm: calculation.pvpm,
          breakdown: calculation.breakdown,
        });
      } catch (error) {
        results.errors.push({
          productId: product._id,
          sku: product.erp_sku,
          error: error.message,
        });
      }
    }

    return results;
  }
}

module.exports = new PVPMCalculator();
