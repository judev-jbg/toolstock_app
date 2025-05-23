const spApiClient = require('./spApiClient');
const Product = require('../../models/productModel');
const logger = require('../../utils/logger').createLogger('amazonService');

class AmazonService {
  constructor() {
    this.marketplaceId = process.env.AMAZON_MARKETPLACE_ID || 'A1RKKUPIHCS9HS'; // España
    this.sellerId = process.env.AMAZON_SELLER_ID;
  }

  /**
   * Obtiene todos los productos del inventario FBA de Amazon
   */
  async getFBAInventory() {
    try {
      const result = await spApiClient.executeWithRetry(async (client) => {
        const response = await client.callAPI({
          operation: 'getInventorySummaries',
          endpoint: 'fbaInventory',
          query: {
            granularityType: 'Marketplace',
            granularityId: this.marketplaceId,
            marketplaceIds: [this.marketplaceId],
          },
        });
        return response;
      });

      logger.info(`Retrieved ${result.inventorySummaries?.length || 0} FBA inventory items`);
      return result.inventorySummaries || [];
    } catch (error) {
      logger.error('Error getting FBA inventory:', error);
      return [];
    }
  }

  /**
   * Obtiene listings de productos usando el endpoint correcto con paginación completa
   */
  async getAllListingsItems() {
    try {
      if (!this.sellerId) {
        logger.warn('AMAZON_SELLER_ID not configured, skipping listings');
        return [];
      }

      let allItems = [];
      let nextToken = null;
      let pageCount = 0;

      do {
        const result = await spApiClient.executeWithRetry(async (client) => {
          const query = {
            marketplaceIds: [this.marketplaceId],
            pageSize: 20,
            includedData: ['summaries', 'attributes', 'offers', 'fulfillmentAvailability'],
          };

          // Usar pageToken en lugar de nextToken
          if (nextToken) {
            query.pageToken = nextToken;
          }

          const response = await client.callAPI({
            operation: 'searchListingsItems',
            endpoint: 'listingsItems',
            path: {
              sellerId: this.sellerId,
            },
            query,
          });
          return response;
        });

        const items = result.items || [];
        allItems = allItems.concat(items);

        // El nextToken viene en pagination.nextToken
        nextToken = result.pagination?.nextToken;
        pageCount++;

        logger.info(
          `Page ${pageCount}: Retrieved ${items.length} items (Total: ${allItems.length})`
        );

        // Límite de seguridad para evitar bucles infinitos
        if (pageCount > 100) {
          logger.warn('Reached maximum page limit, stopping pagination');
          break;
        }
      } while (nextToken);

      logger.info(`Retrieved total of ${allItems.length} listings items in ${pageCount} pages`);
      return allItems;
    } catch (error) {
      logger.error('Error getting listings items:', error);
      return [];
    }
  }

  /**
   * Obtiene un listing específico por SKU
   */
  async getListingItem(sku) {
    try {
      if (!this.sellerId) {
        logger.warn('AMAZON_SELLER_ID not configured');
        return null;
      }

      const result = await spApiClient.executeWithRetry(async (client) => {
        const response = await client.callAPI({
          operation: 'getListingsItem',
          endpoint: 'listingsItems',
          path: {
            sellerId: this.sellerId,
            sku: sku,
          },
          query: {
            marketplaceIds: [this.marketplaceId],
            includedData: [
              'summaries',
              'attributes',
              'issues',
              'offers',
              'fulfillmentAvailability',
            ],
          },
        });
        return response;
      });

      logger.info(`Retrieved listing for SKU: ${sku}`);
      return result;
    } catch (error) {
      logger.error(`Error getting listing for SKU ${sku}:`, error);
      return null;
    }
  }

  /**
   * Sincroniza productos con la base de datos local
   */
  async syncProductsWithDatabase() {
    try {
      logger.info('Starting comprehensive product synchronization...');

      const syncResults = {
        created: 0,
        updated: 0,
        errors: 0,
        sources: {
          fba: 0,
          listings: 0,
        },
      };

      // 1. Obtener inventario FBA
      const fbaItems = await this.getFBAInventory();
      logger.info(`Processing ${fbaItems.length} FBA items`);

      for (const item of fbaItems) {
        try {
          const productData = this.mapFBAItemToProduct(item);
          await this.upsertProduct(productData);
          syncResults.sources.fba++;
        } catch (error) {
          logger.error(`Error processing FBA item ${item.sellerSku}:`, error);
          syncResults.errors++;
        }
      }

      // 2. Obtener TODOS los listings (productos MFN y adicionales)
      const allListings = await this.getAllListingsItems();
      logger.info(`Processing ${allListings.length} listings`);

      for (const listing of allListings) {
        try {
          const productData = this.mapListingToProduct(listing);
          const result = await this.upsertProduct(productData);

          if (result.upserted) {
            syncResults.created++;
          } else {
            syncResults.updated++;
          }
          syncResults.sources.listings++;
        } catch (error) {
          logger.error(`Error processing listing ${listing.sku}:`, error);
          syncResults.errors++;
        }
      }

      logger.info('Product synchronization completed:', syncResults);
      return syncResults;
    } catch (error) {
      logger.error('Error in product synchronization:', error);
      throw error;
    }
  }

  /**
   * Mapea un item de inventario FBA a formato de producto
   */
  mapFBAItemToProduct(fbaItem) {
    return {
      asin: fbaItem.asin || '',
      sellerSku: fbaItem.sellerSku,
      title: fbaItem.productName || fbaItem.sellerSku,
      brand: this.extractBrandFromTitle(fbaItem.productName || ''),
      quantity: fbaItem.totalQuantity || 0,
      condition: fbaItem.condition || 'New',
      fulfillmentChannel: 'AFN', // Amazon Fulfillment Network (FBA)
      status: this.determineProductStatus(fbaItem),
      price: 0,
      currency: 'EUR',
      productType: 'physical',
      amazonData: {
        itemName: fbaItem.productName || '',
        fnsku: fbaItem.fnsku || '',
        reservedQuantity: fbaItem.reservedQuantity || 0,
        inboundWorkingQuantity: fbaItem.inboundWorkingQuantity || 0,
        inboundShippedQuantity: fbaItem.inboundShippedQuantity || 0,
        inboundReceivingQuantity: fbaItem.inboundReceivingQuantity || 0,
      },
    };
  }

  /**
   * Mapea un listing a formato de producto (con estructura real de la API)
   */
  mapListingToProduct(listing) {
    const summary = listing.summaries?.[0] || {};
    const attributes = listing.attributes || {};
    const offers = listing.offers || [];
    const fulfillmentAvailability = listing.fulfillmentAvailability || [];

    // Extraer información clave
    const asin = summary.asin || '';
    const title = summary.itemName || listing.sku;
    const brand = this.extractBrandFromAttributes(attributes);
    const price = this.extractPriceFromOffers(offers, attributes);
    const quantity = this.extractQuantityFromFulfillment(fulfillmentAvailability, attributes);
    const status = this.mapListingStatus(summary.status);
    const imageUrl =
      summary.mainImage?.link || attributes.main_product_image_locator?.[0]?.media_location || '';

    return {
      asin,
      sellerSku: listing.sku,
      title,
      brand,
      quantity,
      condition: this.mapConditionType(summary.conditionType || 'new_new'),
      fulfillmentChannel: this.determineFulfillmentChannel(fulfillmentAvailability, attributes),
      status,
      price,
      currency: 'EUR',
      productType: summary.productType || 'physical',
      imageUrl,
      amazonData: {
        itemName: title,
        listingId: listing.listingId || '',
        productId: summary.productId || '',
        productType: summary.productType || '',
        productIdType: summary.productIdType || '',
        itemCondition: summary.conditionType || 'new_new',
        listingStatus: summary.status || [],
        createdDate: summary.createdDate || '',
        lastUpdatedDate: summary.lastUpdatedDate || '',
        mainImageUrl: imageUrl,
        manufacturer: attributes.manufacturer?.[0]?.value || '',
        ean:
          attributes.externally_assigned_product_identifier?.find((id) => id.type === 'ean')
            ?.value || '',
        upc:
          attributes.externally_assigned_product_identifier?.find((id) => id.type === 'upc')
            ?.value || '',
      },
    };
  }

  /**
   * Extrae la marca de los atributos
   */
  extractBrandFromAttributes(attributes) {
    // Prioridad: brand > manufacturer > extraer del título
    if (attributes.brand && attributes.brand[0]?.value) {
      return attributes.brand[0].value;
    }

    if (attributes.manufacturer && attributes.manufacturer[0]?.value) {
      return attributes.manufacturer[0].value;
    }

    return '';
  }

  /**
   * Extrae el precio de offers o attributes
   */
  extractPriceFromOffers(offers, attributes) {
    // Prioridad: offers > purchasable_offer en attributes
    if (offers && offers.length > 0) {
      const b2cOffer = offers.find(
        (offer) => offer.offerType === 'B2C' || offer.audience?.value === 'ALL'
      );
      if (b2cOffer && b2cOffer.price?.amount) {
        return parseFloat(b2cOffer.price.amount) || 0;
      }
    }

    // Fallback a purchasable_offer en attributes
    if (attributes.purchasable_offer && attributes.purchasable_offer[0]) {
      const priceSchedule = attributes.purchasable_offer[0].our_price?.[0]?.schedule?.[0];
      if (priceSchedule?.value_with_tax) {
        return parseFloat(priceSchedule.value_with_tax) || 0;
      }
    }

    return 0;
  }

  /**
   * Extrae la cantidad de fulfillmentAvailability o attributes
   */
  extractQuantityFromFulfillment(fulfillmentAvailability, attributes) {
    // Prioridad: fulfillmentAvailability > attributes.fulfillment_availability
    if (fulfillmentAvailability && fulfillmentAvailability.length > 0) {
      // Sumar cantidades de todos los canales
      return fulfillmentAvailability.reduce((total, fa) => total + (fa.quantity || 0), 0);
    }

    // Fallback a attributes
    if (attributes.fulfillment_availability && attributes.fulfillment_availability.length > 0) {
      return attributes.fulfillment_availability.reduce(
        (total, fa) => total + (fa.quantity || 0),
        0
      );
    }

    return 0;
  }

  /**
   * Determina el canal de fulfillment
   */
  determineFulfillmentChannel(fulfillmentAvailability, attributes) {
    // Verificar si hay fulfillment por Amazon (AFN)
    const hasAFN =
      fulfillmentAvailability?.some(
        (fa) => fa.fulfillmentChannelCode === 'AMAZON' || fa.fulfillmentChannelCode === 'AFN'
      ) ||
      attributes.fulfillment_availability?.some(
        (fa) => fa.fulfillment_channel_code === 'AMAZON' || fa.fulfillment_channel_code === 'AFN'
      );

    return hasAFN ? 'AFN' : 'MFN';
  }

  /**
   * Mapea el estado de un listing de Amazon a nuestro formato
   */
  mapListingStatus(amazonStatus) {
    if (!amazonStatus || !Array.isArray(amazonStatus)) {
      return 'Inactive';
    }

    // El status viene como array: ["DISCOVERABLE"], ["ACTIVE"], etc.
    const status = amazonStatus[0];

    const statusMap = {
      ACTIVE: 'Active',
      DISCOVERABLE: 'Incomplete', // Producto visible pero no completamente listado
      SUPPRESSED: 'Inactive',
      BLOCKED: 'Inactive',
      INCOMPLETE: 'Incomplete',
    };

    return statusMap[status] || 'Inactive';
  }

  /**
   * Mapea el tipo de condición
   */
  mapConditionType(conditionType) {
    const conditionMap = {
      new_new: 'New',
      used_like_new: 'Used',
      used_very_good: 'Used',
      used_good: 'Used',
      used_acceptable: 'Used',
      collectible_like_new: 'Collectible',
      collectible_very_good: 'Collectible',
      collectible_good: 'Collectible',
      collectible_acceptable: 'Collectible',
      refurbished: 'Refurbished',
    };

    return conditionMap[conditionType] || 'New';
  }

  /**
   * Inserta o actualiza un producto en la base de datos
   */
  async upsertProduct(productData) {
    try {
      const result = await Product.findOneAndUpdate(
        { sellerSku: productData.sellerSku },
        {
          ...productData,
          lastSyncAt: new Date(),
          syncStatus: 'synced',
          syncError: '',
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        }
      );

      return result;
    } catch (error) {
      // Marcar producto con error
      await Product.findOneAndUpdate(
        { sellerSku: productData.sellerSku },
        {
          sellerSku: productData.sellerSku,
          asin: productData.asin || '',
          title: productData.title || productData.sellerSku,
          syncStatus: 'error',
          syncError: error.message,
          lastSyncAt: new Date(),
        },
        { upsert: true }
      );

      throw error;
    }
  }

  /**
   * Determina el estado del producto (legacy para FBA)
   */
  determineProductStatus(item) {
    // Para FBA items
    if (item.totalQuantity !== undefined) {
      if (!item.asin || !item.productName) {
        return 'Incomplete';
      }
      return item.totalQuantity > 0 ? 'Active' : 'Inactive';
    }

    // Default
    return 'Active';
  }

  /**
   * Extrae la marca del título (fallback)
   */
  extractBrandFromTitle(title) {
    if (!title) return '';

    const cleanTitle = title.trim();
    const words = cleanTitle.split(/[\s\-\,]+/);
    const commonWords = [
      'the',
      'and',
      'for',
      'with',
      'pack',
      'set',
      'kit',
      'de',
      'del',
      'la',
      'el',
    ];

    const potentialBrand = words.find(
      (word) => word.length > 2 && !commonWords.includes(word.toLowerCase()) && isNaN(word)
    );

    return potentialBrand || words[0] || '';
  }

  /**
   * Actualiza el stock de un producto (simulado por ahora)
   */
  async updateInventoryQuantity(sellerSku, quantity) {
    try {
      // Por ahora solo actualizamos localmente
      const result = await Product.findOneAndUpdate(
        { sellerSku },
        {
          quantity,
          lastInventoryUpdate: new Date(),
        },
        { new: true }
      );

      if (!result) {
        throw new Error('Producto no encontrado');
      }

      logger.info(`Updated local inventory for SKU ${sellerSku} to ${quantity}`);
      return result;
    } catch (error) {
      logger.error(`Error updating inventory for SKU ${sellerSku}:`, error);
      throw error;
    }
  }

  /**
   * Actualiza stock de múltiples productos
   */
  async bulkUpdateInventory(updates) {
    const results = {
      success: [],
      errors: [],
    };

    for (const update of updates) {
      try {
        await this.updateInventoryQuantity(update.sellerSku, update.quantity);
        results.success.push({
          sellerSku: update.sellerSku,
          quantity: update.quantity,
        });
      } catch (error) {
        results.errors.push({
          sellerSku: update.sellerSku,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Obtiene información detallada de un producto por ASIN
   */
  async getCatalogItemByAsin(asin) {
    try {
      const result = await spApiClient.executeWithRetry(async (client) => {
        const response = await client.callAPI({
          operation: 'getCatalogItem',
          endpoint: 'catalogItems',
          path: {
            asin: asin,
          },
          query: {
            marketplaceIds: [this.marketplaceId],
            includedData: ['attributes', 'images', 'productTypes', 'salesRanks'],
          },
        });
        return response;
      });

      return result;
    } catch (error) {
      logger.error(`Error getting catalog item for ASIN ${asin}:`, error);
      throw error;
    }
  }

  /**
   * Verifica cuántos productos necesitan sincronización
   */
  async checkSyncNeeded() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const count = await Product.countDocuments({
        $or: [
          { lastSyncAt: { $lt: oneHourAgo } },
          { lastSyncAt: { $exists: false } },
          { syncStatus: 'error' },
        ],
      });

      return count;
    } catch (error) {
      logger.error('Error checking sync needed:', error);
      throw error;
    }
  }

  /**
   * Obtiene información de endpoints disponibles
   */
  async getAvailableEndpoints() {
    try {
      const client = await spApiClient.getClient();
      const endpoints = {};

      Object.entries(client.endpoints).forEach(([name, config]) => {
        endpoints[name] = {
          version: config.version || 'unknown',
          operations: config.operations ? Object.keys(config.operations) : [],
        };
      });

      return endpoints;
    } catch (error) {
      logger.error('Error getting endpoints:', error);
      throw error;
    }
  }

  /**
   * Función de prueba para obtener órdenes
   */
  async getOrders(createdAfter) {
    try {
      // Verificar que tenemos marketplace ID configurado
      if (!this.marketplaceId) {
        throw new Error('AMAZON_MARKETPLACE_ID no configurado');
      }

      const result = await spApiClient.executeWithRetry(async (client) => {
        const queryParams = {
          marketplaceIds: [this.marketplaceId],
          createdAfter:
            createdAfter || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          orderStatuses: ['Unshipped', 'PartiallyShipped'],
          maxResultsPerPage: 10,
        };

        logger.info('Getting orders with params:', queryParams);

        const response = await client.callAPI({
          operation: 'getOrders',
          endpoint: 'orders',
          query: queryParams,
        });
        return response;
      });

      logger.info(`Retrieved ${result.orders?.length || 0} orders`);
      return result.orders || [];
    } catch (error) {
      logger.error('Error getting orders:', error);
      return [];
    }
  }
}

module.exports = new AmazonService();
