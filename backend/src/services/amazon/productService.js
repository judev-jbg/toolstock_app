// backend/src/services/amazon/productService.js
const spApiClient = require('./spApiClient');
const CompetitorPrice = require('../../models/competitorPriceModel');

/**
 * Servicio para integración de productos con Amazon
 */
class AmazonProductService {
  /**
   * Sincroniza un producto con Amazon
   * @param {Object} product - Producto a sincronizar
   * @returns {Promise<Object>} Resultado de la sincronización
   */
  async syncProduct(product) {
    try {
      // Verificar si tiene ASIN
      if (!product.asin) {
        throw new Error('El producto no tiene ASIN definido');
      }

      // Verificar que los campos obligatorios estén completos
      if (!product.name || !product.description || !product.amazonPrice) {
        throw new Error('Faltan campos obligatorios (nombre, descripción, precio)');
      }

      // Actualizar precio
      await this.updatePrice(product.asin, product.amazonPrice);

      // Actualizar stock
      await this.updateInventory(product.asin, product.amazonStock || 10); // Default 10 si no hay stock definido

      // Actualizar tiempo de preparación si está definido
      if (product.preparationTime) {
        await this.updateLeadTime(product.asin, product.preparationTime);
      }

      return {
        success: true,
        message: 'Producto sincronizado correctamente',
      };
    } catch (error) {
      console.error('Error sincronizando producto con Amazon:', error);
      throw error;
    }
  }

  /**
   * Actualiza el precio de un producto en Amazon
   * @param {string} asin - ASIN del producto
   * @param {number} price - Nuevo precio
   * @returns {Promise<Object>} Resultado de la actualización
   */
  async updatePrice(asin, price) {
    try {
      const client = await spApiClient.getClient();

      // Usar el endpoint de Pricing API
      const response = await spApiClient.executeWithRetry(async (client) => {
        return client.callAPI({
          operation: 'pricingV0.submitPriceBatch',
          body: {
            prices: [
              {
                asin,
                price: {
                  amount: price,
                  currencyCode: 'EUR',
                },
              },
            ],
          },
        });
      });

      return {
        success: true,
        response,
      };
    } catch (error) {
      console.error('Error actualizando precio en Amazon:', error);
      throw error;
    }
  }

  /**
   * Actualiza el inventario de un producto en Amazon
   * @param {string} asin - ASIN del producto
   * @param {number} quantity - Nueva cantidad
   * @returns {Promise<Object>} Resultado de la actualización
   */
  async updateInventory(asin, quantity) {
    try {
      const client = await spApiClient.getClient();

      // Usar el endpoint de Inventory API
      const response = await spApiClient.executeWithRetry(async (client) => {
        return client.callAPI({
          operation: 'fbaInventoryV1.updateInventoryQuantity',
          body: {
            sellerSku: asin, // Usar ASIN como SKU
            inventory: {
              quantity: quantity,
            },
          },
        });
      });

      return {
        success: true,
        response,
      };
    } catch (error) {
      console.error('Error actualizando inventario en Amazon:', error);
      throw error;
    }
  }

  /**
   * Actualiza el tiempo de preparación de un producto en Amazon
   * @param {string} asin - ASIN del producto
   * @param {number} leadTime - Nuevo tiempo de preparación (días)
   * @returns {Promise<Object>} Resultado de la actualización
   */
  async updateLeadTime(asin, leadTime) {
    try {
      const client = await spApiClient.getClient();

      // Usar el endpoint adecuado para tiempos de preparación
      const response = await spApiClient.executeWithRetry(async (client) => {
        return client.callAPI({
          operation: 'listingsV20200901.updateListingsItem',
          path: {
            sellerId: process.env.AMAZON_SELLER_ID,
            sku: asin,
          },
          body: {
            attributes: {
              fulfillment_availability: [
                {
                  fulfillment_channel_code: 'DEFAULT',
                  quantity: 10, // Valor por defecto
                  leadtime_to_ship_max_days: leadTime,
                },
              ],
            },
          },
        });
      });

      return {
        success: true,
        response,
      };
    } catch (error) {
      console.error('Error actualizando tiempo de preparación en Amazon:', error);
      throw error;
    }
  }

  /**
   * Obtiene precios de competencia para un producto
   * @param {string} asin - ASIN del producto
   * @param {string} productId - ID del producto en nuestra base de datos
   * @param {string} sku - SKU del producto
   * @returns {Promise<Object>} Resultado de la consulta
   */
  async getCompetitorPrices(asin, productId, sku) {
    try {
      const client = await spApiClient.getClient();

      // Usar el endpoint de Competitive Pricing API
      const response = await spApiClient.executeWithRetry(async (client) => {
        return client.callAPI({
          operation: 'productPricingV0.getCompetitivePricing',
          query: {
            MarketplaceId: process.env.AMAZON_MARKETPLACE_ID,
            Asins: [asin],
          },
        });
      });

      // Procesar respuesta y guardar en base de datos
      if (
        response &&
        response.payload &&
        response.payload.length > 0 &&
        response.payload[0].Product &&
        response.payload[0].Product.CompetitivePricing &&
        response.payload[0].Product.CompetitivePricing.CompetitivePrices
      ) {
        const competitivePrices = response.payload[0].Product.CompetitivePricing.CompetitivePrices;

        // Eliminar precios antiguos (más de 30 días)
        await CompetitorPrice.deleteMany({
          product: productId,
          lastChecked: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        });

        // Guardar nuevos precios
        const savedPrices = [];

        for (const priceData of competitivePrices) {
          const competitor = priceData.Price;
          const price = competitor.LandedPrice ? parseFloat(competitor.LandedPrice.Amount) : 0;
          const businessPrice = competitor.BusinessPrice
            ? parseFloat(competitor.BusinessPrice.Amount)
            : 0;

          // Crear o actualizar precio de competidor
          const newPrice = await CompetitorPrice.findOneAndUpdate(
            {
              product: productId,
              sellerId: priceData.sellerId || 'unknown',
            },
            {
              asin,
              sku,
              sellerName: priceData.sellerName || 'Unknown Seller',
              sellerId: priceData.sellerId || 'unknown',
              price,
              businessPrice,
              hasBuyBox: priceData.isBuyBoxWinner || false,
              isFBA: priceData.fulfillmentChannel === 'Amazon' || false,
              isAmazon: priceData.sellerId === 'ATVPDKIKX0DER' || false, // ID de Amazon como vendedor
              condition: priceData.condition || 'new',
              shippingTime: priceData.shippingTime || 0,
              lastChecked: new Date(),
              $push: {
                priceHistory: {
                  price,
                  date: new Date(),
                  hasBuyBox: priceData.isBuyBoxWinner || false,
                },
              },
            },
            { new: true, upsert: true }
          );

          savedPrices.push(newPrice);
        }

        return {
          success: true,
          count: savedPrices.length,
          prices: savedPrices,
        };
      }

      return {
        success: false,
        message: 'No se encontraron datos de precios competitivos',
      };
    } catch (error) {
      console.error('Error obteniendo precios de competencia:', error);
      throw error;
    }
  }
}

module.exports = new AmazonProductService();
