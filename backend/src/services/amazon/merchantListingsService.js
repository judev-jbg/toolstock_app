// backend/src/services/amazon/merchantListingsService.js
const spApiClient = require('./spApiClient');
const Product = require('../../models/productModel');
const logger = require('../../utils/logger').createLogger('merchantListingsService');
const Papa = require('papaparse');

class MerchantListingsService {
  constructor() {
    this.marketplaceId = process.env.AMAZON_MARKETPLACE_ID || 'A1RKKUPIHCS9HS';
  }

  /**
   * Solicita el reporte GET_MERCHANT_LISTINGS_ALL_DATA
   */
  async requestMerchantListingsReport() {
    try {
      logger.info('Requesting merchant listings report...');

      const result = await spApiClient.executeWithRetry(async (client) => {
        const response = await client.callAPI({
          operation: 'createReport',
          endpoint: 'reports',
          body: {
            reportType: 'GET_MERCHANT_LISTINGS_ALL_DATA',
            marketplaceIds: [this.marketplaceId],
          },
        });
        return response;
      });

      logger.info(`Report requested with ID: ${result.reportId}`);
      return result;
    } catch (error) {
      logger.error('Error requesting merchant listings report:', error);
      throw new Error(`Error requesting report: ${error.message}`);
    }
  }

  /**
   * Verifica el estado de un reporte
   */
  async checkReportStatus(reportId) {
    try {
      const result = await spApiClient.executeWithRetry(async (client) => {
        const response = await client.callAPI({
          operation: 'getReport',
          endpoint: 'reports',
          path: {
            reportId: reportId,
          },
        });
        return response;
      });

      return result;
    } catch (error) {
      logger.error(`Error checking report status for ${reportId}:`, error);
      throw new Error(`Error checking report: ${error.message}`);
    }
  }

  /**
   * Descarga el contenido de un reporte
   */
  async downloadReportDocument(reportDocumentId) {
    try {
      // Primero obtener la URL del documento
      const documentInfo = await spApiClient.executeWithRetry(async (client) => {
        const response = await client.callAPI({
          operation: 'getReportDocument',
          endpoint: 'reports',
          path: {
            reportDocumentId: reportDocumentId,
          },
        });
        return response;
      });

      if (!documentInfo.url) {
        throw new Error('No URL found in report document');
      }

      // Descargar el contenido del reporte
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(documentInfo.url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const content = await response.text();
      logger.info(`Downloaded report document, size: ${content.length} bytes`);

      return content;
    } catch (error) {
      logger.error(`Error downloading report document ${reportDocumentId}:`, error);
      throw new Error(`Error downloading report: ${error.message}`);
    }
  }

  /**
   * Parsea el CSV del reporte y extrae la información de status
   */
  parseReportData(csvContent) {
    try {
      const parsed = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
      });

      if (parsed.errors.length > 0) {
        logger.warn('CSV parsing errors:', parsed.errors);
      }

      const productsData = parsed.data.map((row) => ({
        sellerSku: row['seller-sku'] || row['Seller SKU'],
        asin: row['asin1'] || row['ASIN'],
        status: this.normalizeStatus(row['status'] || row['Status']),
        price: parseFloat(row['price'] || row['Price'] || 0),
        quantity: parseInt(row['quantity'] || row['Quantity'] || 0),
        fulfillmentChannel: row['fulfillment-channel'] || row['Fulfillment Channel'] || 'MFN',
        itemCondition: row['item-condition'] || row['Item Condition'] || 'New',
        itemName: row['item-name'] || row['Item Name'] || '',
        itemDescription: row['item-description'] || row['Item Description'] || '',
        listingId: row['listing-id'] || row['Listing ID'] || '',
        productId: row['product-id'] || row['Product ID'] || '',
        productIdType: row['product-id-type'] || row['Product ID Type'] || '',
      }));

      logger.info(`Parsed ${productsData.length} products from report`);
      return productsData;
    } catch (error) {
      logger.error('Error parsing report data:', error);
      throw new Error(`Error parsing CSV: ${error.message}`);
    }
  }

  /**
   * Normaliza el status de Amazon a nuestro formato
   */
  normalizeStatus(amazonStatus) {
    if (!amazonStatus) return 'Unknown';

    const statusMap = {
      Active: 'Active',
      Inactive: 'Inactive',
      Incomplete: 'Incomplete',
      ACTIVE: 'Active',
      INACTIVE: 'Inactive',
      INCOMPLETE: 'Incomplete',
      SUPPRESSED: 'Inactive',
      BLOCKED: 'Inactive',
    };

    return statusMap[amazonStatus] || amazonStatus;
  }

  /**
   * Actualiza el status de los productos en la base de datos
   */
  async updateProductStatuses(productsData) {
    let updated = 0;
    let errors = 0;

    for (const productData of productsData) {
      try {
        if (!productData.sellerSku) {
          continue;
        }

        const updateData = {
          status: productData.status,
          lastSyncAt: new Date(),
          syncStatus: 'synced',
          syncError: '',
        };

        // Actualizar campos adicionales si están disponibles
        if (productData.price > 0) {
          updateData.price = productData.price;
        }
        if (productData.quantity >= 0) {
          updateData.quantity = productData.quantity;
        }
        if (productData.asin) {
          updateData.asin = productData.asin;
        }
        if (productData.itemName) {
          updateData.title = productData.itemName;
        }

        const result = await Product.findOneAndUpdate(
          { sellerSku: productData.sellerSku },
          updateData,
          { new: true }
        );

        if (result) {
          updated++;
          logger.debug(
            `Updated product ${productData.sellerSku} with status ${productData.status}`
          );
        } else {
          logger.warn(`Product not found in database: ${productData.sellerSku}`);
        }
      } catch (error) {
        errors++;
        logger.error(`Error updating product ${productData.sellerSku}:`, error);
      }
    }

    logger.info(`Status update completed: ${updated} updated, ${errors} errors`);
    return { updated, errors };
  }

  /**
   * Proceso completo: solicitar reporte, esperar, descargar y procesar
   */
  async syncProductStatusFromReport() {
    try {
      logger.info('Starting complete merchant listings sync process...');

      // 1. Solicitar el reporte
      const reportRequest = await this.requestMerchantListingsReport();
      const reportId = reportRequest.reportId;

      // 2. Esperar a que el reporte esté listo (con timeout)
      let reportStatus;
      let attempts = 0;
      const maxAttempts = 30; // 15 minutos máximo

      do {
        await new Promise((resolve) => setTimeout(resolve, 30000)); // Esperar 30 segundos
        reportStatus = await this.checkReportStatus(reportId);
        attempts++;

        logger.info(
          `Report status: ${reportStatus.processingStatus} (attempt ${attempts}/${maxAttempts})`
        );

        if (attempts >= maxAttempts) {
          throw new Error('Report generation timeout - exceeded maximum wait time');
        }
      } while (reportStatus.processingStatus !== 'DONE');

      if (
        reportStatus.processingStatus === 'CANCELLED' ||
        reportStatus.processingStatus === 'FATAL'
      ) {
        throw new Error(`Report generation failed with status: ${reportStatus.processingStatus}`);
      }

      // 3. Descargar el reporte
      const reportContent = await this.downloadReportDocument(reportStatus.reportDocumentId);

      // 4. Parsear los datos
      const productsData = this.parseReportData(reportContent);

      // 5. Actualizar la base de datos
      const updateResult = await this.updateProductStatuses(productsData);

      logger.info('Merchant listings sync completed successfully');
      return {
        success: true,
        reportId,
        productsProcessed: productsData.length,
        productsUpdated: updateResult.updated,
        errors: updateResult.errors,
      };
    } catch (error) {
      logger.error('Error in merchant listings sync:', error);
      throw error;
    }
  }

  /**
   * Obtiene reportes disponibles (para debugging)
   */
  async getAvailableReports() {
    try {
      const result = await spApiClient.executeWithRetry(async (client) => {
        const response = await client.callAPI({
          operation: 'getReports',
          endpoint: 'reports',
          query: {
            reportTypes: ['GET_MERCHANT_LISTINGS_ALL_DATA'],
            pageSize: 10,
          },
        });
        return response;
      });

      return result.reports || [];
    } catch (error) {
      logger.error('Error getting available reports:', error);
      throw error;
    }
  }
}

module.exports = new MerchantListingsService();
