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

        nextToken = result.pagination?.nextToken;
        pageCount++;

        logger.info(
          `Page ${pageCount}: Retrieved ${items.length} items (Total: ${allItems.length})`
        );

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
   * Mapea un listing a formato de producto (CORREGIDO)
   */
  mapListingToProduct(listing) {
    const summary = listing.summaries?.[0] || {};
    const attributes = listing.attributes || {};
    const offers = listing.offers || [];
    const fulfillmentAvailability = listing.fulfillmentAvailability || [];
    const asin = summary.asin;
    const title = summary.itemName || attributes.item_name?.[0]?.value || listing.sku;
    const brand = attributes.manufacturer?.[0].value || attributes.brand?.[0].value;
    const price = offers[0].price.amount;
    const quantity = fulfillmentAvailability[0].quantity;
    const status = '';
    const imageUrl =
      summary.mainImage?.link || attributes.main_product_image_locator?.[0]?.media_location || '';
    const condition = this.mapConditionType(
      summary.conditionType || attributes.condition_type?.[0]?.value || 'new_new'
    );
    const fulfillmentChannel = this.determineFulfillmentChannel(
      fulfillmentAvailability,
      attributes
    );

    return {
      asin,
      sellerSku: listing.sku,
      title,
      brand,
      quantity,
      condition,
      fulfillmentChannel,
      status,
      price,
      currency: 'EUR',
      productType: summary.productType || attributes.product_type || 'physical',
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
        material: attributes.material?.[0]?.value || '',
        countryOfOrigin: attributes.country_of_origin?.[0]?.value || '',
      },
    };
  }

  /**
   * Extrae la marca de los atributos (CORREGIDO)
   */
  extractBrandFromAttributes(attributes) {
    // Prioridad: manufacturer > brand > extraer del título

    if (
      attributes.manufacturer &&
      Array.isArray(attributes.manufacturer) &&
      attributes.manufacturer.length > 0
    ) {
      const manufacturerValue = attributes.manufacturer?.[0].value;
      if (manufacturerValue && manufacturerValue.trim()) {
        return manufacturerValue.trim();
      }
    }

    if (attributes.brand && Array.isArray(attributes.brand) && attributes.brand.length > 0) {
      const brandValue = attributes.brand?.[0].value;
      if (brandValue && brandValue.trim()) {
        return brandValue.trim();
      }
    }

    return attributes;
  }

  /**
   * Extrae el precio de offers o attributes (CORREGIDO)
   */
  extractPriceFromOffers(offers, attributes) {
    // Prioridad 1: offers array
    if (offers && Array.isArray(offers) && offers.length > 0) {
      // Buscar oferta B2C o ALL audience
      const b2cOffer = offers.find(
        (offer) => offer.offerType === 'B2C' || offer.audience?.value === 'ALL'
      );

      if (b2cOffer && b2cOffer.price?.amount) {
        const amount = parseFloat(b2cOffer.price.amount);
        if (!isNaN(amount) && amount > 0) {
          return amount;
        }
      }

      // Si no hay B2C, tomar la primera oferta disponible
      const firstOffer = offers[0];
      if (firstOffer && firstOffer.price?.amount) {
        const amount = parseFloat(firstOffer.price.amount);
        if (!isNaN(amount) && amount > 0) {
          return amount;
        }
      }
    }

    // Prioridad 2: purchasable_offer en attributes
    if (attributes.purchasable_offer && Array.isArray(attributes.purchasable_offer)) {
      for (const purchasableOffer of attributes.purchasable_offer) {
        // Buscar oferta para audience ALL
        if (purchasableOffer.audience === 'ALL' || !purchasableOffer.audience) {
          const priceSchedule = purchasableOffer.our_price?.[0]?.schedule?.[0];
          if (priceSchedule?.value_with_tax) {
            const amount = parseFloat(priceSchedule.value_with_tax);
            if (!isNaN(amount) && amount > 0) {
              return amount;
            }
          }
        }
      }

      // Si no encuentra audience ALL, tomar la primera disponible
      const firstPurchasableOffer = attributes.purchasable_offer[0];
      if (firstPurchasableOffer) {
        const priceSchedule = firstPurchasableOffer.our_price?.[0]?.schedule?.[0];
        if (priceSchedule?.value_with_tax) {
          const amount = parseFloat(priceSchedule.value_with_tax);
          if (!isNaN(amount) && amount > 0) {
            return amount;
          }
        }
      }
    }

    return 0;
  }

  /**
   * Extrae la cantidad de fulfillmentAvailability o attributes (CORREGIDO)
   */
  extractQuantityFromFulfillment(fulfillmentAvailability, attributes) {
    let totalQuantity = 0;

    // Prioridad 1: fulfillmentAvailability en el nivel superior
    if (fulfillmentAvailability && Array.isArray(fulfillmentAvailability)) {
      for (const fa of fulfillmentAvailability) {
        if (typeof fa.quantity === 'number' && fa.quantity >= 0) {
          totalQuantity += fa.quantity;
        }
      }
      if (totalQuantity > 0) {
        return totalQuantity;
      }
    }

    // Prioridad 2: fulfillment_availability en attributes
    if (attributes.fulfillment_availability && Array.isArray(attributes.fulfillment_availability)) {
      for (const fa of attributes.fulfillment_availability) {
        if (typeof fa.quantity === 'number' && fa.quantity >= 0) {
          totalQuantity += fa.quantity;
        }
      }
    }

    return totalQuantity;
  }

  /**
   * Determina el canal de fulfillment (CORREGIDO)
   */
  determineFulfillmentChannel(fulfillmentAvailability, attributes) {
    // Verificar fulfillmentAvailability
    if (fulfillmentAvailability && Array.isArray(fulfillmentAvailability)) {
      for (const fa of fulfillmentAvailability) {
        const code = fa.fulfillmentChannelCode;
        if (code === 'AMAZON' || code === 'AFN') {
          return 'AFN';
        }
      }
    }

    // Verificar attributes.fulfillment_availability
    if (attributes.fulfillment_availability && Array.isArray(attributes.fulfillment_availability)) {
      for (const fa of attributes.fulfillment_availability) {
        const code = fa.fulfillment_channel_code;
        if (code === 'AMAZON' || code === 'AFN') {
          return 'AFN';
        }
      }
    }

    return 'MFN';
  }

  /**
   * Mapea el estado de un listing de Amazon a nuestro formato (CORREGIDO)
   */
  mapListingStatus(amazonStatus) {
    if (!amazonStatus || !Array.isArray(amazonStatus) || amazonStatus.length === 0) {
      return 'Sin estado';
    }

    // El status viene como array: ["DISCOVERABLE"], ["ACTIVE"], etc.
    const status = amazonStatus[0];

    const statusMap = {
      ACTIVE: 'Active',
      DISCOVERABLE: 'Active', // Cambiado: DISCOVERABLE significa que está activo y visible
      SUPPRESSED: 'Inactive',
      BLOCKED: 'Inactive',
      INCOMPLETE: 'Incomplete',
      BUYABLE: 'Active',
    };

    return amazonStatus;
  }

  /**
   * Mapea el tipo de condición (CORREGIDO)
   */
  mapConditionType(conditionType) {
    if (!conditionType) return 'New';

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
   * Sincroniza productos con la base de datos local (MEJORADO)
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
          const result = await this.upsertProduct(productData);

          if (result.upserted) {
            syncResults.created++;
          } else {
            syncResults.updated++;
          }
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
   * Actualiza el stock de un producto en Amazon (NUEVO - IMPLEMENTACIÓN REAL)
   */
  async updateInventoryQuantity(sellerSku, quantity) {
    try {
      if (!this.sellerId) {
        throw new Error('AMAZON_SELLER_ID no configurado');
      }

      logger.info(`Updating inventory for SKU ${sellerSku} to quantity ${quantity}`);

      // Preparar el cuerpo de la solicitud según la API de Amazon
      const requestBody = {
        productType: 'PRODUCT', // Esto puede necesitar ajuste según el tipo de producto
        patches: [
          {
            op: 'replace',
            path: '/attributes/fulfillment_availability',
            value: [
              {
                fulfillment_channel_code: 'DEFAULT',
                quantity: quantity,
              },
            ],
          },
        ],
      };

      // Realizar la llamada a Amazon SP-API
      const result = await spApiClient.executeWithRetry(async (client) => {
        const response = await client.callAPI({
          operation: 'patchListingsItem',
          endpoint: 'listingsItems',
          path: {
            sellerId: this.sellerId,
            sku: sellerSku,
          },
          query: {
            marketplaceIds: [this.marketplaceId],
          },
          body: requestBody,
        });
        return response;
      });

      // Actualizar también en la base de datos local
      const localResult = await Product.findOneAndUpdate(
        { sellerSku },
        {
          quantity,
          lastInventoryUpdate: new Date(),
          syncStatus: 'synced',
          syncError: '',
        },
        { new: true }
      );

      if (!localResult) {
        throw new Error('Producto no encontrado en base de datos local');
      }

      logger.info(`Successfully updated inventory for SKU ${sellerSku} in Amazon and locally`);

      return {
        amazon: result,
        local: localResult,
        success: true,
      };
    } catch (error) {
      logger.error(`Error updating inventory for SKU ${sellerSku}:`, error);

      // Marcar error en base de datos local
      await Product.findOneAndUpdate(
        { sellerSku },
        {
          syncStatus: 'error',
          syncError: error.message,
          lastInventoryUpdate: new Date(),
        }
      );

      throw error;
    }
  }

  /**
   * Actualiza stock de múltiples productos en Amazon (MEJORADO)
   */
  async bulkUpdateInventory(updates) {
    const results = {
      success: [],
      errors: [],
    };

    logger.info(`Starting bulk inventory update for ${updates.length} products`);

    // Procesar de 5 en 5 para evitar rate limiting
    const batchSize = 5;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);

      const batchPromises = batch.map(async (update) => {
        try {
          await this.updateInventoryQuantity(update.sellerSku, update.quantity);
          results.success.push({
            sellerSku: update.sellerSku,
            quantity: update.quantity,
            success: true,
          });
        } catch (error) {
          results.errors.push({
            sellerSku: update.sellerSku,
            error: error.message,
            success: false,
          });
        }
      });

      await Promise.all(batchPromises);

      // Pausa entre lotes para evitar rate limiting
      if (i + batchSize < updates.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    logger.info(
      `Bulk inventory update completed: ${results.success.length} successful, ${results.errors.length} failed`
    );
    return results;
  }

  /**
   * Mapea un item de inventario FBA a formato de producto (MANTENER)
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

  // ... resto de métodos sin cambios (upsertProduct, determineProductStatus, extractBrandFromTitle, etc.)
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

  determineProductStatus(item) {
    if (item.totalQuantity !== undefined) {
      if (!item.asin || !item.productName) {
        return 'Incomplete';
      }
      return item.totalQuantity > 0 ? 'Active' : 'Inactive';
    }
    return 'Active';
  }

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
