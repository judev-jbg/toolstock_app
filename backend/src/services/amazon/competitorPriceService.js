// backend/src/services/amazon/competitorPriceService.js
const CompetitorPrice = require('../../models/competitorPriceModel');
const Product = require('../../models/productModel');
const ProductSettings = require('../../models/productSettings');
const amazonApiClient = require('./spApiClient');

class CompetitorPriceService {
  /**
   * Obtiene los precios de competencia para un producto
   * @param {string} asin - ASIN del producto
   * @param {string} productId - ID del producto en nuestra base de datos
   * @param {string} sku - SKU del producto
   * @returns {Promise<Object>} Resultado de la consulta
   */
  async getCompetitorPrices(asin, productId, sku) {
    try {
      // Usar la API de Amazon para obtener precios de competencia
      const result = await this._fetchCompetitorPrices(asin);

      if (!result || !result.success) {
        return {
          success: false,
          message: result?.message || 'No se pudieron obtener precios de competencia',
        };
      }

      // Guardar precios en nuestra base de datos
      await this._saveCompetitorPrices(result.prices, productId, asin, sku);

      // Verificar si tenemos el Buy Box
      const hasBuyBox = await this._checkBuyBoxStatus(productId);

      // Actualizar estado del Buy Box en el producto
      await Product.findByIdAndUpdate(productId, { hasBuyBox });

      return {
        success: true,
        message: 'Precios de competencia actualizados correctamente',
        hasBuyBox,
        count: result.prices.length,
      };
    } catch (error) {
      console.error('Error obteniendo precios de competencia:', error);
      throw error;
    }
  }

  /**
   * Optimiza el precio de un producto basado en la competencia
   * @param {string} productId - ID del producto
   * @returns {Promise<Object>} Resultado de la optimización
   */
  async optimizePrice(productId) {
    try {
      // Obtener producto
      const product = await Product.findById(productId);
      if (!product) {
        throw new Error('Producto no encontrado');
      }

      // Verificar si tiene ASIN
      if (!product.asin) {
        throw new Error('El producto no tiene ASIN definido');
      }

      // Obtener configuración global
      const settings = await ProductSettings.getSettings();

      // Obtener precios de competencia recientes
      const competitorPrices = await CompetitorPrice.find({
        product: productId,
        lastChecked: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      })
        .sort('price')
        .limit(10)
        .lean();

      if (competitorPrices.length === 0) {
        throw new Error('No hay datos de competencia recientes');
      }

      // Calcular precio óptimo
      const lowestCompetitorPrice = competitorPrices[0].price;
      const priceDifference = settings.amazonPriceCompetitionDifference || 2;

      // Calcular el nuevo precio: Competidor más bajo menos la diferencia,
      // pero nunca por debajo del precio mínimo
      let optimalPrice = Math.max(lowestCompetitorPrice - priceDifference, product.minPrice);

      // Redondear a dos decimales
      optimalPrice = Math.round(optimalPrice * 100) / 100;

      // Actualizar precio en Amazon si es diferente
      if (optimalPrice !== product.amazonPrice) {
        // Actualizar en la base de datos
        product.amazonPrice = optimalPrice;
        product.lastPriceUpdate = new Date();
        await product.save();

        // Sincronizar con Amazon
        await this._updateAmazonPrice(product.asin, optimalPrice);

        return {
          success: true,
          message: 'Precio optimizado correctamente',
          previousPrice: product.amazonPrice,
          newPrice: optimalPrice,
          lowestCompetitorPrice,
          priceDifference,
        };
      } else {
        return {
          success: true,
          message: 'El precio ya está optimizado',
          price: optimalPrice,
        };
      }
    } catch (error) {
      console.error('Error optimizando precio:', error);
      throw error;
    }
  }

  /**
   * Busca productos sin Buy Box y los optimiza
   * @param {number} limit - Número máximo de productos a optimizar
   * @returns {Promise<Object>} Resultado de la optimización
   */
  async optimizeProductsWithoutBuyBox(limit = 10) {
    try {
      // Buscar productos activos en Amazon sin Buy Box
      const products = await Product.find({
        activeInAmazon: true,
        hasBuyBox: false,
        asin: { $exists: true, $ne: '' },
      })
        .sort('lastPriceUpdate')
        .limit(limit);

      if (products.length === 0) {
        return {
          success: true,
          message: 'No hay productos para optimizar',
          count: 0,
        };
      }

      const results = [];
      let optimizedCount = 0;

      for (const product of products) {
        try {
          // Intentar optimizar precio
          const result = await this.optimizePrice(product._id);
          results.push({
            sku: product.sku,
            asin: product.asin,
            result,
          });

          if (result.success && result.newPrice) {
            optimizedCount++;
          }
        } catch (error) {
          console.error(`Error optimizando precio para ${product.sku}:`, error);
          results.push({
            sku: product.sku,
            asin: product.asin,
            error: error.message,
          });
        }
      }

      return {
        success: true,
        message: `Se optimizaron ${optimizedCount} de ${products.length} productos`,
        optimizedCount,
        totalCount: products.length,
        results,
      };
    } catch (error) {
      console.error('Error en optimización masiva:', error);
      throw error;
    }
  }

  // Métodos privados

  async _fetchCompetitorPrices(asin) {
    try {
      // Implementación real que usaría la SP-API de Amazon
      // Por ahora, simulamos datos para pruebas

      // Para integración real, descomentar y adaptar:
      /*
      const response = await amazonApiClient.callAPI({
        operation: 'productPricingV0.getCompetitivePricing',
        query: {
          MarketplaceId: process.env.AMAZON_MARKETPLACE_ID,
          Asins: [asin],
        }
      });
      
      // Procesar respuesta de la API
      if (!response || !response.payload || response.payload.length === 0) {
        return { success: false, message: 'No hay datos de precios disponibles' };
      }
      
      const competitiveData = response.payload[0].Product.CompetitivePricing.CompetitivePrices;
      
      // Transformar datos
      const prices = competitiveData.map(item => ({
        sellerName: item.sellerId === 'ATVPDKIKX0DER' ? 'Amazon' : `Seller ${item.sellerId.substring(0, 5)}`,
        sellerId: item.sellerId,
        price: item.Price.LandedPrice.Amount,
        businessPrice: item.Price.BusinessPrice?.Amount || 0,
        hasBuyBox: item.isBuyBoxWinner || false,
        isFBA: item.fulfillmentChannel === 'Amazon',
        isAmazon: item.sellerId === 'ATVPDKIKX0DER',
        condition: item.condition || 'new',
      }));
      */

      // Datos de prueba (quitar en producción)
      const prices = [
        {
          sellerName: 'Amazon',
          sellerId: 'ATVPDKIKX0DER',
          price: 49.99,
          businessPrice: 45.99,
          hasBuyBox: true,
          isFBA: true,
          isAmazon: true,
          condition: 'new',
        },
        {
          sellerName: 'MiTienda',
          sellerId: process.env.AMAZON_SELLER_ID || 'YOUR_SELLER_ID',
          price: 51.99,
          businessPrice: 0,
          hasBuyBox: false,
          isFBA: false,
          isAmazon: false,
          condition: 'new',
        },
        {
          sellerName: 'Competidor1',
          sellerId: 'SELLR12345',
          price: 52.99,
          businessPrice: 0,
          hasBuyBox: false,
          isFBA: true,
          isAmazon: false,
          condition: 'new',
        },
      ];

      return {
        success: true,
        prices,
      };
    } catch (error) {
      console.error('Error consultando precios de competencia en Amazon:', error);
      throw error;
    }
  }

  async _saveCompetitorPrices(prices, productId, asin, sku) {
    try {
      // Eliminar precios antiguos (más de 30 días)
      await CompetitorPrice.deleteMany({
        product: productId,
        lastChecked: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      });

      // Guardar nuevos precios
      for (const priceData of prices) {
        // Crear o actualizar precio de competidor
        await CompetitorPrice.findOneAndUpdate(
          {
            product: productId,
            sellerId: priceData.sellerId,
          },
          {
            asin,
            sku,
            sellerName: priceData.sellerName,
            sellerId: priceData.sellerId,
            price: priceData.price,
            businessPrice: priceData.businessPrice,
            hasBuyBox: priceData.hasBuyBox,
            isFBA: priceData.isFBA,
            isAmazon: priceData.isAmazon,
            condition: priceData.condition,
            lastChecked: new Date(),
            $push: {
              priceHistory: {
                price: priceData.price,
                date: new Date(),
                hasBuyBox: priceData.hasBuyBox,
              },
            },
          },
          { new: true, upsert: true }
        );
      }
    } catch (error) {
      console.error('Error guardando precios de competencia:', error);
      throw error;
    }
  }

  async _checkBuyBoxStatus(productId) {
    try {
      // Buscar si algún competidor con nuestro ID de vendedor tiene el Buy Box
      const myCompetitor = await CompetitorPrice.findOne({
        product: productId,
        sellerId: process.env.AMAZON_SELLER_ID || 'YOUR_SELLER_ID',
        hasBuyBox: true,
      });

      return !!myCompetitor;
    } catch (error) {
      console.error('Error verificando estado del Buy Box:', error);
      return false;
    }
  }

  async _updateAmazonPrice(asin, price) {
    try {
      // Implementación real que usaría la SP-API de Amazon
      // Por ahora, simulamos la actualización

      // Para integración real, descomentar y adaptar:
      /*
      const response = await amazonApiClient.callAPI({
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
      
      return response;
      */

      console.log(`[SIMULACIÓN] Precio actualizado en Amazon para ${asin}: ${price}€`);
      return { success: true };
    } catch (error) {
      console.error('Error actualizando precio en Amazon:', error);
      throw error;
    }
  }
}

module.exports = new CompetitorPriceService();
